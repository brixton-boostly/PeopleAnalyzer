import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createRetroMagicLink } from '@/lib/magic-link'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { employeeId, cycleId } = await req.json()
  if (!employeeId || !cycleId) {
    return NextResponse.json({ error: 'employeeId and cycleId required' }, { status: 400 })
  }

  try {
    const url = await createRetroMagicLink(employeeId, cycleId)
    return NextResponse.json({ url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create magic link'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
