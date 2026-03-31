'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import boostlyLogo from '@/public/Boostly Icon Only copy.svg'
import type { ReviewCycle } from '@/lib/types'

interface Props {
  cycles: ReviewCycle[]
  children: React.ReactNode
}

export function AdminShell({ cycles, children }: Props) {
  const pathname = usePathname()
  // Extract cycleId from pathname like /admin/[cycleId]/...
  const pathParts = pathname.split('/').filter(Boolean)
  const activeCycleId = pathParts[1] && pathParts[1] !== 'new' ? pathParts[1] : null

  function navItem(href: string, icon: string, label: string, exact = false) {
    const active = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'))
    return (
      <Link
        key={href}
        href={href}
        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] mb-0.5 transition-colors ${
          active ? 'bg-[#f0e8ff] text-[#7B2FBE] font-semibold' : 'text-gray-500 hover:bg-[#f0e8ff] hover:text-[#7B2FBE]'
        }`}
      >
        <span className="w-[18px] text-center">{icon}</span>
        {label}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f4f6] flex flex-col">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] border border-gray-200 rounded-lg p-1 flex items-center justify-center bg-white">
            <Image src={boostlyLogo} alt="Boostly" width={24} height={24} />
          </div>
          <span className="font-bold text-[15px]">People Analyzer</span>
          <span className="bg-[#28008F] text-white text-[11px] font-bold px-2 py-0.5 rounded-full tracking-wide">Admin</span>
        </div>
        <span className="text-xs text-gray-400">brixton@boostly.com</span>
      </div>

      <div className="flex flex-1">
        {/* Sidenav */}
        <div className="w-[200px] min-w-[200px] bg-[#fafafa] border-r border-gray-100 p-3">
          {activeCycleId && (
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-2 px-2">Current Cycle</p>
              {navItem(`/admin/${activeCycleId}`, '📊', 'Overview', true)}
              {navItem(`/admin/${activeCycleId}/assignments`, '👥', 'Assignments')}
              {navItem(`/admin/${activeCycleId}/results`, '📋', 'Results')}
            </div>
          )}

          {cycles.filter(c => c.status === 'closed').length > 0 && (
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-2 px-2">History</p>
              {cycles.filter(c => c.status === 'closed').slice(0, 5).map(c =>
                navItem(`/admin/${c.id}`, '🕓', c.name)
              )}
            </div>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-2 px-2">Admin</p>
            {navItem('/admin/new', '➕', 'New Cycle')}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 p-6">{children}</div>
      </div>
    </div>
  )
}
