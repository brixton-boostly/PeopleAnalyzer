import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { createMagicLink } from '@/lib/magic-link'
import { sendNudgeDM } from '@/lib/slack'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { managerId, cycleId, all } = await req.json()
  const supabase = createClient()

  let managerIds: string[] = []

  if (all && cycleId) {
    // All managers in cycle who haven't submitted
    const { data: assignments } = await supabase
      .from('manager_assignments')
      .select('manager_id')
      .eq('review_cycle_id', cycleId)

    const allManagerIds = [...new Set((assignments ?? []).map((a: any) => a.manager_id as string))]

    const { data: submitted } = await supabase
      .from('reviews')
      .select('manager_id')
      .eq('review_cycle_id', cycleId)
      .not('submitted_at', 'is', null)

    const submittedIds = new Set((submitted ?? []).map((r: any) => r.manager_id as string))
    managerIds = allManagerIds.filter(id => !submittedIds.has(id))
  } else if (managerId) {
    managerIds = [managerId]
  } else {
    return NextResponse.json(
      { error: 'managerId or (cycleId + all: true) required' },
      { status: 400 }
    )
  }

  const results: { managerId: string; ok: boolean; error?: string }[] = []

  for (const id of managerIds) {
    const { data: user } = await supabase
      .from('users')
      .select('id, first_name, slack_user_id')
      .eq('id', id)
      .single()

    if (!user?.slack_user_id) {
      results.push({ managerId: id, ok: false, error: 'No Slack user ID' })
      continue
    }

    try {
      const url = await createMagicLink(user.id)
      await sendNudgeDM(user.slack_user_id, user.first_name, url)
      results.push({ managerId: id, ok: true })
    } catch (err: any) {
      results.push({ managerId: id, ok: false, error: err.message })
    }
  }

  return NextResponse.json({ results })
}
