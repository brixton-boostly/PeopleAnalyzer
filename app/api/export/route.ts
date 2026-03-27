import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cycleId = req.nextUrl.searchParams.get('cycleId')
  if (!cycleId) return NextResponse.json({ error: 'cycleId required' }, { status: 400 })

  const supabase = createClient()
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      performance, potential, submitted_at,
      manager:users!manager_id(first_name, last_name, email),
      direct_report:direct_reports!direct_report_id(full_name, job_title),
      cycle:review_cycles!review_cycle_id(name)
    `)
    .eq('review_cycle_id', cycleId)
    .not('submitted_at', 'is', null)
    .order('submitted_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = [
    ['Cycle', 'Manager', 'Manager Email', 'Employee', 'Job Title', 'Performance', 'Potential', 'Submitted At'],
    ...(data ?? []).map((r: any) => [
      r.cycle?.name ?? '',
      `${r.manager?.first_name} ${r.manager?.last_name}`,
      r.manager?.email ?? '',
      r.direct_report?.full_name ?? '',
      r.direct_report?.job_title ?? '',
      r.performance ?? '',
      r.potential ?? '',
      r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '',
    ]),
  ]

  const csv = rows
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="people-review-${cycleId}.csv"`,
    },
  })
}
