# Retro + Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Retro self-reflection feature (employee magic-link form, manager comment, admin launch) and redesign the admin Assignments and Results tabs to show dual-cycle progress and color-coded 9-box placements.

**Architecture:** Retro links are stored in the existing `magic_links` table with a new `type='retro'` column alongside a new `retros` table. The employee accesses their form via `/retro/[token]` (public, no auth). Manager sees a "Team Retros" tab alongside the 9-box. Admin launches Retro from a redesigned Assignments tab and views all data on a redesigned Results tab.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase (service role), Tailwind CSS, shadcn/ui, NextAuth v5 JWT, Jest + Testing Library

---

## File Map

**New files:**
- `supabase/migrations/003_add_retro.sql` — DB schema additions
- `app/retro/[token]/page.tsx` — public employee retro form page
- `components/retro/RetroForm.tsx` — client component: form or read-only view
- `app/api/retro/send/route.ts` — admin launches retro (saves questions + DMs employees)
- `app/api/retro/submit/route.ts` — employee submits responses
- `app/api/retro/comment/route.ts` — manager saves comment on a retro
- `app/api/retro/magic-link/route.ts` — generate/return a retro magic link URL (for Copy Link)
- `components/manager/TeamRetros.tsx` — manager's retro list with comment boxes
- `components/manager/ReviewTabsView.tsx` — client tab wrapper for 9-Box and Team Retros
- `components/admin/AssignmentsView.tsx` — redesigned assignments component
- `__tests__/lib/retro-magic-link.test.ts` — tests for new magic link functions

**Modified files:**
- `supabase/migrations/003_add_retro.sql` (new)
- `lib/types.ts` — add `textColor` to `NineBoxCell`, add `Retro` / `RetroResponse` types, update `ReviewCycle` and `MagicLink`
- `lib/magic-link.ts` — add `createRetroMagicLink`, `validateRetroToken`, `buildRetroUrl`
- `lib/slack.ts` — add `sendRetroDM`
- `proxy.ts` — allow `/retro/**` without auth
- `app/(manager)/review/[cycleId]/page.tsx` — fetch retro data, render `ReviewTabsView`
- `app/(admin)/admin/[cycleId]/assignments/page.tsx` — fetch employee-level data, render `AssignmentsView`
- `app/(admin)/admin/[cycleId]/results/page.tsx` — fetch retro data + counts, pass to `ResultsTable`
- `components/admin/ResultsTable.tsx` — add KPI cards, colored placement tags, Retro column + slide-over

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/003_add_retro.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/003_add_retro.sql

-- Allow retro magic links (no user account needed)
ALTER TABLE magic_links ALTER COLUMN user_id DROP NOT NULL;

-- Retro link metadata
ALTER TABLE magic_links
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'review'
    CHECK (type IN ('review', 'retro')),
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES direct_reports(id),
  ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES review_cycles(id);

-- Employee Slack IDs for Retro DMs
ALTER TABLE direct_reports
  ADD COLUMN IF NOT EXISTS slack_user_id TEXT;

-- Retro questions + status on the cycle
ALTER TABLE review_cycles
  ADD COLUMN IF NOT EXISTS retro_questions JSONB NOT NULL DEFAULT '["What accomplishments am I most proud of this quarter, and what made them possible?","Where did I fall short of my goals, and what would I do differently?","What do I need — from my manager, team, or company — to be more effective next quarter?"]'::jsonb,
  ADD COLUMN IF NOT EXISTS retro_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (retro_status IN ('draft', 'active', 'closed'));

-- Retro responses + manager comment
CREATE TABLE IF NOT EXISTS retros (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id              UUID NOT NULL REFERENCES review_cycles(id),
  employee_id           UUID NOT NULL REFERENCES direct_reports(id),
  responses             JSONB,
  submitted_at          TIMESTAMPTZ,
  manager_comment       TEXT,
  manager_commented_at  TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cycle_id, employee_id)
);
```

- [ ] **Step 2: Run the migration in Supabase**

Open the Supabase dashboard → SQL Editor → paste and run the contents of `003_add_retro.sql`.

Expected: all statements succeed with no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_add_retro.sql
git commit -m "feat: add retro schema (magic_links nullable, retros table, cycle retro columns)"
```

---

## Task 2: Update Types

**Files:**
- Modify: `lib/types.ts`
- Modify: `__tests__/components/NineBoxCell.test.tsx` (add textColor to cell fixture)

- [ ] **Step 1: Write the failing test for textColor**

Add to `__tests__/components/NineBoxCell.test.tsx` — update the `cell` fixture at the top:

```ts
const cell = {
  performance: 'high' as PerfLevel,
  potential: 'high' as PerfLevel,
  label: 'Superstar',
  description: 'Future leaders',
  color: '#d1fae5',
  textColor: '#065f46',
}
```

- [ ] **Step 2: Run existing tests to verify they pass before changes**

```bash
npx jest --testPathPattern="NineBoxCell" --no-coverage
```

Expected: 4 tests pass.

- [ ] **Step 3: Update `lib/types.ts`**

Replace the entire file:

