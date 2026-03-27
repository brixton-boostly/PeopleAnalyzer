import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import type { PerfLevel } from '@/lib/types'

// PATCH — admin edits a submitted review, writes audit log
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { reviewId } = await params
  const updates = (await req.json()) as { performance?: PerfLevel; potential?: PerfLevel }
  const supabase = createClient()

  const { data: current } = await supabase
    .from('reviews')
    .select('performance, potential')
    .eq('id', reviewId)
    .single()

  if (!current) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  const { data: updated, error } = await supabase
    .from('reviews')
    .update(updates)
    .eq('id', reviewId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Write audit log entries for changed fields
  const auditEntries = []
  for (const field of ['performance', 'potential'] as const) {
    if (updates[field] && updates[field] !== current[field]) {
      auditEntries.push({
        review_id: reviewId,
        changed_by: session.user.id,
        field_changed: field,
        old_value: current[field] ?? null,
        new_value: updates[field]!,
      })
    }
  }

  if (auditEntries.length > 0) {
    await supabase.from('audit_log').insert(auditEntries)
  }

  return NextResponse.json(updated)
}
