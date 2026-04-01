import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { redirect } from 'next/navigation'
import { RetroAdminView } from '@/components/admin/RetroAdminView'

export default async function RetroAdminPage({
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
    .select('name, retro_status, retro_questions, retro_participant_ids')
    .eq('id', cycleId)
    .single()

  if (!cycle) redirect('/admin')

  // All assignments: employee + manager
  const { data: assignments } = await supabase
    .from('manager_assignments')
    .select(`
      direct_report_id,
      direct_reports!direct_report_id(id, full_name, job_title, slack_user_id),
      manager:users!manager_id(first_name, last_name)
    `)
    .eq('review_cycle_id', cycleId)

  type AssignmentRow = {
    direct_report_id: string
    direct_reports: {
      id: string
      full_name: string
      job_title: string | null
      slack_user_id: string | null
    } | null
    manager: { first_name: string; last_name: string } | null
  }

  const seen = new Set<string>()
  const allEmployees: {
    id: string
    full_name: string
    job_title: string | null
    manager_name: string
    slack_user_id: string | null
  }[] = []

  for (const a of (assignments ?? []) as unknown as AssignmentRow[]) {
    const dr = a.direct_reports
    if (dr && !seen.has(dr.id)) {
      seen.add(dr.id)
      const managerName = a.manager
        ? `${a.manager.first_name} ${a.manager.last_name}`
        : 'Unknown'
      allEmployees.push({
        id: dr.id,
        full_name: dr.full_name,
        job_title: dr.job_title,
        manager_name: managerName,
        slack_user_id: dr.slack_user_id,
      })
    }
  }

  // All retros for this cycle
  const { data: retrosRaw } = await supabase
    .from('retros')
    .select('employee_id, submitted_at, responses, manager_comment')
    .eq('cycle_id', cycleId)

  const retros = (retrosRaw ?? []).map((r: any) => ({
    employee_id: r.employee_id as string,
    submitted_at: r.submitted_at as string | null,
    responses: Array.isArray(r.responses) ? r.responses : [],
    manager_comment: r.manager_comment as string | null,
  }))

  const initialQuestions = Array.isArray(cycle.retro_questions)
    ? (cycle.retro_questions as string[])
    : []

  const initialParticipantIds = Array.isArray(cycle.retro_participant_ids)
    ? (cycle.retro_participant_ids as string[])
    : []

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[17px] font-bold">{cycle.name} — Retro</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {cycle.retro_status === 'draft'
            ? 'Not launched'
            : cycle.retro_status === 'active'
            ? 'Active'
            : 'Closed'}
        </p>
      </div>
      <RetroAdminView
        cycleId={cycleId}
        cycleName={cycle.name}
        retroStatus={cycle.retro_status}
        initialQuestions={initialQuestions}
        initialParticipantIds={initialParticipantIds}
        allEmployees={allEmployees}
        retros={retros}
      />
    </div>
  )
}
