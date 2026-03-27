import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { redirect } from 'next/navigation'

export default async function ReviewIndexPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const supabase = createClient()
  const { data: cycles } = await supabase
    .from('review_cycles')
    .select('id, status')
    .in('status', ['active', 'closed'])
    .order('created_at', { ascending: false })

  const active = cycles?.find(c => c.status === 'active')
  if (active) redirect(`/review/${active.id}`)

  const latest = cycles?.[0]
  if (latest) redirect(`/review/${latest.id}`)

  return (
    <div className="min-h-screen bg-[#f4f4f6] flex items-center justify-center">
      <p className="text-gray-500">No active review cycles at this time.</p>
    </div>
  )
}
