import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import type { RetroStatus } from '@/lib/types'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ cycleId: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { cycleId } = await params
  const { retro_status } = (await req.json()) as { retro_status: RetroStatus }

  if (!['draft', 'active', 'closed'].includes(retro_status)) {
    return NextResponse.json({ error: 'Invalid retro_status' }, { status: 400 })
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('review_cycles')
    .update({ retro_status })
    .eq('id', cycleId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
