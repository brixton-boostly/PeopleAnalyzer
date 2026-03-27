'use client'
import { NineBoxCell } from './NineBoxCell'
import { NINE_BOX_CELLS } from '@/lib/types'
import type { PerfLevel, DirectReport, Review } from '@/lib/types'

const PERF_LEVELS: PerfLevel[] = ['low', 'medium', 'high']
const POT_LEVELS: PerfLevel[] = ['high', 'medium', 'low']

interface Props {
  reviews: Review[]
  directReports: DirectReport[]
  selectedEmployee: DirectReport | null
  onPlace: (performance: PerfLevel, potential: PerfLevel) => void
  readOnly?: boolean
}

export function NineBoxGrid({ reviews, directReports, selectedEmployee, onPlace, readOnly = false }: Props) {
  const drById = new Map(directReports.map(d => [d.id, d]))

  return (
    <div className="flex-1 p-5">
      {/* Column headers */}
      <div className="flex ml-[78px] mb-1 gap-1">
        {PERF_LEVELS.map(p => (
          <div key={p} className="flex-1 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {p.charAt(0).toUpperCase() + p.slice(1)} Performance
          </div>
        ))}
      </div>

      {POT_LEVELS.map(pot => (
        <div key={pot} className="flex gap-1 mb-1 items-stretch">
          <div className="w-[74px] min-w-[74px] flex items-center justify-end pr-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {pot.charAt(0).toUpperCase() + pot.slice(1)} Potential
          </div>
          {PERF_LEVELS.map(perf => {
            const cellDef = NINE_BOX_CELLS.find(c => c.performance === perf && c.potential === pot)!
            const placed = reviews.filter(r => r.performance === perf && r.potential === pot)
            const names = placed.map(r => drById.get(r.direct_report_id)?.full_name ?? '').filter(Boolean)
            return (
              <NineBoxCell
                key={`${perf}-${pot}`}
                cell={cellDef}
                placedNames={names}
                onPlace={onPlace}
                isDropTarget={selectedEmployee !== null && !readOnly}
                selectedEmployee={selectedEmployee}
                readOnly={readOnly}
              />
            )
          })}
        </div>
      ))}

      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 text-center mt-2 ml-[78px]">
        Performance (Low → High)
      </p>
    </div>
  )
}
