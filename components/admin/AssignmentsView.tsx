'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface EmployeeRow {
  employeeId: string
  employeeName: string
  jobTitle: string | null
  managerId: string
  managerName: string
  reviewSubmittedAt: string | null
  retroSubmittedAt: string | null
}

interface Props {
  cycleId: string
  cycleName: string
  retroStatus: 'draft' | 'active' | 'closed'
  retroQuestions: string[]
  employees: EmployeeRow[]
  totalManagers: number
  submittedManagerCount: number
}

export function AssignmentsView({
  cycleId,
  cycleName,
  retroStatus,
  retroQuestions,
  employees,
  totalManagers,
  submittedManagerCount,
}: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [questions, setQuestions] = useState<string[]>(retroQuestions)
  const [launching, setLaunching] = useState(false)
  const [launched, setLaunched] = useState(false)
  const [filterManager, setFilterManager] = useState('')
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const submittedRetros = employees.filter(e => e.retroSubmittedAt).length
  const uniqueManagers = [...new Set(employees.map(e => e.managerName))].sort()

  const filtered = employees.filter(e => {
    if (filterManager && e.managerName !== filterManager) return false
    if (search) {
      const q = search.toLowerCase()
      return e.employeeName.toLowerCase().includes(q) || e.managerName.toLowerCase().includes(q) || (e.jobTitle ?? '').toLowerCase().includes(q)
    }
    return true
  })

  async function launchRetro() {
    setLaunching(true)
    try {
      const res = await fetch('/api/retro/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycleId, questions }),
      })
      if (res.ok) {
        setLaunched(true)
        setShowModal(false)
        router.refresh()
      }
    } finally {
      setLaunching(false)
    }
  }

  async function copyRetroLink(employeeId: string) {
    try {
      const res = await fetch('/api/retro/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, cycleId }),
      })
      if (!res.ok) return
      const { url } = await res.json()
      if (!url) return
      await navigator.clipboard.writeText(url)
      setCopiedId(employeeId)
      setTimeout(() => setCopiedId(prev => (prev === employeeId ? null : prev)), 2000)
    } catch {
      // clipboard write failed silently
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[17px] font-bold">{cycleName} — Assignments</h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* People Analyzer card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">People Analyzer</p>
            <span className="text-[10px] font-bold text-green-700 bg-green-50 rounded-full px-2 py-0.5">Active</span>
          </div>
          <p className="text-2xl font-black text-gray-900">
            {submittedManagerCount}
            <span className="text-[14px] font-normal text-gray-400"> of {totalManagers} submitted</span>
          </p>
          <div className="bg-gray-100 rounded-full h-1.5 mt-3 mb-3">
            <div
              className="bg-[#7B2FBE] h-1.5 rounded-full transition-all"
              style={{ width: totalManagers > 0 ? `${(submittedManagerCount / totalManagers) * 100}%` : '0%' }}
            />
          </div>
        </div>

        {/* Retro card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Retro</p>
            {retroStatus === 'draft' ? (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">Not Launched</span>
            ) : (
              <span className="text-[10px] font-bold text-green-700 bg-green-50 rounded-full px-2 py-0.5">Active</span>
            )}
          </div>
          <p className="text-2xl font-black text-gray-900">
            {submittedRetros}
            <span className="text-[14px] font-normal text-gray-400"> of {employees.length} submitted</span>
          </p>
          <div className="bg-gray-100 rounded-full h-1.5 mt-3 mb-3">
            <div
              className="bg-[#7B2FBE] h-1.5 rounded-full transition-all"
              style={{ width: employees.length > 0 ? `${(submittedRetros / employees.length) * 100}%` : '0%' }}
            />
          </div>
          {retroStatus === 'draft' && (
            <button
              onClick={() => setShowModal(true)}
              className="w-full mt-1 text-[12px] font-bold text-[#7B2FBE] border border-[#7B2FBE] rounded-lg px-3 py-1.5 hover:bg-[#f0e8ff] transition-colors"
            >
              ✎ Edit Questions · Launch Retro
            </button>
          )}
          {launched && (
            <p className="text-[11px] text-green-600 font-semibold mt-2 text-center">✓ Links sent</p>
          )}
        </div>
      </div>

      {/* Filter + table */}
      <div className="flex items-center gap-3 mb-3">
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
          {uniqueManagers.map(m => <option key={m}>{m}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{employees.length} employees · {totalManagers} managers</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Employee</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Manager</th>
              <th className="text-center px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">9-Box</th>
              <th className="text-center px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Retro</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(emp => (
              <tr key={emp.employeeId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <p className="font-semibold">{emp.employeeName}</p>
                  {emp.jobTitle && <p className="text-xs text-gray-400">{emp.jobTitle}</p>}
                </td>
                <td className="px-4 py-2.5 text-gray-500">{emp.managerName}</td>
                <td className="px-4 py-2.5 text-center">
                  {emp.reviewSubmittedAt
                    ? <span className="text-[11px] font-bold text-green-600">✓ Done</span>
                    : <span className="text-[11px] font-semibold text-amber-600">Pending</span>}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {retroStatus === 'draft'
                    ? <span className="text-[11px] text-gray-300">—</span>
                    : emp.retroSubmittedAt
                    ? <span className="text-[11px] font-bold text-green-600">✓ Done</span>
                    : <span className="text-[11px] font-semibold text-amber-600">Pending</span>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {retroStatus !== 'draft' && (
                    <button
                      onClick={() => copyRetroLink(emp.employeeId)}
                      className="text-[11px] border border-gray-200 rounded-lg px-2.5 py-1 bg-white text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      {copiedId === emp.employeeId ? '✓ Copied' : '🔗 Retro Link'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Launch Retro modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-[16px] font-bold mb-1">Launch Retro</h2>
            <p className="text-xs text-gray-400 mb-5">Edit questions if needed, then launch. Employees will receive a Slack DM with their link.</p>
            <div className="flex flex-col gap-4 mb-6">
              {questions.map((q, i) => (
                <div key={i}>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Question {i + 1}</label>
                  <textarea
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-700 resize-none focus:outline-none focus:border-[#a78bfa] focus:ring-2 focus:ring-[#ede9fe] font-sans"
                    rows={2}
                    value={q}
                    onChange={e => setQuestions(prev => { const next = [...prev]; next[i] = e.target.value; return next })}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="text-sm text-gray-500 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={launchRetro}
                disabled={launching}
                className="text-sm font-bold text-white bg-[#7B2FBE] hover:bg-[#6a28a3] rounded-lg px-4 py-2 disabled:bg-[#e8e0f5] disabled:text-[#b09cc8] transition-colors"
              >
                {launching ? 'Launching…' : 'Launch Retro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
