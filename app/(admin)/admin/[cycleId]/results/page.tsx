import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { redirect } from 'next/navigation'
import { ResultsTable } from '@/components/admin/ResultsTable'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ cycleId: string }>
}) {
  const { cycleId } = await params
  const session = await auth()
  if (!session || session.user.role !== 'admin') redirect('/login')

  const supabase = createClient()

  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('name')
    .eq('id', cycleId)
    .single()

  const [reviewsRes, retrosRes, managerCountRes, employeeCountRes] = await Promise.all([
    supabase
      .from('reviews')
      .select(`
        id, manager_id, performance, potential, comments, submitted_at,
        manager:users!manager_id(first_name, last_name),
        direct_report:direct_reports!direct_report_id(id, full_name, job_title)
      `)
      .eq('review_cycle_id', cycleId)
      .not('submitted_at', 'is', null)
      .order('submitted_at'),
    supabase
      .from('retros')
      .select('id, employee_id, responses, submitted_at, manager_comment')
      .eq('cycle_id', cycleId),
    supabase
      .from('manager_assignments')
      .select('manager_id')
      .eq('review_cycle_id', cycleId),
    supabase
      .from('manager_assignments')
      .select('direct_report_id')
      .eq('review_cycle_id', cycleId),
  ])

  const totalManagers = new Set((managerCountRes.data ?? []).map((a: any) => a.manager_id as string)).size
  const totalEmployees = new Set((employeeCountRes.data ?? []).map((a: any) => a.direct_report_id as string)).size
  const submittedManagers = new Set((reviewsRes.data ?? []).map((r: any) => r.manager_id as string)).size

  const submittedRetros = (retrosRes.data ?? []).filter((r: any) => r.submitted_at).length

  const rows = (reviewsRes.data ?? []).map((r: any) => ({
    reviewId: r.id,
    employeeId: r.direct_report.id,
    managerName: `${r.manager.first_name} ${r.manager.last_name}`,
    employeeName: r.direct_report.full_name,
    jobTitle: r.direct_report.job_title,
    performance: r.performance,
    potential: r.potential,
    comments: r.comments ?? null,
    submittedAt: r.submitted_at,
  }))

  const retros = (retrosRes.data ?? []).map((r: any) => ({
    id: r.id,
    employeeId: r.employee_id,
    responses: r.responses ?? [],
    submittedAt: r.submitted_at,
    managerComment: r.manager_comment ?? null,
  }))

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-[17px] font-bold">{cycle?.name} — Results</h1>
          <p className="text-xs text-gray-400 mt-0.5">{rows.length} submitted placements</p>
        </div>
        <Link href={`/api/export?cycleId=${cycleId}`}>
          <Button variant="outline" size="sm" className="text-xs">📤 Export CSV</Button>
        </Link>
      </div>
      <ResultsTable
        rows={rows}
        retros={retros}
        totalManagers={totalManagers}
        submittedManagers={submittedManagers}
        totalEmployees={totalEmployees}
        submittedRetros={submittedRetros}
      />
    </div>
  )
}