```ts
export type UserRole = 'admin' | 'manager'
export type CycleStatus = 'draft' | 'active' | 'closed'
export type RetroStatus = 'draft' | 'active' | 'closed'
export type PerfLevel = 'low' | 'medium' | 'high'

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: UserRole
  slack_user_id: string | null
  password_hash: string
  must_reset_password: boolean
  gusto_employee_id: string | null
  created_at: string
}

export interface DirectReport {
  id: string
  gusto_employee_id: string
  full_name: string
  job_title: string | null
  slack_user_id: string | null
  created_at: string
}

export interface ReviewCycle {
  id: string
  name: string
  status: CycleStatus
  retro_status: RetroStatus
  retro_questions: string[]
  created_by: string
  created_at: string
}

export interface ManagerAssignment {
  id: string
  manager_id: string
  direct_report_id: string
  review_cycle_id: string
  created_at: string
}

export interface Review {
  id: string
  manager_id: string
  direct_report_id: string
  review_cycle_id: string
  performance: PerfLevel | null
  potential: PerfLevel | null
  comments: string | null
  submitted_at: string | null
}

export interface RetroResponse {
  question: string
  answer: string
}

export interface Retro {
  id: string
  cycle_id: string
  employee_id: string
  responses: RetroResponse[] | null
  submitted_at: string | null
  manager_comment: string | null
  manager_commented_at: string | null
  created_at: string
}

export interface AuditLogEntry {
  id: string
  review_id: string
  changed_by: string
  field_changed: string
  old_value: string | null
  new_value: string | null
  changed_at: string
}

export interface MagicLink {
  id: string
  user_id: string | null
  employee_id: string | null
  cycle_id: string | null
  type: 'review' | 'retro'
  token: string
  expires_at: string
  used_at: string | null
  created_at: string
}

export interface NineBoxCell {
  performance: PerfLevel
  potential: PerfLevel
  label: string
  description: string
  color: string
  textColor: string
}

export const NINE_BOX_CELLS: NineBoxCell[] = [
  { performance: 'low',    potential: 'high',   label: 'Rough Diamond', description: 'Coach or move',                    color: '#fce7f3', textColor: '#9d174d' },
  { performance: 'medium', potential: 'high',   label: 'Rising Star',   description: 'Invest in development',            color: '#fef9c3', textColor: '#854d0e' },
  { performance: 'high',   potential: 'high',   label: 'Superstar',     description: 'Future leaders',                   color: '#d1fae5', textColor: '#065f46' },
  { performance: 'low',    potential: 'medium', label: 'Inconsistent',  description: 'Performance improvement needed',   color: '#fff1f2', textColor: '#9f1239' },
  { performance: 'medium', potential: 'medium', label: 'Core Player',   description: 'Backbone of organization',         color: '#eff6ff', textColor: '#1e40af' },
  { performance: 'high',   potential: 'medium', label: 'Key Player',    description: 'Retain and reward',                color: '#dcfce7', textColor: '#166534' },
  { performance: 'low',    potential: 'low',    label: 'Question Mark', description: 'Exit planning',                    color: '#fef2f2', textColor: '#991b1b' },
  { performance: 'medium', potential: 'low',    label: 'Workhorse',     description: 'Reliable performers',              color: '#f0fdf4', textColor: '#14532d' },
  { performance: 'high',   potential: 'low',    label: 'Trusted Pro',   description: 'Solid current contributors',       color: '#e0f2fe', textColor: '#075985' },
]
```

- [ ] **Step 4: Run tests to verify they still pass**

```bash
npx jest --no-coverage
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts __tests__/components/NineBoxCell.test.tsx
git commit -m "feat: add textColor to NineBoxCell, add Retro/RetroResponse types, update ReviewCycle/MagicLink"
```

---

## Task 3: Magic Link Utilities + Tests

**Files:**
- Modify: `lib/magic-link.ts`
- Create: `__tests__/lib/retro-magic-link.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/retro-magic-link.test.ts`:

```ts
import { buildRetroUrl } from '@/lib/magic-link'

describe('buildRetroUrl', () => {
  it('returns a /retro/[token] URL', () => {
    const url = buildRetroUrl('abc123', 'http://localhost:3000')
    expect(url).toBe('http://localhost:3000/retro/abc123')
  })

  it('uses different base URLs', () => {
    const url = buildRetroUrl('tok', 'https://boostly-people-analyzer.vercel.app')
    expect(url).toBe('https://boostly-people-analyzer.vercel.app/retro/tok')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx jest --testPathPattern="retro-magic-link" --no-coverage
```

Expected: FAIL — `buildRetroUrl` not found.

- [ ] **Step 3: Update `lib/magic-link.ts`**

```ts
import crypto from 'crypto'
import { createClient } from './db'

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function buildMagicLinkUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/api/auth/magic-link?token=${token}`
}

export function buildRetroUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/retro/${token}`
}

export async function createMagicLink(userId: string): Promise<string> {
  const supabase = createClient()
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('magic_links')
    .insert({ user_id: userId, token, expires_at: expiresAt, type: 'review' })

  if (error) throw new Error(`Failed to create magic link: ${error.message}`)

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  return buildMagicLinkUrl(token, baseUrl)
}

export async function createRetroMagicLink(
  employeeId: string,
  cycleId: string
): Promise<string> {
  const supabase = createClient()
  const token = generateToken()
  // 7-day expiry — employee may return to view their submission
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('magic_links')
    .insert({ employee_id: employeeId, cycle_id: cycleId, token, expires_at: expiresAt, type: 'retro' })

  if (error) throw new Error(`Failed to create retro magic link: ${error.message}`)

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  return buildRetroUrl(token, baseUrl)
}

export async function redeemMagicLink(token: string): Promise<string | null> {
  const supabase = createClient()

  const { data: link } = await supabase
    .from('magic_links')
    .select('id, user_id, expires_at, used_at')
    .eq('token', token)
    .eq('type', 'review')
    .single()

  if (!link || link.used_at) return null
  if (new Date(link.expires_at) < new Date()) return null

  await supabase
    .from('magic_links')
    .update({ used_at: new Date().toISOString() })
    .eq('id', link.id)

  return link.user_id
}

export async function validateRetroToken(
  token: string
): Promise<{ employeeId: string; cycleId: string } | null> {
  const supabase = createClient()

  const { data: link } = await supabase
    .from('magic_links')
    .select('employee_id, cycle_id, expires_at')
    .eq('token', token)
    .eq('type', 'retro')
    .single()

  if (!link) return null
  if (new Date(link.expires_at) < new Date()) return null

  return { employeeId: link.employee_id, cycleId: link.cycle_id }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest --testPathPattern="retro-magic-link|magic-link" --no-coverage
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/magic-link.ts __tests__/lib/retro-magic-link.test.ts
git commit -m "feat: add buildRetroUrl, createRetroMagicLink, validateRetroToken"
```

---

## Task 4: Slack + Proxy Updates

**Files:**
- Modify: `lib/slack.ts`
- Modify: `proxy.ts`

- [ ] **Step 1: Add `sendRetroDM` to `lib/slack.ts`**

```ts
export async function sendNudgeDM(
  slackUserId: string,
  firstName: string,
  magicLinkUrl: string
): Promise<void> {
  const text = `Hey ${firstName} — it's time to complete your People Review. Click here to get started: ${magicLinkUrl}`

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ channel: slackUserId, text }),
  })

  const data = await res.json()
  if (!data.ok) throw new Error(`Slack error: ${data.error}`)
}

