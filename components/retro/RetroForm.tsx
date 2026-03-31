'use client'
import { useState } from 'react'

interface Props {
  token: string
  cycleName: string
  employeeFirstName: string
  questions: string[]
  existingResponses: { question: string; answer: string }[] | null
  managerComment: string | null
}

const LABELS = ['Wins', 'Growth', 'Needs']

export function RetroForm({
  token,
  cycleName,
  employeeFirstName,
  questions,
  existingResponses,
  managerComment,
}: Props) {
  const [answers, setAnswers] = useState<string[]>(
    questions.map((_, i) => existingResponses?.[i]?.answer ?? '')
  )
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(!!existingResponses)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (answers.some(a => !a.trim())) {
      setError('Please answer all three questions before submitting.')
      return
    }
    setSubmitting(true)
    try {
      const responses = questions.map((q, i) => ({ question: q, answer: answers[i] }))
      const res = await fetch('/api/retro/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, responses }),
      })
      if (!res.ok) { setError('Something went wrong. Please try again.'); return }
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f4f4f6] flex items-center justify-center p-6">
        <div className="w-full max-w-xl">
          <div className="text-center mb-8">
            <div className="text-xs font-bold tracking-widest text-[#7B2FBE] uppercase mb-2">{cycleName} · Retro</div>
            <h1 className="text-2xl font-extrabold text-gray-900">Your Retro</h1>
            <p className="text-sm text-gray-400 mt-1">Submitted · visible to your manager and leadership</p>
          </div>
          <div className="flex flex-col gap-4">
            {questions.map((q, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="text-[10px] font-bold tracking-widest text-[#7B2FBE] uppercase mb-2">
                  0{i + 1} — {LABELS[i] ?? `Q${i + 1}`}
                </div>
                <p className="text-[13px] font-semibold text-gray-800 mb-3 leading-snug">{q}</p>
                <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">{answers[i]}</p>
              </div>
            ))}
            {managerComment && (
              <div className="bg-[#f0e8ff] border border-[#ddd0f5] rounded-xl p-5">
                <div className="text-[10px] font-bold tracking-widest text-[#7B2FBE] uppercase mb-2">Manager Feedback</div>
                <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{managerComment}</p>
              </div>
            )}
            {!managerComment && (
              <p className="text-center text-xs text-gray-400">Manager feedback will appear here once added.</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f4f6] flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="text-xs font-bold tracking-widest text-[#7B2FBE] uppercase mb-2">{cycleName} · Retro</div>
          <h1 className="text-2xl font-extrabold text-gray-900">Hey {employeeFirstName}, time to reflect.</h1>
          <p className="text-sm text-gray-400 mt-1">Takes ~10 minutes. Your manager and leadership will see your responses.</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {questions.map((q, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-[10px] font-bold tracking-widest text-[#7B2FBE] uppercase mb-2">
                0{i + 1} — {LABELS[i] ?? `Q${i + 1}`}
              </div>
              <p className="text-[13px] font-semibold text-gray-800 mb-3 leading-snug">{q}</p>
              <textarea
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] text-gray-700 resize-none focus:outline-none focus:border-[#a78bfa] focus:ring-2 focus:ring-[#ede9fe] placeholder-gray-300 font-sans"
                rows={3}
                placeholder="Write your reflection here..."
                value={answers[i]}
                onChange={e => setAnswers(prev => { const next = [...prev]; next[i] = e.target.value; return next })}
              />
            </div>
          ))}
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#7B2FBE] hover:bg-[#6a28a3] disabled:bg-[#e8e0f5] disabled:text-[#b09cc8] text-white font-bold rounded-xl py-3.5 text-[14px] transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit Retro'}
          </button>
          <p className="text-center text-xs text-gray-400">You can return to this link to view your submission and any manager feedback.</p>
        </form>
      </div>
    </div>
  )
}
