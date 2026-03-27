import { NextRequest, NextResponse } from 'next/server'
import { redeemMagicLink } from '@/lib/magic-link'
import { createClient } from '@/lib/db'
import { signIn } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.redirect(new URL('/login?error=invalid', req.url))

  const userId = await redeemMagicLink(token)
  if (!userId) return NextResponse.redirect(new URL('/login?error=expired', req.url))

  const supabase = createClient()
  const { data: user } = await supabase
    .from('users')
    .select('must_reset_password')
    .eq('id', userId)
    .single()

  if (!user) return NextResponse.redirect(new URL('/login?error=invalid', req.url))

  await signIn('magic-link-session', { userId, redirect: false })

  return NextResponse.redirect(
    new URL(user.must_reset_password ? '/set-password' : '/', req.url)
  )
}
