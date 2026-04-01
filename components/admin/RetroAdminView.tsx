'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RetroStatus } from '@/lib/types'

interface Employee {
  id: string
  full_name: string
  job_title: string | null
  manager_name: string
  slack_user_id: string | null
}

interface RetroRow {
  employee_id: string
  submitted_at: string | null
  responses: { question: string; answer: string }[]
  manager_comment: string | null
}

interface Props {
  cycleId: string
  cycleName: string
  retroStatus: RetroStatus
  initialQuestions: string[]
  initialParticipantIds: string[]
  allEmployees: Employee[]
  retros: RetroRow[]
}

export function RetroAdminView({
  cycleId,
  cycleName,
  retroStatus,
  initialQuestions,
  initialParticipantIds,
  allEmployees,
  retros,
}: Props) {
  const router = useRouter()

  // Active tab — Setup is default pre-launch; Responses is default post-launch
  const [tab, setTab] = useState<'setup' | 'responses'>(
    retroStatus === 'draft' ? 'setup' : 'responses'
  )

  // ── Setup tab state ──────────────────────────────────────────
  const [questions, setQuestions] = useState<string[]>(
    initialQuestions.length > 0
      ? initialQuestions
      : ['What accomplishments are you most proud of this quarter, and what made them possible?',
         'Where did I fall short of my goals, and what would I do differently?',
         'What do I need — from my manager, team, or company — to be more effective next quarter?']
  )

  const defaultSelectedIds = new Set(
    initialParticipantIds.length > 0
      ? initialParticipantIds
      : allEmployees.map(e => e.id)
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(defaultSelectedIds)
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)

  // ── Responses tab state ──────────────────────────────────────
  const [selectedRetro, setSelectedRetro] = useState<RetroRow | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

  // Derived
  const retroMap = new Map(retros.map(r => [r.employee_id, r]))
  const participantEmployees =
    initialParticipantIds.length > 0
      ? allEmployees.filter(e => initialParticipantIds.includes(e.id))
      : allEmployees
  const submittedCount = retros.filter(r => r.submitted_at).length

  const canLaunch =
    selectedIds.size > 0 &&
    questions.length > 0 &&
    questions.every(q => q.trim().length > 0) &&
    !launching

  // ── Handlers ────────────────────────────────────────────────
  function updateQuestion(index: number, value: string) {
    setQuestions(prev => prev.map((q, i) => (i === index ? value : q)))
  }

  function removeQuestion(index: number) {
    if (questions.length <= 1) return
    setQuestions(prev => prev.filter((_, i) => i !== index))
  }

  function addQuestion() {
    setQuestions(prev => [...prev, ''])
  }

  function toggleEmployee(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(allEmployees.map(e => e.id)))
  }

  function clearAll() {
    setSelectedIds(new Set())
  }

  async function launchRetro() {
    setLaunching(true)
    setLaunchError(null)
    try {
      const res = await fetch('/api/retro/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycleId, questions, participantIds: [...selectedIds] }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const body = await res.json().catch(() => ({}))
        setLaunchError((body as { error?: string }).error ?? 'Launch failed')
      }
    } catch {
      setLaunchError('Network error')
    } finally {
      setLaunching(false)
    }
  }

  async function copyRetroLink(employeeId: string) {
    setCopyError(null)
    try {
      const res = await fetch('/api/retro/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, cycleId }),
      })
      if (!res.ok) {
        setCopyError(employeeId)
        setTimeout(() => setCopyError(prev => (prev === employeeId ? null : prev)), 2000)
        return
      }
      const { url } = await res.json()
      if (!url) return
      await navigator.clipboard.writeText(url)
      setCopiedId(employeeId)
      setTimeout(() => setCopiedId(prev => (prev === employeeId ? null : prev)), 2000)
    } catch {
      setCopyError(employeeId)
      setTimeout(() => setCopyError(prev => (prev === employeeId ? null : prev)), 2000)
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setTab('setup')}
          className={`px-5 py-3 text-[13px] font-semibold transition-colors ${
            tab === 'setup'
              ? 'text-[#7B2FBE] border-b-2 border-[#7B2FBE]'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Setup
        </button>
        <button
          onClick={() => setTab('responses')}
          className={`px-5 py-3 text-[13px] font-semibold transition-colors ${
            tab === 'responses'
              ? 'text-[#7B2FBE] border-b-2 border-[#7B2FBE]'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          Responses
          {submittedCount > 0 && (
            <span className="ml-1.5 bg-[#ede9fe] text-[#7B2FBE] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {submittedCount}
            </span>
          )}
        </button>
      </div>

      {tab === 'setup' && (
        <div className="max-w-2xl">
          {retroStatus !== 'draft' && (
            <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[13px] text-amber-700">
              Retro has already been launched. Setup is locked.
            </div>
          )}

          {/* Questions */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Questions</p>
              {retroStatus !== 'draft' && (
                <span className="text-[10px] text-gray-400">Locked after launch</span>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {questions.map((q, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                      {String(i + 1).padStart(2, '0')}
                    </label>
                    <textarea
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-700 resize-none focus:outline-none focus:border-[#a78bfa] focus:ring-2 focus:ring-[#ede9fe] placeholder-gray-300 font-sans disabled:bg-gray-50 disabled:text-gray-400"
                      rows={2}
                      value={q}
                      onChange={e => updateQuestion(i, e.target.value)}
                      disabled={retroStatus !== 'draft'}
                      placeholder="Enter question…"
                    />
                  </div>
                  {retroStatus === 'draft' && (
                    <button
                      onClick={() => removeQuestion(i)}
                      disabled={questions.length <= 1}
                      className="mt-7 w-7 h-7 border border-gray-200 rounded-lg bg-white text-gray-400 hover:text-red-500 hover:border-red-200 disabled:opacity-30 disabled:cursor-not-allowed text-sm flex items-center justify-center flex-shrink-0 transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {retroStatus === 'draft' && (
                <button
                  onClick={addQuestion}
                  className="border border-dashed border-[#c4b5fd] rounded-lg px-4 py-2 text-[12px] font-semibold text-[#7B2FBE] hover:bg-[#f5f3ff] transition-colors"
                >
                  + Add question
                </button>
              )}
            </div>
          </div>

          {/* Employee selection */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                Employees{' '}
                <span className="text-[#7B2FBE]">
                  {selectedIds.size} / {allEmployees.length} selected
                </span>
              </p>
              {retroStatus === 'draft' && (
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-[10px] border border-gray-200 rounded-md px-2.5 py-1 bg-white text-gray-500 hover:bg-gray-50"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearAll}
                    className="text-[10px] border border-gray-200 rounded-md px-2.5 py-1 bg-white text-gray-500 hover:bg-gray-50"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Employee</th>
                  <th className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Manager</th>
                  <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Include</th>
                </tr>
              </thead>
              <tbody>
                {allEmployees.map(emp => {
                  const checked = selectedIds.has(emp.id)
                  const noSlack = !emp.slack_user_id
                  return (
                    <tr key={emp.id} className={`border-b border-gray-50 ${noSlack ? 'opacity-50' : ''}`}>
                      <td className="py-2 px-2">
                        <p className={`font-semibold ${noSlack ? 'text-gray-400' : 'text-gray-800'}`}>{emp.full_name}</p>
                        {emp.job_title && <p className="text-[10px] text-gray-400">{emp.job_title}</p>}
                      </td>
                      <td className="py-2 px-2 text-gray-500">{emp.manager_name}</td>
                      <td className="py-2 px-2 text-center">
                        <button
                          onClick={() => retroStatus === 'draft' && toggleEmployee(emp.id)}
                          disabled={retroStatus !== 'draft'}
                          className="w-4 h-4 rounded flex items-center justify-center mx-auto border transition-colors disabled:cursor-default"
                          style={{
                            background: checked ? '#7B2FBE' : 'white',
                            borderColor: checked ? '#7B2FBE' : '#d1d5db',
                          }}
                        >
                          {checked && <span className="text-white text-[9px] font-bold">✓</span>}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Launch */}
          {retroStatus === 'draft' && (
            <>
              {launchError && (
                <p className="text-[12px] text-red-500 mb-2">{launchError}</p>
              )}
              <button
                onClick={launchRetro}
                disabled={!canLaunch}
                className="w-full bg-[#7B2FBE] hover:bg-[#6a28a3] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3 text-[13px] transition-colors"
              >
                {launching
                  ? 'Launching…'
                  : `Launch Retro → Send to ${selectedIds.size} employee${selectedIds.size !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
        </div>
      )}

      {tab === 'responses' && (
        <div>
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3 mb-5 max-w-lg">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Sent to</p>
              <p className="text-2xl font-black text-gray-900">{participantEmployees.length}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Submitted</p>
              <p className="text-2xl font-black text-gray-900">
                {submittedCount}
                {participantEmployees.length > 0 && (
                  <span className="text-[12px] font-semibold text-green-500 ml-1">
                    {Math.round((submittedCount / participantEmployees.length) * 100)}%
                  </span>
                )}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Pending</p>
              <p className="text-2xl font-black text-gray-900">{participantEmployees.length - submittedCount}</p>
            </div>
          </div>

          {/* Response table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden max-w-3xl">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Employee</th>
                  <th className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Manager</th>
                  <th className="text-center py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</th>
                  <th className="text-center py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Action</th>
                </tr>
              </thead>
              <tbody>
                {participantEmployees.map(emp => {
                  const retro = retroMap.get(emp.id)
                  const isSubmitted = !!retro?.submitted_at
                  return (
                    <tr key={emp.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 px-4">
                        <p className="font-semibold text-gray-800">{emp.full_name}</p>
                        {emp.job_title && <p className="text-[10px] text-gray-400">{emp.job_title}</p>}
                      </td>
                      <td className="py-2.5 px-4 text-gray-500">{emp.manager_name}</td>
                      <td className="py-2.5 px-4 text-center">
                        {isSubmitted ? (
                          <span className="text-[11px] font-bold text-green-600">✓ Submitted</span>
                        ) : (
                          <span className="text-[11px] text-amber-500 font-semibold">Pending</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {isSubmitted && retro ? (
                          <button
                            onClick={() => setSelectedRetro(retro)}
                            className="text-[11px] font-semibold text-[#7B2FBE] border border-[#ddd0f5] rounded-md px-3 py-1 hover:bg-[#f5f3ff] transition-colors"
                          >
                            View
                          </button>
                        ) : (
                          <button
                            onClick={() => copyRetroLink(emp.id)}
                            className="text-[11px] text-gray-500 border border-gray-200 rounded-md px-3 py-1 hover:bg-gray-50 transition-colors"
                          >
                            {copiedId === emp.id ? '✓ Copied' : copyError === emp.id ? 'Failed' : 'Copy Link'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-over: view retro responses */}
      {selectedRetro && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSelectedRetro(null)}
          />
          {/* Panel */}
          <div className="relative bg-white w-full max-w-md h-full shadow-xl overflow-y-auto p-6">
            <button
              onClick={() => setSelectedRetro(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              ✕
            </button>
            {(() => {
              const emp = allEmployees.find(e => e.id === selectedRetro.employee_id)
              return (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#7B2FBE] mb-1">Retro</p>
                  <h2 className="text-[16px] font-bold text-gray-900 mb-1">{emp?.full_name ?? 'Employee'}</h2>
                  <p className="text-[12px] text-gray-400 mb-5">
                    {selectedRetro.submitted_at
                      ? `Submitted ${new Date(selectedRetro.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                      : ''}
                  </p>
                  <div className="flex flex-col gap-5 mb-6">
                    {(selectedRetro.responses ?? []).map((r, i) => (
                      <div key={i}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#7B2FBE] mb-1">{r.question}</p>
                        <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{r.answer}</p>
                      </div>
                    ))}
                  </div>
                  {selectedRetro.manager_comment && (
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Manager Note</p>
                      <p className="text-[13px] text-gray-600 leading-relaxed">{selectedRetro.manager_comment}</p>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
