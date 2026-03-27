import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { cycleId } = await req.json()
  if (!cycleId) return NextResponse.json({ error: 'cycleId required' }, { status: 400 })

  const supabase = createClient()

  // Check all assignments are placed
  const { data: assignments } = await supabase
    .from('manager_assignments')
    .select('direct_report_id')
    .eq('manager_id', session.user.id)
    .eq('review_cycle_id', cycleId)

  const { data: reviews } = await supabase
    .from('reviews')
    .select('direct_report_id, performance, potential')
    .eq('manager_id', session.user.id)
    .eq('review_cycle_id', cycleId)
    .is('submitted_at', null)

  const assignedIds = new Set((assignments ?? []).map((a: any) => a.direct_report_id))
  const placedIds = new Set(
    (reviews ?? [])
      .filter((r: any) => r.performance && r.potential)
      .map((r: any) => r.direct_report_id)
  )

  for (const id of assignedIds) {
    if (!placedIds.has(id)) {
      return NextResponse.json(
        { error: 'All employees must be placed before submitting' },
        { status: 400 }
      )
    }
  }

  const now = new Date().toISOString()
  await supabase
    .from('reviews')
    .update({ submitted_at: now })
    .eq('manager_id', session.user.id)
    .eq('review_cycle_id', cycleId)
    .is('submitted_at', null)

  return NextResponse.json({ ok: true, submittedAt: now })
}
