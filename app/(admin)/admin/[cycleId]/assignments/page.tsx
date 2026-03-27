import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { redirect } from 'next/navigation'

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
    .select('name, status')
    .eq('id', cycleId)
    .single()

  const { data: assignments } = await supabase
    .from('manager_assignments')
    .select(`
      id,
      manager:users!manager_id(id, first_name, last_name, email),
      direct_report:direct_reports!direct_report_id(id, full_name, job_title)
    `)
    .eq('review_cycle_id', cycleId)
    .order('created_at')

  // Group by manager
  const byManager = new Map<string, { manager: any; reports: any[] }>()
  for (const a of assignments ?? []) {
    const mgr = (a as any).manager
    if (!byManager.has(mgr.id)) byManager.set(mgr.id, { manager: mgr, reports: [] })
    byManager.get(mgr.id)!.reports.push({ ...(a as any).direct_report, assignmentId: a.id })
  }

  const isEditable = cycle?.status === 'draft'

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-[17px] font-bold">{cycle?.name} — Assignments</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {isEditable
              ? 'Review and edit before activating.'
              : 'Read-only — cycle is active or closed.'}
          </p>
        </div>
        {isEditable && (
          <form action={`/api/cycles/${cycleId}`} method="PATCH">
            <button
              type="submit"
              className="bg-[#7B2FBE] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#6a28a3]"
            >
              Activate Cycle
            </button>
          </form>
        )}
      </div>

      <div className="space-y-4">
        {[...byManager.values()].map(({ manager, reports }) => (
          <div key={manager.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-[#ede9fe] text-[#7B2FBE] flex items-center justify-center text-[11px] font-bold">
                {manager.first_name[0]}{manager.last_name[0]}
              </div>
              <div>
                <p className="text-[13px] font-semibold">{manager.first_name} {manager.last_name}</p>
                <p className="text-[11px] text-gray-400">{manager.email}</p>
              </div>
              <span className="ml-auto text-xs text-gray-400">{reports.length} direct reports</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {reports.map((r: any) => (
                <span key={r.id} className="flex items-center gap-1.5 bg-[#f5f3ff] text-[#7B2FBE] rounded-lg px-3 py-1.5 text-xs font-medium">
                  {r.full_name}
                  {r.job_title && <span className="text-purple-300">· {r.job_title}</span>}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
