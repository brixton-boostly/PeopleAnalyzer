import { validateRetroToken } from '@/lib/magic-link'
import { createClient } from '@/lib/db'
import { RetroForm } from '@/components/retro/RetroForm'

export default async function RetroPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const validated = await validateRetroToken(token)

  if (!validated) {
    return (
      <div className="min-h-screen bg-[#f4f4f6] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-800 mb-2">Link expired or invalid</h1>
          <p className="text-sm text-gray-400">Ask your admin to resend your Retro link.</p>
        </div>
      </div>
    )
  }

  const { employeeId, cycleId } = validated
  const supabase = createClient()

  const [employeeRes, cycleRes, retroRes] = await Promise.all([
    supabase.from('direct_reports').select('full_name').eq('id', employeeId).single(),
    supabase.from('review_cycles').select('name, retro_questions').eq('id', cycleId).single(),
    supabase
      .from('retros')
      .select('responses, manager_comment')
      .eq('employee_id', employeeId)
      .eq('cycle_id', cycleId)
      .maybeSingle(),
  ])

  if (!employeeRes.data || !cycleRes.data) {
    return (
      <div className="min-h-screen bg-[#f4f4f6] flex items-center justify-center">
        <p className="text-gray-400">Something went wrong. Please contact your admin.</p>
      </div>
    )
  }

  const firstName = employeeRes.data.full_name.split(' ')[0]
  const rawQuestions = cycleRes.data.retro_questions
  if (!Array.isArray(rawQuestions)) {
    return (
      <div className="min-h-screen bg-[#f4f4f6] flex items-center justify-center">
        <p className="text-gray-400">Something went wrong. Please contact your admin.</p>
      </div>
    )
  }
  const questions: string[] = rawQuestions as string[]

  return (
    <RetroForm
      token={token}
      cycleName={cycleRes.data.name}
      employeeFirstName={firstName}
      questions={questions}
      existingResponses={retroRes.data?.responses ?? null}
      managerComment={retroRes.data?.manager_comment ?? null}
    />
  )
}
