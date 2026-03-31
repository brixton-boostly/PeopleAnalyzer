'use client'
import { useState } from 'react'
import { NineBoxView } from '@/components/ninebox/NineBoxView'
import { TeamRetros } from './TeamRetros'
import type { DirectReport, Review, Retro } from '@/lib/types'

interface Props {
  cycleId: string
  cycleName: string
  directReports: DirectReport[]
  initialReviews: Review[]
  submittedAt: string | null
  managerName: string
  retros: Retro[]
  retroStatus: string
}

export function ReviewTabsView({
  cycleId,
  cycleName,
  directReports,
  initialReviews,
  submittedAt,
  managerName,
  retros,
  retroStatus,
}: Props) {
  const [tab, setTab] = useState<'ninebox' | 'retros'>('ninebox')

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden max-w-[920px] mx-auto">
      {/* Tab bar */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setTab('ninebox')}
          className={`px-5 py-3 text-[13px] font-semibold transition-colors ${
            tab === 'ninebox'
              ? 'text-[#7B2FBE] border-b-2 border-[#7B2FBE]'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          9-Box
        </button>
        {retroStatus === 'active' || retroStatus === 'closed' ? (
          <button
            onClick={() => setTab('retros')}
            className={`px-5 py-3 text-[13px] font-semibold transition-colors ${
              tab === 'retros'
                ? 'text-[#7B2FBE] border-b-2 border-[#7B2FBE]'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Team Retros
            {retros.filter(r => r.submitted_at).length > 0 && (
              <span className="ml-1.5 bg-[#ede9fe] text-[#7B2FBE] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {retros.filter(r => r.submitted_at).length}
              </span>
            )}
          </button>
        ) : null}
      </div>

      {tab === 'ninebox' ? (
        <NineBoxView
          cycleId={cycleId}
          cycleName={cycleName}
          directReports={directReports}
          initialReviews={initialReviews}
          submittedAt={submittedAt}
          managerName={managerName}
          hideBorder
        />
      ) : (
        <TeamRetros
          cycleName={cycleName}
          directReports={directReports}
          retros={retros}
        />
      )}
    </div>
  )
}
