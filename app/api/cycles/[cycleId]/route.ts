import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import type { CycleStatus } from '@/lib/types'

// PATCH — update cycle status (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ cycleId: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { cycleId } = await params
  const { status } = (await req.json()) as { status: CycleStatus }

  if (!['draft', 'active', 'closed'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('review_cycles')
    .update({ status })
    .eq('id', cycleId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
