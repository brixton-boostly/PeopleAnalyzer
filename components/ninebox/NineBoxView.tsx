'use client'
import { useState, useCallback } from 'react'
import { EmployeeSidebar } from './EmployeeSidebar'
import { NineBoxGrid } from './NineBoxGrid'
import { Button } from '@/components/ui/button'
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
    setSelected(null)
  }, [selected, cycleId])

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
          onSelect={setSelected}
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
