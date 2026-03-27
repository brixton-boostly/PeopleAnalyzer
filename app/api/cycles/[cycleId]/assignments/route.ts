import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'

// GET — list all assignments for a cycle (admin only)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cycleId: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { cycleId } = await params
  const supabase = createClient()
  const { data, error } = await supabase
    .from('manager_assignments')
    .select(`
      id,
      manager:users!manager_id(id, first_name, last_name, email),
      direct_report:direct_reports!direct_report_id(id, full_name, job_title)
    `)
    .eq('review_cycle_id', cycleId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — add an assignment
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ cycleId: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { cycleId } = await params
  const { managerId, directReportId } = await req.json()

  if (!managerId || !directReportId) {
    return NextResponse.json({ error: 'managerId and directReportId required' }, { status: 400 })
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('manager_assignments')
    .insert({ manager_id: managerId, direct_report_id: directReportId, review_cycle_id: cycleId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE — remove an assignment by id (?assignmentId=...)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ cycleId: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { cycleId } = await params
  const assignmentId = req.nextUrl.searchParams.get('assignmentId')
  if (!assignmentId) return NextResponse.json({ error: 'assignmentId required' }, { status: 400 })

  const supabase = createClient()
  const { error } = await supabase
    .from('manager_assignments')
    .delete()
    .eq('id', assignmentId)
    .eq('review_cycle_id', cycleId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