export async function sendRetroDM(
  slackUserId: string,
  firstName: string,
  retroUrl: string
): Promise<void> {
  const text = `Hey ${firstName} — it's time to complete your Q1 Retro. Take a few minutes to reflect on the quarter: ${retroUrl}`

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ channel: slackUserId, text }),
  })

  const data = await res.json()
  if (!data.ok) throw new Error(`Slack error: ${data.error}`)
}
```

- [ ] **Step 2: Update `proxy.ts` to allow `/retro` paths**

```ts
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
```

- [ ] **Step 3: Commit**

```bash
git add lib/slack.ts proxy.ts
git commit -m "feat: add sendRetroDM, allow /retro and /api/retro/submit in proxy"
```

---

## Task 5: Retro API Routes

**Files:**
- Create: `app/api/retro/send/route.ts`
- Create: `app/api/retro/submit/route.ts`
- Create: `app/api/retro/comment/route.ts`
- Create: `app/api/retro/magic-link/route.ts`

- [ ] **Step 1: Create `app/api/retro/send/route.ts`**

Admin launches retro: saves questions, sets `retro_status='active'`, sends DMs to employees with Slack IDs.

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { createRetroMagicLink } from '@/lib/magic-link'
import { sendRetroDM } from '@/lib/slack'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { cycleId, questions } = await req.json()
  if (!cycleId) return NextResponse.json({ error: 'cycleId required' }, { status: 400 })

  const supabase = createClient()

  // Save questions and set retro active
  const updatePayload: Record<string, unknown> = { retro_status: 'active' }
  if (Array.isArray(questions) && questions.length === 3) {
    updatePayload.retro_questions = questions
  }
  await supabase.from('review_cycles').update(updatePayload).eq('id', cycleId)

  // Fetch all employees in this cycle
  const { data: assignments } = await supabase
    .from('manager_assignments')
    .select('direct_report_id, direct_reports(id, full_name, slack_user_id)')
    .eq('review_cycle_id', cycleId)

  const seen = new Set<string>()
  const employees: { id: string; full_name: string; slack_user_id: string | null }[] = []
  for (const a of assignments ?? []) {
    const dr = (a as any).direct_reports
    if (dr && !seen.has(dr.id)) {
      seen.add(dr.id)
      employees.push(dr)
    }
  }

  const results: { employeeId: string; ok: boolean; error?: string; skipped?: boolean }[] = []

  for (const emp of employees) {
    if (!emp.slack_user_id) {
      results.push({ employeeId: emp.id, ok: false, skipped: true, error: 'No Slack user ID' })
      continue
    }
    try {
      const url = await createRetroMagicLink(emp.id, cycleId)
      await sendRetroDM(emp.slack_user_id, emp.full_name.split(' ')[0], url)
      results.push({ employeeId: emp.id, ok: true })
    } catch (err: any) {
      results.push({ employeeId: emp.id, ok: false, error: err.message })
    }
  }

  return NextResponse.json({ results })
}
```

- [ ] **Step 2: Create `app/api/retro/submit/route.ts`**

