'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface ManagerRow {
  id: string
  name: string
  email: string
  directReportCount: number
  submittedAt: string | null
}

interface Props {
  managers: ManagerRow[]
  cycleId: string
}

type SendState = 'idle' | 'sending' | 'sent' | 'error'

export function CompletionTable({ managers, cycleId }: Props) {
  const [sendStates, setSendStates] = useState<Record<string, SendState>>({})
  const [sendErrors, setSendErrors] = useState<Record<string, string>>({})
  const [bulkState, setBulkState] = useState<SendState>('idle')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function setManagerState(id: string, state: SendState) {
    setSendStates(prev => ({ ...prev, [id]: state }))
  }

  async function sendLink(managerId: string) {
    setManagerState(managerId, 'sending')
    try {
      const res = await fetch('/api/nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSendErrors(prev => ({ ...prev, [managerId]: data.error ?? `HTTP ${res.status}` }))
        setManagerState(managerId, 'error')
        return
      }
      const result = data.results?.[0]
      if (result?.ok) {
        setManagerState(managerId, 'sent')
      } else {
        setSendErrors(prev => ({ ...prev, [managerId]: result?.error ?? 'Unknown error' }))
        setManagerState(managerId, 'error')
      }
    } catch (err: any) {
      setSendErrors(prev => ({ ...prev, [managerId]: err.message }))
      setManagerState(managerId, 'error')
    }
  }

  async function sendAll() {
    setBulkState('sending')
    await fetch('/api/nudge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycleId, all: true }),
    })
    setBulkState('sent')
    // Mark all pending as sent
    const pendingIds = managers.filter(m => !m.submittedAt).map(m => m.id)
    setSendStates(prev => {
      const next = { ...prev }
      for (const id of pendingIds) next[id] = 'sent'
      return next
    })
  }

  async function copyLink(managerId: string) {
    const res = await fetch('/api/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ managerId }),
    })
    const { url } = await res.json()
    await navigator.clipboard.writeText(url)
    setCopiedId(managerId)
    setTimeout(() => setCopiedId(prev => (prev === managerId ? null : prev)), 2000)
  }

  const pending = managers.filter(m => !m.submittedAt)

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-[13px] font-bold text-gray-700">Manager Completion</p>
        {pending.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={sendAll}
            disabled={bulkState === 'sending' || bulkState === 'sent'}
            className={
              bulkState === 'sent'
                ? 'text-green-700 border-green-300 bg-green-50 text-xs'
                : 'text-[#7B2FBE] border-[#ddd0f5] bg-[#f0e8ff] hover:bg-[#e5d5fc] text-xs'
            }
          >
            {bulkState === 'sending'
              ? 'Sending…'
              : bulkState === 'sent'
              ? `✓ Sent to ${pending.length}`
              : `📨 Send All Pending (${pending.length})`}
          </Button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Manager</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Reports</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Status</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Submitted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {managers.map(m => {
              const state = sendStates[m.id] ?? 'idle'
              return (
                <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#ede9fe] text-[#7B2FBE] flex items-center justify-center text-[11px] font-bold">
                        {m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p>{m.name}</p>
                        <p className="text-[11px] text-gray-400">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{m.directReportCount}</td>
                  <td className="px-4 py-2.5">
                    {m.submittedAt
                      ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Submitted</Badge>
                      : state === 'sent'
                      ? <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">Link Sent</Badge>
                      : state === 'error'
                      ? <Badge className="bg-red-50 text-red-700 hover:bg-red-50" title={sendErrors[m.id]}>Send Failed: {sendErrors[m.id]}</Badge>
                      : <Badge className="bg-orange-50 text-orange-700 hover:bg-orange-50">Pending</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">
                    {m.submittedAt
                      ? new Date(m.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {m.submittedAt ? (
                      <Link
                        href={`/admin/${cycleId}/results?manager=${m.id}`}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-[#7B2FBE] text-xs font-medium hover:bg-[#f0e8ff] transition-colors"
                      >
                        View →
                      </Link>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendLink(m.id)}
                          disabled={state === 'sending' || state === 'sent'}
                          className={
                            state === 'sent'
                              ? 'text-green-700 border-green-300 bg-green-50 text-xs'
                              : state === 'error'
                              ? 'text-red-700 border-red-300 bg-red-50 text-xs'
                              : 'text-[#7B2FBE] border-[#ddd0f5] bg-[#f0e8ff] hover:bg-[#e5d5fc] text-xs'
                          }
                        >
                          {state === 'sending' ? '…' : state === 'sent' ? '✓ Sent' : state === 'error' ? 'Retry' : '📨 Send'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyLink(m.id)}
                          className="text-gray-500 border-gray-200 text-xs hover:bg-gray-50"
                          title="Copy magic link to clipboard"
                        >
                          {copiedId === m.id ? '✓ Copied' : '🔗 Copy Link'}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
