'use client'
import { useState } from 'react'
import type { DirectReport, Retro } from '@/lib/types'

interface Props {
  cycleName: string
  directReports: DirectReport[]
  retros: Retro[]
}

export function TeamRetros({ cycleName, directReports, retros }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [commentMap, setCommentMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const r of retros) {
      if (r.manager_comment) map[r.id] = r.manager_comment
    }
    return map
  })
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const retroByEmployee = new Map(retros.map(r => [r.employee_id, r]))
  const drIdSet = new Set(directReports.map(dr => dr.id))
  const submittedCount = retros.filter(r => r.submitted_at && drIdSet.has(r.employee_id)).length

  async function saveComment(retroId: string, comment: string) {
    setSavingId(retroId)
    try {
      const res = await fetch('/api/retro/comment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retroId, comment }),
      })
      if (res.ok) {
        setSavedId(retroId)
        setTimeout(() => setSavedId(prev => (prev === retroId ? null : prev)), 2000)
      }
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="p-5">
      <p className="text-xs text-gray-400 mb-4">{cycleName} · {submittedCount} of {directReports.length} submitted</p>
      <div className="flex flex-col gap-3">
        {directReports.map(dr => {
          const retro = retroByEmployee.get(dr.id)
          const isSubmitted = !!retro?.submitted_at
          const isExpanded = expandedId === dr.id

          return (
            <div key={dr.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                onClick={() => isSubmitted && setExpandedId(isExpanded ? null : dr.id)}
                disabled={!isSubmitted}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isSubmitted ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <p className="text-[13px] font-semibold text-gray-800">{dr.full_name}</p>
                    {dr.job_title && <p className="text-[11px] text-gray-400">{dr.job_title}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isSubmitted ? (
                    <span className="text-[11px] font-semibold text-green-600">
                      Submitted {retro?.submitted_at ? new Date(retro.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                    </span>
                  ) : (
                    <span className="text-[11px] text-gray-400">Not submitted</span>
                  )}
                  {isSubmitted && <span className="text-gray-400 text-sm">{isExpanded ? '▾' : '›'}</span>}
                </div>
              </button>

              {isExpanded && retro && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                  <div className="flex flex-col gap-4 mb-4">
                    {(retro.responses ?? []).map((r, i) => (
                      <div key={i}>
                        <p className="text-[10px] font-bold tracking-widest text-[#7B2FBE] uppercase mb-1">{r.question}</p>
                        <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">{r.answer}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-2">Your Feedback</p>
                    <textarea
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-700 resize-none focus:outline-none focus:border-[#a78bfa] focus:ring-2 focus:ring-[#ede9fe] placeholder-gray-300 font-sans"
                      rows={3}
                      placeholder={`Leave a note for ${dr.full_name.split(' ')[0]}…`}
                      value={commentMap[retro.id] ?? ''}
                      onChange={e => setCommentMap(prev => ({ ...prev, [retro.id]: e.target.value }))}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[11px] text-gray-400">
                        {savingId === retro.id ? 'Saving…' : savedId === retro.id ? '✓ Saved' : ''}
                      </p>
                      <button
                        onClick={() => saveComment(retro.id, commentMap[retro.id] ?? '')}
                        className="text-xs font-bold text-white bg-[#7B2FBE] hover:bg-[#6a28a3] rounded-lg px-3 py-1.5 transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
