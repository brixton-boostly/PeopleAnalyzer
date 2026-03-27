'use client'
import { useState } from 'react'
import { NINE_BOX_CELLS } from '@/lib/types'
import type { PerfLevel } from '@/lib/types'

interface ResultRow {
  reviewId: string
  managerName: string
  employeeName: string
  jobTitle: string | null
  performance: PerfLevel | null
  potential: PerfLevel | null
  submittedAt: string | null
}

interface Props {
  rows: ResultRow[]
}

export function ResultsTable({ rows }: Props) {
  const [filterManager, setFilterManager] = useState('')
  const [filterCell, setFilterCell] = useState('')

  const managers = [...new Set(rows.map(r => r.managerName))].sort()

  const filtered = rows.filter(r => {
    if (filterManager && r.managerName !== filterManager) return false
    if (filterCell) {
      const cell = NINE_BOX_CELLS.find(c => c.label === filterCell)
      if (cell && (r.performance !== cell.performance || r.potential !== cell.potential)) return false
    }
    return true
  })

  function getCellLabel(perf: PerfLevel | null, pot: PerfLevel | null) {
    if (!perf || !pot) return '—'
    return NINE_BOX_CELLS.find(c => c.performance === perf && c.potential === pot)?.label ?? '—'
  }

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <select
          value={filterManager}
          onChange={e => setFilterManager(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">All Managers</option>
          {managers.map(m => <option key={m}>{m}</option>)}
        </select>
        <select
          value={filterCell}
          onChange={e => setFilterCell(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">All Quadrants</option>
          {NINE_BOX_CELLS.map(c => <option key={c.label}>{c.label}</option>)}
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Manager</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Employee</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Placement</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr key={row.reviewId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5">{row.managerName}</td>
                <td className="px-4 py-2.5">
                  <p>{row.employeeName}</p>
                  {row.jobTitle && <p className="text-xs text-gray-400">{row.jobTitle}</p>}
                </td>
                <td className="px-4 py-2.5">
                  <span className="bg-[#ede9fe] text-[#7B2FBE] rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                    {getCellLabel(row.performance, row.potential)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">
                  {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-2">{filtered.length} of {rows.length} results</p>
    </div>
  )
}
