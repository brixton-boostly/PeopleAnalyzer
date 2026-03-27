'use client'
import type { DirectReport } from '@/lib/types'

interface Props {
  employees: DirectReport[]
  selectedId: string | null
  placedIds: Set<string>
  onSelect: (employee: DirectReport) => void
  readOnly?: boolean
}

export function EmployeeSidebar({ employees, selectedId, placedIds, onSelect, readOnly = false }: Props) {
  return (
    <div className="w-[185px] min-w-[185px] bg-[#fafafa] border-r border-gray-100 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-2.5 px-1">
        Your Team ({employees.length})
      </p>
      {employees.map(emp => {
        const placed = placedIds.has(emp.id)
        const selected = emp.id === selectedId
        return (
          <button
            key={emp.id}
            onClick={() => !readOnly && !placed && onSelect(emp)}
            disabled={readOnly || placed}
            className={[
              'w-full text-left rounded-lg px-2.5 py-2 mb-1.5 border-[1.5px] transition-colors',
              selected ? 'bg-[#f0e8ff] border-purple-300' : '',
              placed ? 'bg-[#f5fff5] border-green-200 opacity-80' : '',
              !selected && !placed ? 'bg-white border-gray-200 hover:border-gray-300' : '',
            ].join(' ')}
          >
            <p className={`text-[13px] font-semibold ${placed ? 'text-green-700' : selected ? 'text-[#7B2FBE]' : 'text-gray-900'}`}>
              {placed ? `✓ ${emp.full_name}` : emp.full_name}
            </p>
            {emp.job_title && <p className="text-[11px] text-gray-400 mt-0.5">{emp.job_title}</p>}
          </button>
        )
      })}
    </div>
  )
}
