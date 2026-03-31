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
  comments: string | null
  submittedAt: string | null
}

interface Props {
  rows: ResultRow[]
}

const POTENTIAL_ORDER: PerfLevel[] = ['high', 'medium', 'low']
const PERFORMANCE_ORDER: PerfLevel[] = ['low', 'medium', 'high']

export function ResultsTable({ rows }: Props) {
  const [filterManager, setFilterManager] = useState('')
  const [filterCell, setFilterCell] = useState('')
  const [view, setView] = useState<'list' | 'ninebox'>('list')
  const [tooltip, setTooltip] = useState<string | null>(null)

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
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-3">
          <select
            value={filterManager}
            onChange={e => setFilterManager(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="">All Managers</option>
            {managers.map(m => <option key={m}>{m}</option>)}
          </select>
          {view === 'list' && (
            <select
              value={filterCell}
              onChange={e => setFilterCell(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
            >
              <option value="">All Quadrants</option>
              {NINE_BOX_CELLS.map(c => <option key={c.label}>{c.label}</option>)}
            </select>
          )}
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white text-[13px]">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 transition-colors ${view === 'list' ? 'bg-[#7B2FBE] text-white font-semibold' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            ☰ List
          </button>
          <button
            onClick={() => setView('ninebox')}
            className={`px-3 py-1.5 border-l border-gray-200 transition-colors ${view === 'ninebox' ? 'bg-[#7B2FBE] text-white font-semibold' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            ⊞ 9-Box
          </button>
        </div>
      </div>

      {/* List view */}
      {view === 'list' && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Manager</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Employee</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Placement</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Note</th>
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
                    <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[220px]">
                      {row.comments
                        ? <span className="italic">{row.comments}</span>
                        : <span className="text-gray-300">—</span>}
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
        </>
      )}

      {/* 9-Box view */}
      {view === 'ninebox' && (
        <div className="relative">
          <div className="flex gap-3">
            {/* Y-axis label */}
            <div className="flex flex-col items-center justify-center w-5 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 rotate-[-90deg] whitespace-nowrap">
                Potential ↑
              </span>
            </div>

            <div className="flex-1">
              {/* Y-axis tier labels */}
              <div className="grid grid-cols-3 gap-2 mb-1 pl-[52px]">
                {(['Low', 'Medium', 'High'] as const).map(l => (
                  <div key={l} className="text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">{l}</div>
                ))}
              </div>

              {/* Grid rows (high potential at top) */}
              {POTENTIAL_ORDER.map(pot => (
                <div key={pot} className="flex gap-2 mb-2 items-stretch">
                  {/* Row label */}
                  <div className="w-12 shrink-0 flex items-center justify-end pr-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 capitalize">{pot}</span>
                  </div>

                  {/* 3 cells */}
                  {PERFORMANCE_ORDER.map(perf => {
                    const cell = NINE_BOX_CELLS.find(c => c.performance === perf && c.potential === pot)!
                    const occupants = filtered.filter(r => r.performance === perf && r.potential === pot)

                    return (
                      <div
                        key={perf}
                        className="flex-1 rounded-xl p-3 min-h-[110px] flex flex-col gap-1.5"
                        style={{ background: cell.color }}
                      >
                        <p className="text-[10px] font-bold text-gray-600 leading-tight">{cell.label}</p>
                        <p className="text-[9px] text-gray-400 leading-tight mb-1">{cell.description}</p>
                        <div className="flex flex-col gap-1">
                          {occupants.map(r => (
                            <div
                              key={r.reviewId}
                              className="group relative"
                              onMouseEnter={() => setTooltip(r.reviewId)}
                              onMouseLeave={() => setTooltip(null)}
                            >
                              <div className="bg-white/80 backdrop-blur-sm rounded-lg px-2 py-1 cursor-default">
                                <p className="text-[11px] font-semibold text-gray-800 leading-tight truncate">{r.employeeName}</p>
                                {!filterManager && (
                                  <p className="text-[10px] text-gray-400 leading-tight truncate">{r.managerName}</p>
                                )}
                              </div>
                              {/* Tooltip with comment */}
                              {tooltip === r.reviewId && r.comments && (
                                <div className="absolute z-10 bottom-full left-0 mb-1 w-48 bg-gray-900 text-white text-[11px] rounded-lg px-2.5 py-2 shadow-lg pointer-events-none">
                                  <p className="italic">{r.comments}</p>
                                </div>
                              )}
                            </div>
                          ))}
                          {occupants.length === 0 && (
                            <p className="text-[10px] text-gray-300 italic">—</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}

              {/* X-axis label */}
              <div className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-1">
                Performance →
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">{filtered.length} placements · hover a name to see notes</p>
        </div>
      )}
    </div>
  )
}
