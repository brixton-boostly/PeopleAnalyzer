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

  const { data: reviews } = await supabase
    .from('reviews')
    .select(`
      id, performance, potential, submitted_at,
      manager:users!manager_id(first_name, last_name),
      direct_report:direct_reports!direct_report_id(full_name, job_title)
    `)
    .eq('review_cycle_id', cycleId)
    .not('submitted_at', 'is', null)
    .order('submitted_at')

  const rows = (reviews ?? []).map((r: any) => ({
    reviewId: r.id,
    managerName: `${r.manager.first_name} ${r.manager.last_name}`,
    employeeName: r.direct_report.full_name,
    jobTitle: r.direct_report.job_title,
    performance: r.performance,
    potential: r.potential,
    submittedAt: r.submitted_at,
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
      <ResultsTable rows={rows} />
    </div>
  )
}
