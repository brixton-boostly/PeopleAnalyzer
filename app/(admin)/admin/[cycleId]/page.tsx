import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { redirect } from 'next/navigation'
import { CompletionTable } from '@/components/admin/CompletionTable'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function AdminOverviewPage({
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
    .select('id, name, status, created_at')
    .eq('id', cycleId)
    .single()

  if (!cycle) redirect('/admin')

  const { data: assignments } = await supabase
    .from('manager_assignments')
    .select('manager_id, users!manager_id(id, first_name, last_name, email)')
    .eq('review_cycle_id', cycleId)

  const managerMap = new Map<string, { id: string; first_name: string; last_name: string; email: string; count: number }>()
  for (const a of assignments ?? []) {
    const user = (a as any).users
    if (!managerMap.has(a.manager_id)) {
      managerMap.set(a.manager_id, { ...user, count: 0 })
    }
    managerMap.get(a.manager_id)!.count++
  }

  const { data: submitted } = await supabase
    .from('reviews')
    .select('manager_id, submitted_at')
    .eq('review_cycle_id', cycleId)
    .not('submitted_at', 'is', null)

  const submittedMap = new Map<string, string>()
  for (const r of submitted ?? []) {
    if (!submittedMap.has(r.manager_id)) submittedMap.set(r.manager_id, r.submitted_at)
  }

  const managers = [...managerMap.entries()].map(([id, user]) => ({
    id,
    name: `${user.first_name} ${user.last_name}`,
    email: user.email,
    directReportCount: user.count,
    submittedAt: submittedMap.get(id) ?? null,
  }))

  const submittedCount = managers.filter(m => m.submittedAt).length
  const totalEmployees = managers.reduce((sum, m) => sum + m.directReportCount, 0)
  const statusLabel = cycle.status === 'draft' ? 'Draft' : cycle.status === 'active' ? 'Active' : 'Closed'

  return (
    <div>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-[17px] font-bold">{cycle.name} — Overview</h1>
          <p className="text-xs text-gray-400 mt-0.5">{statusLabel} · {managers.length} managers</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/api/export?cycleId=${cycleId}`}>
            <Button variant="outline" size="sm" className="text-xs">📤 Export CSV</Button>
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { value: submittedCount, label: 'Submitted', highlight: true },
          { value: managers.length - submittedCount, label: 'Pending' },
          { value: managers.length, label: 'Total Managers' },
          { value: totalEmployees, label: 'Employees in Cycle' },
        ].map(stat => (
          <div
            key={stat.label}
            className={`rounded-xl border p-4 ${stat.highlight ? 'bg-[#f0e8ff] border-[#ddd0f5]' : 'bg-[#fafafa] border-gray-100'}`}
          >
            <p className={`text-3xl font-black ${stat.highlight ? 'text-[#7B2FBE]' : 'text-gray-900'}`}>{stat.value}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <CompletionTable managers={managers} cycleId={cycleId} />
    </div>
  )
}
