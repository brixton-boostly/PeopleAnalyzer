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

  const { cycleId } = await req.json()
  if (!cycleId) return NextResponse.json({ error: 'cycleId required' }, { status: 400 })

  const supabase = createClient()

  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('name, retro_participant_ids')
    .eq('id', cycleId)
    .single()

  if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })

  const { data: assignments } = await supabase
    .from('manager_assignments')
    .select('direct_report_id, direct_reports(id, full_name, slack_user_id)')
    .eq('review_cycle_id', cycleId)

  const seen = new Set<string>()
  type EmpRow = { id: string; full_name: string; slack_user_id: string | null }
  type AssignRow = { direct_report_id: string; direct_reports: EmpRow | null }
  const allEmployees: EmpRow[] = []
  for (const a of (assignments ?? []) as unknown as AssignRow[]) {
    const dr = a.direct_reports
    if (dr && !seen.has(dr.id)) {
      seen.add(dr.id)
      allEmployees.push(dr)
    }
  }

  const participantIds = cycle.retro_participant_ids as string[] | null
  const participants =
    Array.isArray(participantIds) && participantIds.length > 0
      ? allEmployees.filter(e => participantIds.includes(e.id))
      : allEmployees

  const { data: submitted } = await supabase
    .from('retros')
    .select('employee_id')
    .eq('cycle_id', cycleId)
    .not('submitted_at', 'is', null)

  const submittedIds = new Set((submitted ?? []).map((r: { employee_id: string }) => r.employee_id))
  const pending = participants.filter(e => !submittedIds.has(e.id))

  const cycleName = cycle.name ?? 'Retro'
  const results: { employeeId: string; ok: boolean; error?: string }[] = []

  for (const emp of pending) {
    if (!emp.slack_user_id) {
      results.push({ employeeId: emp.id, ok: false, error: 'No Slack user ID' })
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

  return NextResponse.json({ results, sent: results.filter(r => r.ok).length })
}
