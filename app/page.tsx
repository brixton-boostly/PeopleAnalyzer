import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function Home() {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.mustResetPassword) redirect('/set-password')
  if (session.user.role === 'admin') redirect('/admin')
  redirect('/review')
}
