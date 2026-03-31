import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/db'
import { validateRetroToken } from '@/lib/magic-link'
import type { RetroResponse } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { token, responses } = await req.json()
  if (!token || !Array.isArray(responses)) {
    return NextResponse.json({ error: 'token and responses required' }, { status: 400 })
  }

  const validated = await validateRetroToken(token)
  if (!validated) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  const { employeeId, cycleId } = validated
  const supabase = createClient()

  const { data, error } = await supabase
    .from('retros')
    .upsert(
      {
        cycle_id: cycleId,
        employee_id: employeeId,
        responses: responses as RetroResponse[],
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'cycle_id,employee_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
