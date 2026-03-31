// proxy.ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isPublic =
    pathname === '/login' ||
    pathname.startsWith('/retro/') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/retro/submit') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')

  // Get session via auth()
  const session = await auth()

  if (!session && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (session?.user.mustResetPassword && pathname !== '/set-password' && !isPublic) {
    return NextResponse.redirect(new URL('/set-password', req.url))
  }

  if (session?.user.role === 'manager' && pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/review', req.url))
  }

  if (session?.user.role === 'admin' && pathname.startsWith('/review')) {
    return NextResponse.redirect(new URL('/admin', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)'],
}
