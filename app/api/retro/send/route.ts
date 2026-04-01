import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { createRetroMagicLink } from '@/lib/magic-link'
import { sendRetroDM } from '@/lib/slack'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { cycleId, questions, participantIds } = await req.json()
  if (!cycleId) return NextResponse.json({ error: 'cycleId required' }, { status: 400 })

  const supabase = createClient()

  // Fetch cycle name for DM text
  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('name')
    .eq('id', cycleId)
    .single()

  // Save questions, participant IDs, and set retro active
  const updatePayload: Record<string, unknown> = { retro_status: 'active' }
  if (Array.isArray(questions) && questions.length > 0) {
    updatePayload.retro_questions = questions
  }
  if (Array.isArray(participantIds) && participantIds.length > 0) {
    updatePayload.retro_participant_ids = participantIds
  }
  await supabase.from('review_cycles').update(updatePayload).eq('id', cycleId)

  // Fetch all unique employees in this cycle
  const { data: assignments } = await supabase
    .from('manager_assignments')
    .select('direct_report_id, direct_reports(id, full_name, slack_user_id)')
    .eq('review_cycle_id', cycleId)

  const seen = new Set<string>()
  const allEmployees: { id: string; full_name: string; slack_user_id: string | null }[] = []
  type AssignmentRow = {
    direct_report_id: string
    direct_reports: { id: string; full_name: string; slack_user_id: string | null } | null
  }
  for (const a of (assignments ?? []) as unknown as AssignmentRow[]) {
    const dr = a.direct_reports
    if (dr && !seen.has(dr.id)) {
      seen.add(dr.id)
      allEmployees.push(dr)
    }
  }

  // Filter to participantIds if provided; otherwise send to all
  const employeesToSend =
    Array.isArray(participantIds) && participantIds.length > 0
      ? allEmployees.filter(e => participantIds.includes(e.id))
      : allEmployees

  const cycleName = cycle?.name ?? 'Q1 2026'
  const results: { employeeId: string; ok: boolean; error?: string; skipped?: boolean }[] = []

  for (const emp of employeesToSend) {
    if (!emp.slack_user_id) {
      results.push({ employeeId: emp.id, ok: false, skipped: true, error: 'No Slack user ID' })
      continue
    }
    try {
      const url = await createRetroMagicLink(emp.id, cycleId)
      await sendRetroDM(emp.slack_user_id, emp.full_name.split(' ')[0], url, cycleName)
      results.push({ employeeId: emp.id, ok: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results.push({ employeeId: emp.id, ok: false, error: message })
    }
  }

  return NextResponse.json({ results })
}
