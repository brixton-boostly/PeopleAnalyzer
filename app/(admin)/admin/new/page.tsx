'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function NewCyclePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/cycles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) { setError('Failed to create cycle.'); setLoading(false); return }
    const cycle = await res.json()
    router.push(`/admin/${cycle.id}`)
  }

  return (
    <div className="max-w-md">
      <h1 className="text-[17px] font-bold mb-1">New Review Cycle</h1>
      <p className="text-xs text-gray-400 mb-6">
        Give the cycle a name, then sync from Gusto to populate assignments.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Cycle name</Label>
          <Input
            placeholder="e.g. Q2 2025"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="bg-[#7B2FBE] hover:bg-[#6a28a3]" disabled={loading}>
          {loading ? 'Creating…' : 'Create Cycle'}
        </Button>
      </form>
    </div>
  )
}
