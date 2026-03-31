import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { createMagicLink } from '@/lib/magic-link'

// POST /api/magic-link { managerId }
// Admin-only — generates a magic link URL for a manager (without sending Slack DM)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { managerId } = await req.json()
  if (!managerId) return NextResponse.json({ error: 'managerId required' }, { status: 400 })

  const supabase = createClient()
  const { data: user } = await supabase
    .from('users')
    .select('id, first_name, last_name, email')
    .eq('id', managerId)
    .single()

  if (!user) return NextResponse.json({ error: 'Manager not found' }, { status: 404 })

  const url = await createMagicLink(user.id)
  return NextResponse.json({ url, name: `${user.first_name} ${user.last_name}`, email: user.email })
}
