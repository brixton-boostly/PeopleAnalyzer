import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'

// GET /api/reviews?cycleId=... — admin gets all, manager gets own
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cycleId = req.nextUrl.searchParams.get('cycleId')
  if (!cycleId) return NextResponse.json({ error: 'cycleId required' }, { status: 400 })

  const supabase = createClient()
  let query = supabase
    .from('reviews')
    .select(`
      id, performance, potential, comments, submitted_at,
      manager:users!manager_id(id, first_name, last_name),
      direct_report:direct_reports!direct_report_id(id, full_name, job_title)
    `)
    .eq('review_cycle_id', cycleId)

  if (session.user.role === 'manager') {
    query = query.eq('manager_id', session.user.id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — save/update a placement (manager only, cycle must be active, not yet submitted)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { cycleId, directReportId, performance, potential } = await req.json()
  if (!cycleId || !directReportId || !performance || !potential) {
    return NextResponse.json(
      { error: 'cycleId, directReportId, performance, potential required' },
      { status: 400 }
    )
  }

  const supabase = createClient()

  // Verify cycle is active
  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('status')
    .eq('id', cycleId)
    .single()
  if (cycle?.status !== 'active') {
    return NextResponse.json({ error: 'Cycle is not active' }, { status: 400 })
  }

  // Block if already submitted
  const { data: existing } = await supabase
    .from('reviews')
    .select('id, submitted_at')
    .eq('manager_id', session.user.id)
    .eq('review_cycle_id', cycleId)
    .eq('direct_report_id', directReportId)
    .single()

  if (existing?.submitted_at) {
    return NextResponse.json({ error: 'Review already submitted' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('reviews')
    .upsert(
      {
        manager_id: session.user.id,
        review_cycle_id: cycleId,
        direct_report_id: directReportId,
        performance,
        potential,
      },
      { onConflict: 'manager_id,direct_report_id,review_cycle_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH — manager saves/updates comment on one of their own unsubmitted reviews
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { reviewId, comments } = await req.json()
  if (!reviewId) return NextResponse.json({ error: 'reviewId required' }, { status: 400 })

  const supabase = createClient()

  const { data: existing } = await supabase
    .from('reviews')
    .select('id, manager_id, submitted_at')
    .eq('id', reviewId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.manager_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('reviews')
    .update({ comments: comments ?? null })
    .eq('id', reviewId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
