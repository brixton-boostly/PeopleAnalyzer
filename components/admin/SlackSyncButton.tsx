'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type SyncState = 'idle' | 'syncing' | 'done' | 'error'

export function SlackSyncButton() {
  const router = useRouter()
  const [state, setState] = useState<SyncState>('idle')
  const [result, setResult] = useState<{ matched: number; updated: number; unmatched: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function sync() {
    setState('syncing')
    setError(null)
    try {
      const res = await fetch('/api/slack/sync-users', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`)
        setState('error')
        return
      }
      setResult(data)
      setState('done')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error')
      setState('error')
    }
  }

  if (state === 'done' && result) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 font-semibold">
          ✓ Synced {result.updated} Slack IDs
          {result.unmatched.length > 0 && ` · ${result.unmatched.length} unmatched`}
        </span>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => { setState('idle'); setResult(null) }}>
          Sync Again
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="text-xs"
        onClick={sync}
        disabled={state === 'syncing'}
      >
        {state === 'syncing' ? 'Syncing…' : state === 'error' ? '⚠ Retry Slack Sync' : '🔗 Sync Slack IDs'}
      </Button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
