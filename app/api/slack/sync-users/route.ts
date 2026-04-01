import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'

export async function POST() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!process.env.SLACK_BOT_TOKEN) {
    return NextResponse.json({ error: 'SLACK_BOT_TOKEN not configured' }, { status: 500 })
  }

  const slackRes = await fetch('https://slack.com/api/users.list', {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
  })
  const slackData = await slackRes.json()
  if (!slackData.ok) {
    return NextResponse.json({ error: `Slack error: ${slackData.error}` }, { status: 500 })
  }

  type SlackMember = {
    id: string
    real_name?: string
    profile?: { display_name?: string; email?: string }
    deleted?: boolean
    is_bot?: boolean
  }
  const slackUsers: SlackMember[] = (slackData.members ?? []).filter(
    (u: SlackMember) => !u.deleted && !u.is_bot
  )

  const supabase = createClient()

  const { data: employees } = await supabase
    .from('direct_reports')
    .select('id, full_name, slack_user_id')

  if (!employees?.length) {
    return NextResponse.json({ matched: 0, updated: 0, unmatched: [] })
  }

  let matched = 0
  let updated = 0
  const unmatched: string[] = []

  for (const emp of employees) {
    if (emp.slack_user_id) continue

    const name = emp.full_name.toLowerCase().trim()
    const slackMatch = slackUsers.find(u => {
      const realName = (u.real_name ?? '').toLowerCase().trim()
      const displayName = (u.profile?.display_name ?? '').toLowerCase().trim()
      return realName === name || displayName === name
    })

    if (slackMatch) {
      matched++
      const { error } = await supabase
        .from('direct_reports')
        .update({ slack_user_id: slackMatch.id })
        .eq('id', emp.id)
      if (!error) updated++
    } else {
      unmatched.push(emp.full_name)
    }
  }

  return NextResponse.json({ matched, updated, unmatched })
}
