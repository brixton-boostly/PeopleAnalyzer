import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { password } = await req.json()
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const supabase = createClient()
  const hash = await bcrypt.hash(password, 10)
  await supabase
    .from('users')
    .update({ password_hash: hash, must_reset_password: false })
    .eq('id', session.user.id)

  return NextResponse.json({ ok: true })
}
