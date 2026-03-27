'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface ManagerRow {
  id: string
  name: string
  email: string
  directReportCount: number
  submittedAt: string | null
}

interface Props {
  managers: ManagerRow[]
  cycleId: string
}

export function CompletionTable({ managers, cycleId }: Props) {
  const [nudging, setNudging] = useState<string | null>(null)

  async function nudge(managerId: string | null) {
    setNudging(managerId ?? 'all')
    await fetch('/api/nudge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(managerId ? { managerId } : { cycleId, all: true }),
    })
    setNudging(null)
  }

  const pending = managers.filter(m => !m.submittedAt)

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-[13px] font-bold text-gray-700">Manager Completion</p>
        {pending.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => nudge(null)}
            disabled={nudging === 'all'}
            className="text-amber-700 border-yellow-300 bg-amber-50 hover:bg-amber-100 text-xs"
          >
            {nudging === 'all' ? 'Sending…' : `📣 Nudge All Pending (${pending.length})`}
          </Button>
        )}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Manager</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Reports</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Status</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Submitted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {managers.map(m => (
              <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#ede9fe] text-[#7B2FBE] flex items-center justify-center text-[11px] font-bold">
                      {m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    {m.name}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-gray-500">{m.directReportCount}</td>
                <td className="px-4 py-2.5">
                  {m.submittedAt
                    ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Submitted</Badge>
                    : <Badge className="bg-orange-50 text-orange-700 hover:bg-orange-50">Pending</Badge>
                  }
                </td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">
                  {m.submittedAt
                    ? new Date(m.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '—'}
                </td>
                <td className="px-4 py-2.5">
                  {m.submittedAt
                    ? (
                      <Link
                        href={`/admin/${cycleId}/results?manager=${m.id}`}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-[#7B2FBE] text-xs font-medium hover:bg-[#f0e8ff] transition-colors"
                      >
                        View →
                      </Link>
                    )
                    : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => nudge(m.id)}
                        disabled={nudging === m.id}
                        className="text-amber-700 border-yellow-300 bg-amber-50 hover:bg-amber-100 text-xs"
                      >
                        {nudging === m.id ? 'Sending…' : '📣 Nudge'}
                      </Button>
                    )
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
