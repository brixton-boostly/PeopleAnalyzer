'use client'
import { useState, useCallback } from 'react'
import { EmployeeSidebar } from './EmployeeSidebar'
import { NineBoxGrid } from './NineBoxGrid'
import { Button } from '@/components/ui/button'
import { NINE_BOX_CELLS } from '@/lib/types'
import type { DirectReport, Review, PerfLevel } from '@/lib/types'

interface Props {
  cycleId: string
  cycleName: string
  directReports: DirectReport[]
  initialReviews: Review[]
  submittedAt: string | null
  managerName: string
}

export function NineBoxView({ cycleId, cycleName, directReports, initialReviews, submittedAt, managerName }: Props) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [selected, setSelected] = useState<DirectReport | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(!!submittedAt)
  const [submittedTime, setSubmittedTime] = useState(submittedAt)

  // Comments — keyed by directReportId
  const [commentMap, setCommentMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const r of initialReviews) {
      if (r.comments) map[r.direct_report_id] = r.comments
    }
    return map
  })
  const [justPlacedDrId, setJustPlacedDrId] = useState<string | null>(null)
  const [commentSaving, setCommentSaving] = useState(false)
  const [commentSaved, setCommentSaved] = useState(false)

  const placedIds = new Set(reviews.filter(r => r.performance && r.potential).map(r => r.direct_report_id))
  const allPlaced = directReports.every(dr => placedIds.has(dr.id))

  const handlePlace = useCallback(async (performance: PerfLevel, potential: PerfLevel) => {
    if (!selected) return
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycleId, directReportId: selected.id, performance, potential }),
    })
    if (!res.ok) return
    const updated: Review = await res.json()
    setReviews(prev => [...prev.filter(r => r.direct_report_id !== selected.id), updated])
    setJustPlacedDrId(selected.id)
    setCommentSaved(false)
    setSelected(null)
  }, [selected, cycleId])

  async function saveComment(reviewId: string, drId: string, text: string) {
    setCommentSaving(true)
    await fetch('/api/reviews', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewId, comments: text }),
    })
    setCommentSaving(false)
    setCommentSaved(true)
    setCommentMap(prev => ({ ...prev, [drId]: text }))
  }

  async function handleSubmit() {
    setSubmitting(true)
    const res = await fetch('/api/reviews/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycleId }),
    })
    if (res.ok) {
      const { submittedAt: sa } = await res.json()
      setSubmitted(true)
      setSubmittedTime(sa)
    }
    setSubmitting(false)
  }

  // Render the comment panel (Option B — appears below grid after placing)
  function renderCommentPanel() {
    if (!justPlacedDrId || submitted) return null
    const review = reviews.find(r => r.direct_report_id === justPlacedDrId)
    const dr = directReports.find(d => d.id === justPlacedDrId)
    if (!review || !dr) return null
    const cell = NINE_BOX_CELLS.find(c => c.performance === review.performance && c.potential === review.potential)

    return (
      <div className="border-t border-gray-100 px-5 py-4 bg-[#fafafa]">
        <div className="flex justify-between items-center mb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-gray-800">{dr.full_name}</span>
            <span className="text-[12px] text-gray-400">placed as</span>
            <span
              className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
              style={{ background: cell?.color, color: '#374151' }}
            >
              {cell?.label ?? 'Unknown'}
            </span>
          </div>
          <button
            onClick={() => setJustPlacedDrId(null)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors ml-4 shrink-0"
          >
            skip →
          </button>
        </div>
        <textarea
          className="w-full text-[13px] text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#a78bfa] focus:ring-2 focus:ring-[#ede9fe] placeholder-gray-300 font-sans"
          rows={2}
          placeholder={`Optional note about ${dr.full_name.split(' ')[0]}…`}
          value={commentMap[justPlacedDrId] ?? ''}
          onChange={e => {
            setCommentSaved(false)
            setCommentMap(prev => ({ ...prev, [justPlacedDrId]: e.target.value }))
          }}
          onBlur={e => {
            if (review.id) saveComment(review.id, justPlacedDrId, e.target.value)
          }}
        />
        <p className="text-[11px] text-gray-400 mt-1.5">
          {commentSaving ? 'Saving…' : commentSaved ? '✓ Saved' : 'Auto-saves when you click away · optional'}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden max-w-[920px] mx-auto">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-[15px]">People Analyzer</span>
          <span className="bg-[#f0e8ff] text-[#7B2FBE] text-xs font-semibold px-2.5 py-0.5 rounded-full">{cycleName}</span>
        </div>
        <span className="text-xs text-gray-400">{managerName}</span>
      </div>

      <div className="flex min-h-[420px]">
        <EmployeeSidebar
          employees={directReports}
          selectedId={selected?.id ?? null}
          placedIds={placedIds}
          onSelect={(emp) => {
            setSelected(emp)
            setJustPlacedDrId(null)
          }}
          readOnly={submitted}
        />
        <NineBoxGrid
          reviews={reviews}
          directReports={directReports}
          selectedEmployee={selected}
          onPlace={handlePlace}
          readOnly={submitted}
        />
      </div>

      {/* Comment panel — appears after placing someone */}
      {renderCommentPanel()}

      {/* Footer */}
      <div className="bg-[#fafafa] border-t border-gray-100 px-5 py-3 flex justify-between items-center">
        {submitted ? (
          <p className="text-sm text-gray-500">
            Submitted{' '}
            {submittedTime
              ? new Date(submittedTime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              : ''}
          </p>
        ) : (
          <p className="text-sm text-gray-400">
            {allPlaced ? 'All placed — ready to submit' : 'Select a name, then click a cell to place them'}
          </p>
        )}
        {!submitted && (
          <Button
            onClick={handleSubmit}
            disabled={!allPlaced || submitting}
            className="bg-[#7B2FBE] hover:bg-[#6a28a3] disabled:bg-[#e8e0f5] disabled:text-[#b09cc8]"
          >
            {submitting ? 'Submitting…' : 'Submit Review'}
          </Button>
        )}
      </div>
    </div>
  )
}