Employee submits their retro responses. No auth required — validated by token.

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/db'
import { validateRetroToken } from '@/lib/magic-link'
import type { RetroResponse } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { token, responses } = await req.json()
  if (!token || !Array.isArray(responses)) {
    return NextResponse.json({ error: 'token and responses required' }, { status: 400 })
  }

  const validated = await validateRetroToken(token)
  if (!validated) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  const { employeeId, cycleId } = validated
  const supabase = createClient()

  const { data, error } = await supabase
    .from('retros')
    .upsert(
      {
        cycle_id: cycleId,
        employee_id: employeeId,
        responses: responses as RetroResponse[],
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'cycle_id,employee_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
```

- [ ] **Step 3: Create `app/api/retro/comment/route.ts`**

Manager saves an overall comment on an employee's retro.

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { retroId, comment } = await req.json()
  if (!retroId) return NextResponse.json({ error: 'retroId required' }, { status: 400 })

  const supabase = createClient()

  // Verify this retro belongs to one of the manager's DRs
  const { data: retro } = await supabase
    .from('retros')
    .select('id, employee_id, cycle_id')
    .eq('id', retroId)
    .single()

  if (!retro) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: assignment } = await supabase
    .from('manager_assignments')
    .select('id')
    .eq('manager_id', session.user.id)
    .eq('direct_report_id', retro.employee_id)
    .eq('review_cycle_id', retro.cycle_id)
    .single()

  if (!assignment) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('retros')
    .update({ manager_comment: comment, manager_commented_at: new Date().toISOString() })
    .eq('id', retroId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
```

- [ ] **Step 4: Create `app/api/retro/magic-link/route.ts`**

Admin generates a retro magic link URL for an employee (for "Copy Link").

```ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createRetroMagicLink } from '@/lib/magic-link'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { employeeId, cycleId } = await req.json()
  if (!employeeId || !cycleId) {
    return NextResponse.json({ error: 'employeeId and cycleId required' }, { status: 400 })
  }

  const url = await createRetroMagicLink(employeeId, cycleId)
  return NextResponse.json({ url })
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/retro/
git commit -m "feat: add retro API routes (send, submit, comment, magic-link)"
```

---

## Task 6: Employee Retro Page

**Files:**
- Create: `app/retro/[token]/page.tsx`
- Create: `components/retro/RetroForm.tsx`

- [ ] **Step 1: Create `components/retro/RetroForm.tsx`**

Client component — shows form if not submitted, read-only view with manager comment if submitted.

```tsx
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

export function RetroForm({
  token,
  cycleName,
  employeeFirstName,
  questions,
  existingResponses,
  managerComment,
}: Props) {
  const [answers, setAnswers] = useState<string[]>(
    existingResponses ? existingResponses.map(r => r.answer) : questions.map(() => '')
  )
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(!!existingResponses)
  const [error, setError] = useState('')

  const LABELS = ['Wins', 'Growth', 'Needs']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (answers.some(a => !a.trim())) {
      setError('Please answer all three questions before submitting.')
      return
    }
    setSubmitting(true)
    const responses = questions.map((q, i) => ({ question: q, answer: answers[i] }))
    const res = await fetch('/api/retro/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, responses }),
    })
    setSubmitting(false)
    if (!res.ok) { setError('Something went wrong. Please try again.'); return }
    setSubmitted(true)
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
                  0{i + 1} — {LABELS[i]}
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
                0{i + 1} — {LABELS[i]}
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
```

- [ ] **Step 2: Create `app/retro/[token]/page.tsx`**

```tsx
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
  const questions: string[] = cycleRes.data.retro_questions as unknown as string[]

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
```

- [ ] **Step 3: Verify TypeScript builds**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/retro/ components/retro/
git commit -m "feat: employee retro page and RetroForm component"
```

---

## Task 7: Manager Team Retros Tab

**Files:**
- Create: `components/manager/TeamRetros.tsx`
- Create: `components/manager/ReviewTabsView.tsx`
- Modify: `app/(manager)/review/[cycleId]/page.tsx`

- [ ] **Step 1: Create `components/manager/TeamRetros.tsx`**

```tsx
'use client'
import { useState } from 'react'
import type { DirectReport, Retro } from '@/lib/types'

interface Props {
  cycleName: string
  directReports: DirectReport[]
  retros: Retro[]
}

export function TeamRetros({ cycleName, directReports, retros }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [commentMap, setCommentMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const r of retros) {
      if (r.manager_comment) map[r.id] = r.manager_comment
    }
    return map
  })
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const retroByEmployee = new Map(retros.map(r => [r.employee_id, r]))
  const submittedCount = retros.filter(r => r.submitted_at).length

  async function saveComment(retroId: string, comment: string) {
    setSavingId(retroId)
    await fetch('/api/retro/comment', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retroId, comment }),
    })
    setSavingId(null)
    setSavedId(retroId)
    setTimeout(() => setSavedId(prev => (prev === retroId ? null : prev)), 2000)
  }

  return (
    <div className="p-5">
      <p className="text-xs text-gray-400 mb-4">{cycleName} · {submittedCount} of {directReports.length} submitted</p>
      <div className="flex flex-col gap-3">
        {directReports.map(dr => {
          const retro = retroByEmployee.get(dr.id)
          const isSubmitted = !!retro?.submitted_at
          const isExpanded = expandedId === dr.id

          return (
            <div key={dr.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                onClick={() => isSubmitted && setExpandedId(isExpanded ? null : dr.id)}
                disabled={!isSubmitted}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isSubmitted ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <p className="text-[13px] font-semibold text-gray-800">{dr.full_name}</p>
                    {dr.job_title && <p className="text-[11px] text-gray-400">{dr.job_title}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isSubmitted ? (
                    <span className="text-[11px] font-semibold text-green-600">
                      Submitted {retro?.submitted_at ? new Date(retro.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                    </span>
                  ) : (
                    <span className="text-[11px] text-gray-400">Not submitted</span>
                  )}
                  {isSubmitted && <span className="text-gray-400 text-sm">{isExpanded ? '▾' : '›'}</span>}
                </div>
              </button>

              {isExpanded && retro && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                  <div className="flex flex-col gap-4 mb-4">
                    {(retro.responses ?? []).map((r, i) => (
                      <div key={i}>
                        <p className="text-[10px] font-bold tracking-widest text-[#7B2FBE] uppercase mb-1">{r.question}</p>
                        <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">{r.answer}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-2">Your Feedback</p>
                    <textarea
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-700 resize-none focus:outline-none focus:border-[#a78bfa] focus:ring-2 focus:ring-[#ede9fe] placeholder-gray-300 font-sans"
                      rows={3}
                      placeholder={`Leave a note for ${dr.full_name.split(' ')[0]}…`}
                      value={commentMap[retro.id] ?? ''}
                      onChange={e => setCommentMap(prev => ({ ...prev, [retro.id]: e.target.value }))}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-[11px] text-gray-400">
                        {savingId === retro.id ? 'Saving…' : savedId === retro.id ? '✓ Saved' : ''}
                      </p>
                      <button
                        onClick={() => saveComment(retro.id, commentMap[retro.id] ?? '')}
                        className="text-xs font-bold text-white bg-[#7B2FBE] hover:bg-[#6a28a3] rounded-lg px-3 py-1.5 transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/manager/ReviewTabsView.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { NineBoxView } from '@/components/ninebox/NineBoxView'
import { TeamRetros } from './TeamRetros'
import type { DirectReport, Review, Retro } from '@/lib/types'

interface Props {
  cycleId: string
  cycleName: string
  directReports: DirectReport[]
  initialReviews: Review[]
  submittedAt: string | null
  managerName: string
  retros: Retro[]
  retroStatus: string
}

export function ReviewTabsView({
  cycleId,
  cycleName,
  directReports,
  initialReviews,
  submittedAt,
  managerName,
  retros,
  retroStatus,
}: Props) {
  const [tab, setTab] = useState<'ninebox' | 'retros'>('ninebox')

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden max-w-[920px] mx-auto">
      {/* Tab bar */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setTab('ninebox')}
          className={`px-5 py-3 text-[13px] font-semibold transition-colors ${
            tab === 'ninebox'
              ? 'text-[#7B2FBE] border-b-2 border-[#7B2FBE]'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          9-Box
        </button>
        {retroStatus === 'active' || retroStatus === 'closed' ? (
          <button
            onClick={() => setTab('retros')}
            className={`px-5 py-3 text-[13px] font-semibold transition-colors ${
              tab === 'retros'
                ? 'text-[#7B2FBE] border-b-2 border-[#7B2FBE]'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Team Retros
            {retros.filter(r => r.submitted_at).length > 0 && (
              <span className="ml-1.5 bg-[#ede9fe] text-[#7B2FBE] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {retros.filter(r => r.submitted_at).length}
              </span>
            )}
          </button>
        ) : null}
      </div>

      {tab === 'ninebox' ? (
        <NineBoxView
          cycleId={cycleId}
          cycleName={cycleName}
          directReports={directReports}
          initialReviews={initialReviews}
          submittedAt={submittedAt}
          managerName={managerName}
          hideBorder
        />
      ) : (
        <TeamRetros
          cycleName={cycleName}
          directReports={directReports}
          retros={retros}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add `hideBorder` prop to `NineBoxView`**

In `components/ninebox/NineBoxView.tsx`, update the Props interface and the root div:

```tsx
interface Props {
  cycleId: string
  cycleName: string
  directReports: DirectReport[]
  initialReviews: Review[]
  submittedAt: string | null
  managerName: string
  hideBorder?: boolean  // add this
}

export function NineBoxView({ cycleId, cycleName, directReports, initialReviews, submittedAt, managerName, hideBorder }: Props) {
  // ...existing code...

  return (
    <div className={hideBorder ? 'overflow-hidden' : 'bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden max-w-[920px] mx-auto'}>
```

- [ ] **Step 4: Update `app/(manager)/review/[cycleId]/page.tsx`**

```tsx
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { redirect } from 'next/navigation'
import { ReviewTabsView } from '@/components/manager/ReviewTabsView'

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ cycleId: string }>
}) {
  const { cycleId } = await params
  const session = await auth()
  if (!session || session.user.role !== 'manager') redirect('/login')

  const supabase = createClient()

  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('id, name, status, retro_status')
    .eq('id', cycleId)
    .single()

  if (!cycle) redirect('/review')

  const { data: assignments } = await supabase
    .from('manager_assignments')
    .select('direct_report_id, direct_reports(id, full_name, job_title, gusto_employee_id, slack_user_id, created_at)')
    .eq('manager_id', session.user.id)
    .eq('review_cycle_id', cycleId)

  const directReports = (assignments ?? [])
    .map((a: any) => a.direct_reports)
    .filter(Boolean)

  const drIds = directReports.map((dr: any) => dr.id)

  const [reviewsRes, retrosRes] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, direct_report_id, performance, potential, comments, submitted_at, manager_id, review_cycle_id')
      .eq('manager_id', session.user.id)
      .eq('review_cycle_id', cycleId),
    drIds.length > 0
      ? supabase
          .from('retros')
          .select('id, cycle_id, employee_id, responses, submitted_at, manager_comment, manager_commented_at, created_at')
          .eq('cycle_id', cycleId)
          .in('employee_id', drIds)
      : Promise.resolve({ data: [] }),
  ])

  const firstSubmitted = reviewsRes.data?.find(r => r.submitted_at) ?? null

  return (
    <div className="min-h-screen bg-[#f4f4f6] p-6">
      <ReviewTabsView
        cycleId={cycleId}
        cycleName={cycle.name}
        directReports={directReports}
        initialReviews={reviewsRes.data ?? []}
        submittedAt={firstSubmitted?.submitted_at ?? null}
        managerName={session.user.name ?? ''}
        retros={(retrosRes.data ?? []) as any}
        retroStatus={cycle.retro_status}
      />
    </div>
  )
}
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/manager/ components/ninebox/NineBoxView.tsx app/\(manager\)/review/\[cycleId\]/page.tsx
git commit -m "feat: add Team Retros tab to manager review flow"
```

---

## Task 8: Admin Assignments Tab Redesign

**Files:**
- Create: `components/admin/AssignmentsView.tsx`
- Modify: `app/(admin)/admin/[cycleId]/assignments/page.tsx`

- [ ] **Step 1: Create `components/admin/AssignmentsView.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface EmployeeRow {
  employeeId: string
  employeeName: string
  jobTitle: string | null
  managerId: string
  managerName: string
  reviewSubmittedAt: string | null
  retroSubmittedAt: string | null
}

interface Props {
  cycleId: string
  cycleName: string
  retroStatus: 'draft' | 'active' | 'closed'
  retroQuestions: string[]
  employees: EmployeeRow[]
  totalManagers: number
  submittedManagerCount: number
}

export function AssignmentsView({
  cycleId,
  cycleName,
  retroStatus,
  retroQuestions,
  employees,
  totalManagers,
  submittedManagerCount,
}: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [questions, setQuestions] = useState<string[]>(retroQuestions)
  const [launching, setLaunching] = useState(false)
  const [launched, setLaunched] = useState(false)
  const [filterManager, setFilterManager] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const submittedRetros = employees.filter(e => e.retroSubmittedAt).length
  const uniqueManagers = [...new Set(employees.map(e => e.managerName))].sort()

  const filtered = filterManager
    ? employees.filter(e => e.managerName === filterManager)
    : employees

  async function launchRetro() {
    setLaunching(true)
    await fetch('/api/retro/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycleId, questions }),
    })
    setLaunching(false)
    setLaunched(true)
    setShowModal(false)
    router.refresh()
  }

  async function copyRetroLink(employeeId: string) {
    const res = await fetch('/api/retro/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, cycleId }),
    })
    const { url } = await res.json()
    await navigator.clipboard.writeText(url)
    setCopiedId(employeeId)
    setTimeout(() => setCopiedId(prev => (prev === employeeId ? null : prev)), 2000)
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[17px] font-bold">{cycleName} — Assignments</h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* People Analyzer card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">People Analyzer</p>
            <span className="text-[10px] font-bold text-green-700 bg-green-50 rounded-full px-2 py-0.5">Active</span>
          </div>
          <p className="text-2xl font-black text-gray-900">
            {submittedManagerCount}
            <span className="text-[14px] font-normal text-gray-400"> of {totalManagers} submitted</span>
          </p>
          <div className="bg-gray-100 rounded-full h-1.5 mt-3 mb-3">
            <div
              className="bg-[#7B2FBE] h-1.5 rounded-full transition-all"
              style={{ width: totalManagers > 0 ? `${(submittedManagerCount / totalManagers) * 100}%` : '0%' }}
            />
          </div>
        </div>

        {/* Retro card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Retro</p>
            {retroStatus === 'draft' ? (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">Not Launched</span>
            ) : (
              <span className="text-[10px] font-bold text-green-700 bg-green-50 rounded-full px-2 py-0.5">Active</span>
            )}
          </div>
          <p className="text-2xl font-black text-gray-900">
            {submittedRetros}
            <span className="text-[14px] font-normal text-gray-400"> of {employees.length} submitted</span>
          </p>
          <div className="bg-gray-100 rounded-full h-1.5 mt-3 mb-3">
            <div
              className="bg-[#7B2FBE] h-1.5 rounded-full transition-all"
              style={{ width: employees.length > 0 ? `${(submittedRetros / employees.length) * 100}%` : '0%' }}
            />
          </div>
          {retroStatus === 'draft' && (
            <button
              onClick={() => setShowModal(true)}
              className="w-full mt-1 text-[12px] font-bold text-[#7B2FBE] border border-[#7B2FBE] rounded-lg px-3 py-1.5 hover:bg-[#f0e8ff] transition-colors"
            >
              ✎ Edit Questions · Launch Retro
            </button>
          )}
          {launched && (
            <p className="text-[11px] text-green-600 font-semibold mt-2 text-center">✓ Links sent</p>
          )}
        </div>
      </div>

      {/* Filter + table */}
      <div className="flex items-center gap-3 mb-3">
        <select
          value={filterManager}
          onChange={e => setFilterManager(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">All Managers</option>
          {uniqueManagers.map(m => <option key={m}>{m}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{employees.length} employees · {totalManagers} managers</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Employee</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Manager</th>
              <th className="text-center px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">9-Box</th>
              <th className="text-center px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Retro</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(emp => (
              <tr key={emp.employeeId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <p className="font-semibold">{emp.employeeName}</p>
                  {emp.jobTitle && <p className="text-xs text-gray-400">{emp.jobTitle}</p>}
                </td>
                <td className="px-4 py-2.5 text-gray-500">{emp.managerName}</td>
                <td className="px-4 py-2.5 text-center">
                  {emp.reviewSubmittedAt
                    ? <span className="text-[11px] font-bold text-green-600">✓ Done</span>
                    : <span className="text-[11px] font-semibold text-amber-600">Pending</span>}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {retroStatus === 'draft'
                    ? <span className="text-[11px] text-gray-300">—</span>
                    : emp.retroSubmittedAt
                    ? <span className="text-[11px] font-bold text-green-600">✓ Done</span>
                    : <span className="text-[11px] font-semibold text-amber-600">Pending</span>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {retroStatus !== 'draft' && (
                    <button
                      onClick={() => copyRetroLink(emp.employeeId)}
                      className="text-[11px] border border-gray-200 rounded-lg px-2.5 py-1 bg-white text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      {copiedId === emp.employeeId ? '✓ Copied' : '🔗 Retro Link'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Launch Retro modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-[16px] font-bold mb-1">Launch Retro</h2>
            <p className="text-xs text-gray-400 mb-5">Edit questions if needed, then launch. Employees will receive a Slack DM with their link.</p>
            <div className="flex flex-col gap-4 mb-6">
              {questions.map((q, i) => (
                <div key={i}>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">Question {i + 1}</label>
                  <textarea
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-700 resize-none focus:outline-none focus:border-[#a78bfa] focus:ring-2 focus:ring-[#ede9fe] font-sans"
                    rows={2}
                    value={q}
                    onChange={e => setQuestions(prev => { const next = [...prev]; next[i] = e.target.value; return next })}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="text-sm text-gray-500 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={launchRetro}
                disabled={launching}
                className="text-sm font-bold text-white bg-[#7B2FBE] hover:bg-[#6a28a3] rounded-lg px-4 py-2 disabled:bg-[#e8e0f5] disabled:text-[#b09cc8] transition-colors"
              >
                {launching ? 'Launching…' : 'Launch Retro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update `app/(admin)/admin/[cycleId]/assignments/page.tsx`**

```tsx
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { redirect } from 'next/navigation'
import { AssignmentsView } from '@/components/admin/AssignmentsView'

export default async function AssignmentsPage({
  params,
}: {
  params: Promise<{ cycleId: string }>
}) {
  const { cycleId } = await params
  const session = await auth()
  if (!session || session.user.role !== 'admin') redirect('/login')

  const supabase = createClient()

  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('name, status, retro_status, retro_questions')
    .eq('id', cycleId)
    .single()

  if (!cycle) redirect('/admin')

  // All assignments: employee + manager info
  const { data: assignments } = await supabase
    .from('manager_assignments')
    .select(`
      manager_id,
      manager:users!manager_id(id, first_name, last_name),
      direct_report:direct_reports!direct_report_id(id, full_name, job_title)
    `)
    .eq('review_cycle_id', cycleId)

  // Submitted reviews (to determine per-employee 9-box status)
  const { data: submitted } = await supabase
    .from('reviews')
    .select('direct_report_id, submitted_at')
    .eq('review_cycle_id', cycleId)
    .not('submitted_at', 'is', null)

  const submittedDrIds = new Set((submitted ?? []).map((r: any) => r.direct_report_id as string))
  const submittedDrDates = new Map((submitted ?? []).map((r: any) => [r.direct_report_id as string, r.submitted_at as string]))

  // Submitted retros
  const { data: retros } = await supabase
    .from('retros')
    .select('employee_id, submitted_at')
    .eq('cycle_id', cycleId)
    .not('submitted_at', 'is', null)

  const retroDates = new Map((retros ?? []).map((r: any) => [r.employee_id as string, r.submitted_at as string]))

  // Managers who have submitted (for PA stat card)
  const { data: managerSubmissions } = await supabase
    .from('reviews')
    .select('manager_id')
    .eq('review_cycle_id', cycleId)
    .not('submitted_at', 'is', null)

  const submittedManagerIds = new Set((managerSubmissions ?? []).map((r: any) => r.manager_id as string))

  const allManagerIds = new Set((assignments ?? []).map((a: any) => a.manager_id as string))

  const employees = (assignments ?? []).map((a: any) => ({
    employeeId: a.direct_report.id,
    employeeName: a.direct_report.full_name,
    jobTitle: a.direct_report.job_title ?? null,
    managerId: a.manager_id,
    managerName: `${a.manager.first_name} ${a.manager.last_name}`,
    reviewSubmittedAt: submittedDrDates.get(a.direct_report.id) ?? null,
    retroSubmittedAt: retroDates.get(a.direct_report.id) ?? null,
  }))

  return (
    <AssignmentsView
      cycleId={cycleId}
      cycleName={cycle.name}
      retroStatus={cycle.retro_status as 'draft' | 'active' | 'closed'}
      retroQuestions={(cycle.retro_questions as unknown as string[])}
      employees={employees}
      totalManagers={allManagerIds.size}
      submittedManagerCount={submittedManagerIds.size}
    />
  )
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/admin/AssignmentsView.tsx app/\(admin\)/admin/\[cycleId\]/assignments/page.tsx
git commit -m "feat: redesign Assignments tab with dual stat cards and employee-level table"
```

---

## Task 9: Admin Results Tab Redesign

**Files:**
- Modify: `components/admin/ResultsTable.tsx`
- Modify: `app/(admin)/admin/[cycleId]/results/page.tsx`

- [ ] **Step 1: Update `app/(admin)/admin/[cycleId]/results/page.tsx`**

```tsx
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { redirect } from 'next/navigation'
import { ResultsTable } from '@/components/admin/ResultsTable'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ cycleId: string }>
}) {
  const { cycleId } = await params
  const session = await auth()
  if (!session || session.user.role !== 'admin') redirect('/login')

  const supabase = createClient()

  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('name')
    .eq('id', cycleId)
    .single()

  const [reviewsRes, retrosRes, managerCountRes, employeeCountRes] = await Promise.all([
    supabase
      .from('reviews')
      .select(`
        id, manager_id, performance, potential, comments, submitted_at,
        manager:users!manager_id(first_name, last_name),
        direct_report:direct_reports!direct_report_id(id, full_name, job_title)
      `)
      .eq('review_cycle_id', cycleId)
      .not('submitted_at', 'is', null)
      .order('submitted_at'),
    supabase
      .from('retros')
      .select('id, employee_id, responses, submitted_at, manager_comment')
      .eq('cycle_id', cycleId),
    supabase
      .from('manager_assignments')
      .select('manager_id')
      .eq('review_cycle_id', cycleId),
    supabase
      .from('manager_assignments')
      .select('direct_report_id')
      .eq('review_cycle_id', cycleId),
  ])

  const totalManagers = new Set((managerCountRes.data ?? []).map((a: any) => a.manager_id as string)).size
  const totalEmployees = new Set((employeeCountRes.data ?? []).map((a: any) => a.direct_report_id as string)).size
  // Count unique managers who submitted (reviewsRes only has submitted rows due to .not('submitted_at','is',null))
  const submittedManagers = new Set((reviewsRes.data ?? []).map((r: any) => r.manager_id as string)).size

  const submittedRetros = (retrosRes.data ?? []).filter((r: any) => r.submitted_at).length

  const rows = (reviewsRes.data ?? []).map((r: any) => ({
    reviewId: r.id,
    employeeId: r.direct_report.id,
    managerName: `${r.manager.first_name} ${r.manager.last_name}`,
    employeeName: r.direct_report.full_name,
    jobTitle: r.direct_report.job_title,
    performance: r.performance,
    potential: r.potential,
    comments: r.comments ?? null,
    submittedAt: r.submitted_at,
  }))

  const retros = (retrosRes.data ?? []).map((r: any) => ({
    id: r.id,
    employeeId: r.employee_id,
    responses: r.responses ?? [],
    submittedAt: r.submitted_at,
    managerComment: r.manager_comment ?? null,
  }))

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-[17px] font-bold">{cycle?.name} — Results</h1>
          <p className="text-xs text-gray-400 mt-0.5">{rows.length} submitted placements</p>
        </div>
        <Link href={`/api/export?cycleId=${cycleId}`}>
          <Button variant="outline" size="sm" className="text-xs">📤 Export CSV</Button>
        </Link>
      </div>
      <ResultsTable
        rows={rows}
        retros={retros}
        totalManagers={totalManagers}
        submittedManagers={submittedManagers}
        totalEmployees={totalEmployees}
        submittedRetros={submittedRetros}
      />
    </div>
  )
}
```

- [ ] **Step 2: Update `components/admin/ResultsTable.tsx`**

Replace the entire file:

```tsx
'use client'
import { useState } from 'react'
import { NINE_BOX_CELLS } from '@/lib/types'
import type { PerfLevel, RetroResponse } from '@/lib/types'

interface ResultRow {
  reviewId: string
  employeeId: string
  managerName: string
  employeeName: string
  jobTitle: string | null
  performance: PerfLevel | null
  potential: PerfLevel | null
  comments: string | null
  submittedAt: string | null
}

interface RetroRow {
  id: string
  employeeId: string
  responses: RetroResponse[]
  submittedAt: string | null
  managerComment: string | null
}

interface Props {
  rows: ResultRow[]
  retros: RetroRow[]
  totalManagers: number
  submittedManagers: number
  totalEmployees: number
  submittedRetros: number
}

const POTENTIAL_ORDER: PerfLevel[] = ['high', 'medium', 'low']
const PERFORMANCE_ORDER: PerfLevel[] = ['low', 'medium', 'high']

export function ResultsTable({
  rows,
  retros,
  totalManagers,
  submittedManagers,
  totalEmployees,
  submittedRetros,
}: Props) {
  const [filterManager, setFilterManager] = useState('')
  const [filterCell, setFilterCell] = useState('')
  const [view, setView] = useState<'list' | 'ninebox'>('list')
  const [tooltip, setTooltip] = useState<string | null>(null)
  const [selectedRetroEmployeeId, setSelectedRetroEmployeeId] = useState<string | null>(null)

  const managers = [...new Set(rows.map(r => r.managerName))].sort()
  const retroByEmployee = new Map(retros.map(r => [r.employeeId, r]))

  const filtered = rows.filter(r => {
    if (filterManager && r.managerName !== filterManager) return false
    if (filterCell) {
      const cell = NINE_BOX_CELLS.find(c => c.label === filterCell)
      if (cell && (r.performance !== cell.performance || r.potential !== cell.potential)) return false
    }
    return true
  })

  function getCellForRow(perf: PerfLevel | null, pot: PerfLevel | null) {
    if (!perf || !pot) return null
    return NINE_BOX_CELLS.find(c => c.performance === perf && c.potential === pot) ?? null
  }

  function getCellLabel(perf: PerfLevel | null, pot: PerfLevel | null) {
    return getCellForRow(perf, pot)?.label ?? '—'
  }

  // KPI: needs attention = low performance OR low potential
  const needsAttention = rows.filter(r => r.performance === 'low' || r.potential === 'low').length

  // KPI: top placement
  const labelCounts = new Map<string, number>()
  for (const r of rows) {
    const label = getCellLabel(r.performance, r.potential)
    if (label !== '—') labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1)
  }
  const topLabel = [...labelCounts.entries()].sort((a, b) => b[1] - a[1])[0]

  const selectedRetro = selectedRetroEmployeeId ? retroByEmployee.get(selectedRetroEmployeeId) : null
  const selectedRow = selectedRetroEmployeeId ? rows.find(r => r.employeeId === selectedRetroEmployeeId) : null

  return (
    <div>
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">9-Box Complete</p>
          <p className="text-2xl font-black text-gray-900">
            {submittedManagers}<span className="text-[13px] font-normal text-gray-400">/{totalManagers}</span>
          </p>
          <p className="text-[11px] text-green-600 font-semibold mt-1">
            {totalManagers > 0 ? Math.round((submittedManagers / totalManagers) * 100) : 0}%
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Retro Complete</p>
          <p className="text-2xl font-black text-gray-900">
            {submittedRetros}<span className="text-[13px] font-normal text-gray-400">/{totalEmployees}</span>
          </p>
          <p className="text-[11px] text-green-600 font-semibold mt-1">
            {totalEmployees > 0 ? Math.round((submittedRetros / totalEmployees) * 100) : 0}%
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Top Placement</p>
          <p className="text-[15px] font-black text-gray-900 leading-tight">{topLabel?.[0] ?? '—'}</p>
          <p className="text-[11px] text-gray-400 mt-1">{topLabel?.[1] ?? 0} employees</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Needs Attention</p>
          <p className="text-2xl font-black text-gray-900">{needsAttention}</p>
          <p className="text-[11px] text-amber-600 font-semibold mt-1">Low perf or potential</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-3">
          <select
            value={filterManager}
            onChange={e => setFilterManager(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="">All Managers</option>
            {managers.map(m => <option key={m}>{m}</option>)}
          </select>
          {view === 'list' && (
            <select
              value={filterCell}
              onChange={e => setFilterCell(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
            >
              <option value="">All Quadrants</option>
              {NINE_BOX_CELLS.map(c => <option key={c.label}>{c.label}</option>)}
            </select>
          )}
        </div>

        <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white text-[13px]">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 transition-colors ${view === 'list' ? 'bg-[#7B2FBE] text-white font-semibold' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            ☰ List
          </button>
          <button
            onClick={() => setView('ninebox')}
            className={`px-3 py-1.5 border-l border-gray-200 transition-colors ${view === 'ninebox' ? 'bg-[#7B2FBE] text-white font-semibold' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            ⊞ 9-Box
          </button>
        </div>
      </div>

      {/* List view */}
      {view === 'list' && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Manager</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Employee</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Placement</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Note</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Submitted</th>
                  <th className="text-center px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Retro</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => {
                  const cell = getCellForRow(row.performance, row.potential)
                  const retro = retroByEmployee.get(row.employeeId)
                  return (
                    <tr key={row.reviewId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2.5">{row.managerName}</td>
                      <td className="px-4 py-2.5">
                        <p>{row.employeeName}</p>
                        {row.jobTitle && <p className="text-xs text-gray-400">{row.jobTitle}</p>}
                      </td>
                      <td className="px-4 py-2.5">
                        {cell ? (
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                            style={{ background: cell.color, color: cell.textColor }}
                          >
                            {cell.label}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[200px]">
                        {row.comments
                          ? <span className="italic">{row.comments}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">
                        {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {retro?.submitted_at ? (
                          <button
                            onClick={() => setSelectedRetroEmployeeId(row.employeeId)}
                            className="text-[11px] font-semibold text-[#7B2FBE] border border-[#ddd0f5] rounded-lg px-2.5 py-1 hover:bg-[#f0e8ff] transition-colors"
                          >
                            View
                          </button>
                        ) : (
                          <span className="text-gray-300 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">{filtered.length} of {rows.length} results</p>
        </>
      )}

      {/* 9-Box view */}
      {view === 'ninebox' && (
        <div className="relative">
          <div className="flex gap-3">
            <div className="flex flex-col items-center justify-center w-5 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 rotate-[-90deg] whitespace-nowrap">
                Potential ↑
              </span>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-3 gap-2 mb-1 pl-[52px]">
                {(['Low', 'Medium', 'High'] as const).map(l => (
                  <div key={l} className="text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">{l}</div>
                ))}
              </div>
              {POTENTIAL_ORDER.map(pot => (
                <div key={pot} className="flex gap-2 mb-2 items-stretch">
                  <div className="w-12 shrink-0 flex items-center justify-end pr-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 capitalize">{pot}</span>
                  </div>
                  {PERFORMANCE_ORDER.map(perf => {
                    const cell = NINE_BOX_CELLS.find(c => c.performance === perf && c.potential === pot)!
                    const occupants = filtered.filter(r => r.performance === perf && r.potential === pot)
                    return (
                      <div
                        key={perf}
                        className="flex-1 rounded-xl p-3 min-h-[110px] flex flex-col gap-1.5"
                        style={{ background: cell.color }}
                      >
                        <p className="text-[10px] font-bold text-gray-600 leading-tight">{cell.label}</p>
                        <p className="text-[9px] text-gray-400 leading-tight mb-1">{cell.description}</p>
                        <div className="flex flex-col gap-1">
                          {occupants.map(r => (
                            <div
                              key={r.reviewId}
                              className="group relative"
                              onMouseEnter={() => setTooltip(r.reviewId)}
                              onMouseLeave={() => setTooltip(null)}
                            >
                              <div className="bg-white/80 backdrop-blur-sm rounded-lg px-2 py-1 cursor-default">
                                <p className="text-[11px] font-semibold text-gray-800 leading-tight truncate">{r.employeeName}</p>
                                {!filterManager && (
                                  <p className="text-[10px] text-gray-400 leading-tight truncate">{r.managerName}</p>
                                )}
                              </div>
                              {tooltip === r.reviewId && r.comments && (
                                <div className="absolute z-10 bottom-full left-0 mb-1 w-48 bg-gray-900 text-white text-[11px] rounded-lg px-2.5 py-2 shadow-lg pointer-events-none">
                                  <p className="italic">{r.comments}</p>
                                </div>
                              )}
                            </div>
                          ))}
                          {occupants.length === 0 && (
                            <p className="text-[10px] text-gray-300 italic">—</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
              <div className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-1">
                Performance →
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">{filtered.length} placements · hover a name to see notes</p>
        </div>
      )}

      {/* Retro slide-over */}
      {selectedRetro && selectedRow && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/30"
            onClick={() => setSelectedRetroEmployeeId(null)}
          />
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[15px] font-bold">{selectedRow.employeeName}</p>
                <p className="text-xs text-gray-400">{selectedRow.managerName}</p>
              </div>
              <button
                onClick={() => setSelectedRetroEmployeeId(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-light"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-5">
              {selectedRetro.responses.map((r, i) => (
                <div key={i}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#7B2FBE] mb-1">{r.question}</p>
                  <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">{r.answer}</p>
                </div>
              ))}
              {selectedRetro.managerComment && (
                <div className="bg-[#f0e8ff] border border-[#ddd0f5] rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#7B2FBE] mb-1">Manager Feedback</p>
                  <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedRetro.managerComment}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run TypeScript check and tests**

```bash
npx tsc --noEmit && npx jest --no-coverage
```

Expected: no TS errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/admin/ResultsTable.tsx app/\(admin\)/admin/\[cycleId\]/results/page.tsx
git commit -m "feat: redesign Results tab with KPI cards, colored placement tags, and Retro slide-over"
```

---

## Task 10: Final Build Verification

- [ ] **Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Run a production build**

```bash
npx next build
```

Expected: build completes with no errors. Check for any `Warning: ...` messages and resolve any that indicate broken imports or missing types.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Retro + Dashboard — complete implementation"
```
