import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { redirect } from 'next/navigation'
import { NineBoxView } from '@/components/ninebox/NineBoxView'

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ cycleId: string }>
}) {
  const { cycleId } = await params
  const session = await auth()
  if (!session || session.user.role !== 'manager') redirect('/login')

  const supabase = createClient()

  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('id, name, status')
    .eq('id', cycleId)
    .single()

  if (!cycle) redirect('/review')

  const { data: assignments } = await supabase
    .from('manager_assignments')
    .select('direct_report_id, direct_reports(id, full_name, job_title, gusto_employee_id, created_at)')
    .eq('manager_id', session.user.id)
    .eq('review_cycle_id', cycleId)

  const directReports = (assignments ?? [])
    .map((a: any) => a.direct_reports)
    .filter(Boolean)

  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, direct_report_id, performance, potential, submitted_at, manager_id, review_cycle_id')
    .eq('manager_id', session.user.id)
    .eq('review_cycle_id', cycleId)

  const firstSubmitted = reviews?.find(r => r.submitted_at) ?? null

  return (
    <div className="min-h-screen bg-[#f4f4f6] p-6">
      <NineBoxView
        cycleId={cycleId}
        cycleName={cycle.name}
        directReports={directReports}
        initialReviews={reviews ?? []}
        submittedAt={firstSubmitted?.submitted_at ?? null}
        managerName={session.user.name ?? ''}
      />
    </div>
  )
}
