import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { syncGustoToCycle } from '@/lib/gusto'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { cycleId } = await req.json()
  if (!cycleId) return NextResponse.json({ error: 'cycleId required' }, { status: 400 })

  const result = await syncGustoToCycle(cycleId)
  return NextResponse.json(result)
}
