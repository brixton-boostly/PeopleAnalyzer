import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { retroId, comment } = await req.json()
  if (!retroId) return NextResponse.json({ error: 'retroId required' }, { status: 400 })
  if (typeof comment !== 'string' || comment.trim() === '') {
    return NextResponse.json({ error: 'comment must be a non-empty string' }, { status: 400 })
  }

  const supabase = createClient()

  // Verify this retro belongs to one of the manager's DRs
  const { data: retro } = await supabase
    .from('retros')
    .select('id, employee_id, cycle_id')
    .eq('id', retroId)
    .single()

  if (!retro) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: assignment } = await supabase
    .from('manager_assignments')
    .select('id')
    .eq('manager_id', session.user.id)
    .eq('direct_report_id', retro.employee_id)
    .eq('review_cycle_id', retro.cycle_id)
    .single()

  if (!assignment) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('retros')
    .update({ manager_comment: comment, manager_commented_at: new Date().toISOString() })
    .eq('id', retroId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
