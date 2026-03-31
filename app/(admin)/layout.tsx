import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { redirect } from 'next/navigation'
import { AdminShell } from '@/components/admin/AdminShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') redirect('/login')

  const supabase = createClient()
  const { data: cycles } = await supabase
    .from('review_cycles')
    .select('id, name, status, retro_status, retro_questions, created_by, created_at')
    .order('created_at', { ascending: false })

  return <AdminShell cycles={cycles ?? []}>{children}</AdminShell>
}
