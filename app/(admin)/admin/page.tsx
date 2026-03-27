import { createClient } from '@/lib/db'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminIndexPage() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') redirect('/login')

  const supabase = createClient()
  const { data: cycles } = await supabase
    .from('review_cycles')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)

  if (cycles?.[0]) redirect(`/admin/${cycles[0].id}`)

  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400">No cycles yet. Create one to get started.</p>
    </div>
  )
}
