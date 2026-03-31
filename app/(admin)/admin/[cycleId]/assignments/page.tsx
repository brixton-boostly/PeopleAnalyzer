import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { redirect } from 'next/navigation'
import { AssignmentsView } from '@/components/admin/AssignmentsView'

export default async function AssignmentsPage({
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
    .select('name, status, retro_status, retro_questions')
    .eq('id', cycleId)
    .single()

  if (!cycle) redirect('/admin')

  // All assignments: employee + manager info
  const { data: assignments } = await supabase
    .from('manager_assignments')
    .select(`
      manager_id,
      manager:users!manager_id(id, first_name, last_name),
      direct_report:direct_reports!direct_report_id(id, full_name, job_title)
    `)
    .eq('review_cycle_id', cycleId)

  // Submitted reviews (to determine per-employee 9-box status)
  const { data: submitted } = await supabase
    .from('reviews')
    .select('direct_report_id, submitted_at')
    .eq('review_cycle_id', cycleId)
    .not('submitted_at', 'is', null)

  const submittedDrDates = new Map((submitted ?? []).map((r: any) => [r.direct_report_id as string, r.submitted_at as string]))

  // Submitted retros
  const { data: retros } = await supabase
    .from('retros')
    .select('employee_id, submitted_at')
    .eq('cycle_id', cycleId)
    .not('submitted_at', 'is', null)

  const retroDates = new Map((retros ?? []).map((r: any) => [r.employee_id as string, r.submitted_at as string]))

  // Managers who have submitted (for PA stat card)
  const { data: managerSubmissions } = await supabase
    .from('reviews')
    .select('manager_id')
    .eq('review_cycle_id', cycleId)
    .not('submitted_at', 'is', null)

  const submittedManagerIds = new Set((managerSubmissions ?? []).map((r: any) => r.manager_id as string))
  const allManagerIds = new Set((assignments ?? []).map((a: any) => a.manager_id as string))

  const employees = (assignments ?? []).map((a: any) => ({
    employeeId: a.direct_report.id,
    employeeName: a.direct_report.full_name,
    jobTitle: a.direct_report.job_title ?? null,
    managerId: a.manager_id,
    managerName: `${a.manager.first_name} ${a.manager.last_name}`,
    reviewSubmittedAt: submittedDrDates.get(a.direct_report.id) ?? null,
    retroSubmittedAt: retroDates.get(a.direct_report.id) ?? null,
  }))

  return (
    <AssignmentsView
      cycleId={cycleId}
      cycleName={cycle.name}
      retroStatus={cycle.retro_status as 'draft' | 'active' | 'closed'}
      retroQuestions={(Array.isArray(cycle.retro_questions) ? cycle.retro_questions as string[] : [])}
      employees={employees}
      totalManagers={allManagerIds.size}
      submittedManagerCount={submittedManagerIds.size}
    />
  )
}
