'use client'
import { useState } from 'react'
import { NineBoxView } from '@/components/ninebox/NineBoxView'
import { TeamRetros } from './TeamRetros'
import type { DirectReport, Review, Retro, RetroStatus } from '@/lib/types'

interface Props {
  cycleId: string
  cycleName: string
  directReports: DirectReport[]
  initialReviews: Review[]
  submittedAt: string | null
  managerName: string
  retros: Retro[]
  retroStatus: RetroStatus
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

  const retroSubmitted = retros.filter(r => r.submitted_at).length
  const showRetroStats = retroStatus === 'active' || retroStatus === 'closed'

  return (
    <div className="max-w-[920px] mx-auto">
      {/* Manager stats strip */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-3 px-5 py-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{cycleName}</p>
          <p className="text-[13px] font-semibold text-gray-700">Hi {managerName.split(' ')[0]} 👋</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">9-Box</p>
            <p className="text-[13px] font-semibold text-gray-800">
              {submittedAt
                ? <span className="text-green-600">✓ Submitted</span>
                : <span className="text-amber-600">{initialReviews.filter(r => r.performance && r.potential).length}/{directReports.length} rated</span>}
            </p>
          </div>
          {showRetroStats && (
            <div className="text-right border-l border-gray-100 pl-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Team Retro</p>
              <p className="text-[13px] font-semibold text-gray-800">
                <span className={retroSubmitted === directReports.length ? 'text-green-600' : 'text-gray-700'}>
                  {retroSubmitted}/{directReports.length} submitted
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
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
    </div>
  )
}
