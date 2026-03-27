'use client'
import { useState } from 'react'
import type { NineBoxCell as CellDef, PerfLevel, DirectReport } from '@/lib/types'

interface Props {
  cell: CellDef
  placedNames: string[]
  onPlace: (performance: PerfLevel, potential: PerfLevel) => void
  isDropTarget: boolean
  selectedEmployee: Pick<DirectReport, 'id' | 'full_name' | 'job_title'> | null
  readOnly?: boolean
}

const SHOW_COUNT = 4

export function NineBoxCell({ cell, placedNames, onPlace, isDropTarget, selectedEmployee, readOnly = false }: Props) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? placedNames : placedNames.slice(0, SHOW_COUNT)
  const overflow = placedNames.length - SHOW_COUNT

  function handleClick() {
    if (!readOnly && selectedEmployee) {
      onPlace(cell.performance, cell.potential)
    }
  }

  return (
    <button
      role="button"
      onClick={handleClick}
      className={[
        'flex-1 min-h-[100px] rounded-lg p-2.5 text-left border-[1.5px] transition-colors',
        isDropTarget ? 'border-purple-400 border-dashed' : 'border-transparent',
        !readOnly && selectedEmployee ? 'cursor-pointer hover:border-purple-400' : 'cursor-default',
      ].join(' ')}
      style={{ background: cell.color }}
      disabled={readOnly || !selectedEmployee}
    >
      <p className="text-[11px] font-bold text-gray-900 mb-0.5">{cell.label}</p>
      <p className="text-[10px] text-gray-500 mb-2 leading-snug">{cell.description}</p>
      <div className="flex flex-wrap gap-1">
        {visible.map(name => (
          <span key={name} className="bg-[#ede9fe] text-[#7B2FBE] rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
            {name}
          </span>
        ))}
        {!expanded && overflow > 0 && (
          <button
            onClick={e => { e.stopPropagation(); setExpanded(true) }}
            className="bg-[#f5f3ff] text-purple-600 border border-dashed border-purple-300 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          >
            +{overflow} more
          </button>
        )}
      </div>
    </button>
  )
}
