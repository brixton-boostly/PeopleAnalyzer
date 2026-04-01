'use client'
import { useState } from 'react'
import { NINE_BOX_CELLS } from '@/lib/types'
import type { PerfLevel, RetroResponse } from '@/lib/types'

interface ResultRow {
  reviewId: string
  employeeId: string
  managerName: string
  employeeName: string
  jobTitle: string | null
  performance: PerfLevel | null
  potential: PerfLevel | null
  comments: string | null
  submittedAt: string | null
}

interface RetroRow {
  id: string
  employeeId: string
  responses: RetroResponse[]
  submittedAt: string | null
  managerComment: string | null
}

interface Props {
  rows: ResultRow[]
  retros: RetroRow[]
  totalManagers: number
  submittedManagers: number
  totalEmployees: number
  submittedRetros: number
}

const POTENTIAL_ORDER: PerfLevel[] = ['high', 'medium', 'low']
const PERFORMANCE_ORDER: PerfLevel[] = ['low', 'medium', 'high']

export function ResultsTable({
  rows,
  retros,
  totalManagers,
  submittedManagers,
  totalEmployees,
  submittedRetros,
}: Props) {
  const [filterManager, setFilterManager] = useState('')
  const [filterCell, setFilterCell] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'list' | 'ninebox'>('list')
  const [tooltip, setTooltip] = useState<string | null>(null)
  const [selectedRetroEmployeeId, setSelectedRetroEmployeeId] = useState<string | null>(null)

  const managers = [...new Set(rows.map(r => r.managerName))].sort()
  const retroByEmployee = new Map(retros.map(r => [r.employeeId, r]))

  const filtered = rows.filter(r => {
    if (filterManager && r.managerName !== filterManager) return false
    if (filterCell) {
      const cell = NINE_BOX_CELLS.find(c => c.label === filterCell)
      if (cell && (r.performance !== cell.performance || r.potential !== cell.potential)) return false
    }
    if (search) {
      const q = search.toLowerCase()
      return r.employeeName.toLowerCase().includes(q) || r.managerName.toLowerCase().includes(q) || (r.jobTitle ?? '').toLowerCase().includes(q)
    }
    return true
  })

  function getCellForRow(perf: PerfLevel | null, pot: PerfLevel | null) {
    if (!perf || !pot) return null
    return NINE_BOX_CELLS.find(c => c.performance === perf && c.potential === pot) ?? null
  }

  function getCellLabel(perf: PerfLevel | null, pot: PerfLevel | null) {
    return getCellForRow(perf, pot)?.label ?? '—'
  }

  // KPI: needs attention = low performance OR low potential
  const needsAttention = rows.filter(r => r.performance === 'low' || r.potential === 'low').length

  // KPI: top placement
  const labelCounts = new Map<string, number>()
  for (const r of rows) {
    const label = getCellLabel(r.performance, r.potential)
    if (label !== '—') labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1)
  }
  const topLabel = [...labelCounts.entries()].sort((a, b) => b[1] - a[1])[0]

  const selectedRetro = selectedRetroEmployeeId ? retroByEmployee.get(selectedRetroEmployeeId) : null
  const selectedRow = selectedRetroEmployeeId ? rows.find(r => r.employeeId === selectedRetroEmployeeId) : null

  return (
    <div>
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">9-Box Complete</p>
          <p className="text-2xl font-black text-gray-900">
            {submittedManagers}<span className="text-[13px] font-normal text-gray-400">/{totalManagers}</span>
          </p>
          <p className="text-[11px] text-green-600 font-semibold mt-1">
            {totalManagers > 0 ? Math.round((submittedManagers / totalManagers) * 100) : 0}%
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Retro Complete</p>
          <p className="text-2xl font-black text-gray-900">
            {submittedRetros}<span className="text-[13px] font-normal text-gray-400">/{totalEmployees}</span>
          </p>
          <p className="text-[11px] text-green-600 font-semibold mt-1">
            {totalEmployees > 0 ? Math.round((submittedRetros / totalEmployees) * 100) : 0}%
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Top Placement</p>
          <p className="text-[15px] font-black text-gray-900 leading-tight">{topLabel?.[0] ?? '—'}</p>
          <p className="text-[11px] text-gray-400 mt-1">{topLabel?.[1] ?? 0} employees</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Needs Attention</p>
          <p className="text-2xl font-black text-gray-900">{needsAttention}</p>
          <p className="text-[11px] text-amber-600 font-semibold mt-1">Low perf or potential</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search employees…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#a78bfa] focus:ring-2 focus:ring-[#ede9fe] w-52"
          />
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
                  <th className="text-center px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Retro</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => {
                  const cell = getCellForRow(row.performance, row.potential)
                  const retro = retroByEmployee.get(row.employeeId)
                  return (
                    <tr key={row.reviewId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2.5">{row.managerName}</td>
                      <td className="px-4 py-2.5">
                        <p>{row.employeeName}</p>
                        {row.jobTitle && <p className="text-xs text-gray-400">{row.jobTitle}</p>}
                      </td>
                      <td className="px-4 py-2.5">
                        {cell ? (
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                            style={{ background: cell.color, color: cell.textColor }}
                          >
                            {cell.label}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[200px]">
                        {row.comments
                          ? <span className="italic">{row.comments}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">
                        {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {retro?.submittedAt ? (
                          <button
                            onClick={() => setSelectedRetroEmployeeId(row.employeeId)}
                            className="text-[11px] font-semibold text-[#7B2FBE] border border-[#ddd0f5] rounded-lg px-2.5 py-1 hover:bg-[#f0e8ff] transition-colors"
                          >
                            View
                          </button>
                        ) : (
                          <span className="text-gray-300 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
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
            <div className="flex flex-col items-center justify-center w-5 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 rotate-[-90deg] whitespace-nowrap">
                Potential ↑
              </span>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-3 gap-2 mb-1 pl-[52px]">
                {(['Low', 'Medium', 'High'] as const).map(l => (
                  <div key={l} className="text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">{l}</div>
                ))}
              </div>
              {POTENTIAL_ORDER.map(pot => (
                <div key={pot} className="flex gap-2 mb-2 items-stretch">
                  <div className="w-12 shrink-0 flex items-center justify-end pr-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 capitalize">{pot}</span>
                  </div>
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
              <div className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-1">
                Performance →
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">{filtered.length} placements · hover a name to see notes</p>
        </div>
      )}

      {/* Retro slide-over */}
      {selectedRetro && selectedRow && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/30"
            onClick={() => setSelectedRetroEmployeeId(null)}
          />
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[15px] font-bold">{selectedRow.employeeName}</p>
                <p className="text-xs text-gray-400">{selectedRow.managerName}</p>
              </div>
              <button
                onClick={() => setSelectedRetroEmployeeId(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-light"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-5">
              {selectedRetro.responses.map((r, i) => (
                <div key={i}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#7B2FBE] mb-1">{r.question}</p>
                  <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">{r.answer}</p>
                </div>
              ))}
              {selectedRetro.managerComment && (
                <div className="bg-[#f0e8ff] border border-[#ddd0f5] rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#7B2FBE] mb-1">Manager Feedback</p>
                  <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedRetro.managerComment}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
