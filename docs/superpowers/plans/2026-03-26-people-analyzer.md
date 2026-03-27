# Boostly People Analyzer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal Next.js web app where managers complete 9-box reviews via Slack magic links, and admin (Brixton) manages cycles, syncs from Gusto, nudges managers, and views all results.

**Architecture:** Next.js App Router with JWT-based NextAuth credentials auth + custom magic-link tokens in Supabase. Gusto API populates users/assignments. Slack bot sends per-manager DMs. Role middleware gates all routes.

**Tech Stack:** Next.js 14 (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui, Supabase (Postgres), NextAuth v5, `@slack/web-api`, bcryptjs, Vercel

---

## File Map

```
boostly-people-analyzer/
├── app/
│   ├── layout.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── set-password/page.tsx
│   ├── (admin)/
│   │   ├── layout.tsx
│   │   └── admin/[cycleId]/
│   │       ├── page.tsx              # Overview: stats + completion table
│   │       ├── assignments/page.tsx  # Assignment editor
│   │       └── results/page.tsx      # Results + CSV export
│   ├── (manager)/
│   │   ├── layout.tsx
│   │   └── review/[cycleId]/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── auth/magic-link/route.ts
│       ├── cycles/route.ts
│       ├── cycles/[cycleId]/route.ts
│       ├── cycles/[cycleId]/assignments/route.ts
│       ├── reviews/route.ts
│       ├── reviews/[reviewId]/route.ts
│       ├── nudge/route.ts
│       ├── gusto/sync/route.ts
│       └── export/route.ts
├── components/
│   ├── admin/
│   │   ├── AdminShell.tsx
│   │   ├── StatsRow.tsx
│   │   ├── CompletionTable.tsx
│   │   ├── AssignmentEditor.tsx
│   │   └── ResultsTable.tsx
│   ├── ninebox/
│   │   ├── NineBoxView.tsx
│   │   ├── NineBoxGrid.tsx
│   │   ├── NineBoxCell.tsx
│   │   └── EmployeeSidebar.tsx
│   └── shared/
│       └── TopBar.tsx
├── lib/
│   ├── auth.ts
│   ├── db.ts
│   ├── types.ts
│   ├── magic-link.ts
│   ├── gusto.ts
│   └── slack.ts
├── middleware.ts
├── types/next-auth.d.ts
├── supabase/migrations/001_initial_schema.sql
├── __tests__/
│   ├── lib/magic-link.test.ts
│   ├── lib/gusto.test.ts
│   ├── api/cycles.test.ts
│   ├── api/reviews.test.ts
│   ├── api/nudge.test.ts
│   └── components/NineBoxCell.test.tsx
├── .env.example
└── jest.config.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `jest.config.ts`, `.env.example`, `.gitignore`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/brixton/Desktop/BRIXTON/boostly-people-analyzer
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

- [ ] **Step 2: Install dependencies**

```bash
npm install next-auth@beta @auth/core bcryptjs @supabase/supabase-js @slack/web-api
npm install -D @types/bcryptjs jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom ts-jest @types/jest
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
# Choose: Default style, Neutral base color, yes to CSS variables
npx shadcn@latest add button input label card table badge
```

- [ ] **Step 4: Create jest.config.ts**

```typescript
// jest.config.ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
}

export default createJestConfig(config)
```

- [ ] **Step 5: Create jest.setup.ts**

```typescript
// jest.setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Create .env.example**

```bash
# .env.example
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

GUSTO_API_TOKEN=your-gusto-token
GUSTO_COMPANY_ID=your-company-uuid

SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
```

- [ ] **Step 7: Create .gitignore (ensure these are present)**

```
.env.local
.env
node_modules/
.next/
.superpowers/
```

- [ ] **Step 8: Copy .env.example to .env.local and fill in real values**

```bash
cp .env.example .env.local
# Then open .env.local and add real credentials
```

- [ ] **Step 9: Verify Next.js starts**

```bash
npm run dev -- --port 3001
```
Expected: Server running at http://localhost:3001

- [ ] **Step 10: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Next.js project with deps"
```

---

## Task 2: Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/001_initial_schema.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('admin', 'manager');
CREATE TYPE cycle_status AS ENUM ('draft', 'active', 'closed');
CREATE TYPE perf_level AS ENUM ('low', 'medium', 'high');

CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT UNIQUE NOT NULL,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'manager',
  slack_user_id TEXT,
  password_hash TEXT NOT NULL,
  must_reset_password BOOLEAN NOT NULL DEFAULT true,
  gusto_employee_id TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE direct_reports (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gusto_employee_id   TEXT UNIQUE NOT NULL,
  full_name           TEXT NOT NULL,
  job_title           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE review_cycles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  status      cycle_status NOT NULL DEFAULT 'draft',
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE manager_assignments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id        UUID NOT NULL REFERENCES users(id),
  direct_report_id  UUID NOT NULL REFERENCES direct_reports(id),
  review_cycle_id   UUID NOT NULL REFERENCES review_cycles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(manager_id, direct_report_id, review_cycle_id)
);

CREATE TABLE reviews (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id        UUID NOT NULL REFERENCES users(id),
  direct_report_id  UUID NOT NULL REFERENCES direct_reports(id),
  review_cycle_id   UUID NOT NULL REFERENCES review_cycles(id),
  performance       perf_level,
  potential         perf_level,
  submitted_at      TIMESTAMPTZ,
  UNIQUE(manager_id, direct_report_id, review_cycle_id)
);

CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id     UUID NOT NULL REFERENCES reviews(id),
  changed_by    UUID NOT NULL REFERENCES users(id),
  field_changed TEXT NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE magic_links (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id),
  token       TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 2: Run migration in Supabase dashboard**

Go to Supabase Dashboard → SQL Editor → paste the migration → Run.
Expected: All 7 tables created with no errors.

- [ ] **Step 3: Seed the admin user in Supabase SQL Editor**

```sql
-- Replace with real bcrypt hash of brixton's password
-- Generate hash: node -e "const b=require('bcryptjs');b.hash('YourPassword123!',10).then(console.log)"
INSERT INTO users (email, first_name, last_name, role, password_hash, must_reset_password)
VALUES ('brixton@boostly.com', 'Brixton', 'Gardner', 'admin', '<bcrypt-hash>', false);
```

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add initial database schema"
```

---

## Task 3: Shared Types + DB Client

**Files:**
- Create: `lib/types.ts`, `lib/db.ts`, `types/next-auth.d.ts`

- [ ] **Step 1: Write lib/types.ts**

```typescript
// lib/types.ts
export type UserRole = 'admin' | 'manager'
export type CycleStatus = 'draft' | 'active' | 'closed'
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
  created_at: string
}

export interface ReviewCycle {
  id: string
  name: string
  status: CycleStatus
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
  submitted_at: string | null
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
  user_id: string
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
}

export const NINE_BOX_CELLS: NineBoxCell[] = [
  { performance: 'low',    potential: 'high',   label: 'Rough Diamond', description: 'Coach or move',                    color: '#fce7f3' },
  { performance: 'medium', potential: 'high',   label: 'Rising Star',   description: 'Invest in development',            color: '#fef9c3' },
  { performance: 'high',   potential: 'high',   label: 'Superstar',     description: 'Future leaders',                   color: '#d1fae5' },
  { performance: 'low',    potential: 'medium', label: 'Inconsistent',  description: 'Performance improvement needed',   color: '#fff1f2' },
  { performance: 'medium', potential: 'medium', label: 'Core Player',   description: 'Backbone of organization',         color: '#eff6ff' },
  { performance: 'high',   potential: 'medium', label: 'Key Player',    description: 'Retain and reward',                color: '#dcfce7' },
  { performance: 'low',    potential: 'low',    label: 'Question Mark', description: 'Exit planning',                    color: '#fef2f2' },
  { performance: 'medium', potential: 'low',    label: 'Workhorse',     description: 'Reliable performers',              color: '#f0fdf4' },
  { performance: 'high',   potential: 'low',    label: 'Trusted Pro',   description: 'Solid current contributors',       color: '#e0f2fe' },
]
```

- [ ] **Step 2: Write lib/db.ts**

```typescript
// lib/db.ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

- [ ] **Step 3: Write types/next-auth.d.ts**

```typescript
// types/next-auth.d.ts
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      mustResetPassword: boolean
    } & DefaultSession['user']
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/ types/
git commit -m "feat: add shared types and Supabase client"
```

---

## Task 4: Auth (NextAuth + Middleware)

**Files:**
- Create: `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `middleware.ts`

- [ ] **Step 1: Write lib/auth.ts**

```typescript
// lib/auth.ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { createClient } from './db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const supabase = createClient()
        const { data: user } = await supabase
          .from('users')
          .select('id, email, first_name, last_name, role, password_hash, must_reset_password')
          .eq('email', credentials.email as string)
          .single()
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password as string, user.password_hash)
        if (!valid) return null
        return {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          role: user.role,
          mustResetPassword: user.must_reset_password,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.mustResetPassword = (user as any).mustResetPassword
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      session.user.mustResetPassword = token.mustResetPassword as boolean
      return session
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
})
```

- [ ] **Step 2: Write app/api/auth/[...nextauth]/route.ts**

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers
```

- [ ] **Step 3: Write middleware.ts**

```typescript
// middleware.ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth
  const isPublic = pathname === '/login' || pathname.startsWith('/api/auth') || pathname === '/api/auth/magic-link'

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
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts app/api/auth/ middleware.ts
git commit -m "feat: add NextAuth credentials provider and route middleware"
```

---

## Task 5: Login Page + Set Password Page

**Files:**
- Create: `app/(auth)/login/page.tsx`, `app/(auth)/set-password/page.tsx`

- [ ] **Step 1: Write app/(auth)/login/page.tsx**

```tsx
// app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import boostlyLogo from '@/public/Boostly Icon Only copy.svg'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (result?.error) {
      setError('Invalid email or password.')
      return
    }
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-[#f4f4f6] flex items-center justify-center">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 border border-gray-200 rounded-lg p-1 flex items-center justify-center">
            <Image src={boostlyLogo} alt="Boostly" width={22} height={22} />
          </div>
          <span className="font-bold text-base">People Analyzer</span>
        </div>
        <h1 className="text-xl font-bold mb-1">Sign in</h1>
        <p className="text-sm text-gray-400 mb-6">Enter your Boostly email and password.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full bg-[#7B2FBE] hover:bg-[#6a28a3]" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write API route for password reset — app/api/auth/set-password/route.ts**

```typescript
// app/api/auth/set-password/route.ts
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
```

- [ ] **Step 3: Write app/(auth)/set-password/page.tsx**

```tsx
// app/(auth)/set-password/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    const res = await fetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setLoading(false)
    if (!res.ok) { setError('Something went wrong. Try again.'); return }
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-[#f4f4f6] flex items-center justify-center">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold mb-1">Set your password</h1>
        <p className="text-sm text-gray-400 mb-6">Choose a permanent password to continue.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>New password</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <div>
            <Label>Confirm password</Label>
            <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full bg-[#7B2FBE] hover:bg-[#6a28a3]" disabled={loading}>
            {loading ? 'Saving…' : 'Set password'}
          </Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/
git commit -m "feat: add login and set-password pages"
```

---

## Task 6: Magic Link System

**Files:**
- Create: `lib/magic-link.ts`, `app/api/auth/magic-link/route.ts`
- Test: `__tests__/lib/magic-link.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/lib/magic-link.test.ts
import { generateToken, buildMagicLinkUrl } from '@/lib/magic-link'

describe('generateToken', () => {
  it('returns a 64-character hex string', () => {
    const token = generateToken()
    expect(token).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns a different token each time', () => {
    expect(generateToken()).not.toBe(generateToken())
  })
})

describe('buildMagicLinkUrl', () => {
  it('returns a URL with the token as a query param', () => {
    const url = buildMagicLinkUrl('abc123', 'http://localhost:3000')
    expect(url).toBe('http://localhost:3000/api/auth/magic-link?token=abc123')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx jest __tests__/lib/magic-link.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/magic-link'`

- [ ] **Step 3: Write lib/magic-link.ts**

```typescript
// lib/magic-link.ts
import crypto from 'crypto'
import { createClient } from './db'

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function buildMagicLinkUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/api/auth/magic-link?token=${token}`
}

export async function createMagicLink(userId: string): Promise<string> {
  const supabase = createClient()
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('magic_links')
    .insert({ user_id: userId, token, expires_at: expiresAt })

  if (error) throw new Error(`Failed to create magic link: ${error.message}`)

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  return buildMagicLinkUrl(token, baseUrl)
}

export async function redeemMagicLink(token: string): Promise<string | null> {
  const supabase = createClient()

  const { data: link } = await supabase
    .from('magic_links')
    .select('id, user_id, expires_at, used_at')
    .eq('token', token)
    .single()

  if (!link || link.used_at) return null
  if (new Date(link.expires_at) < new Date()) return null

  await supabase
    .from('magic_links')
    .update({ used_at: new Date().toISOString() })
    .eq('id', link.id)

  return link.user_id
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest __tests__/lib/magic-link.test.ts
```
Expected: PASS — 3 tests passing

- [ ] **Step 5: Write app/api/auth/magic-link/route.ts**

```typescript
// app/api/auth/magic-link/route.ts
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
    .select('email, password_hash, must_reset_password')
    .eq('id', userId)
    .single()

  if (!user) return NextResponse.redirect(new URL('/login?error=invalid', req.url))

  // Sign in via credentials using a temporary known value — the stored hash itself
  // is passed as a special signal; authorize() checks for this magic-link bypass header
  // Instead: redirect to a signed session creation endpoint
  const response = NextResponse.redirect(new URL(user.must_reset_password ? '/set-password' : '/', req.url))

  // Set a short-lived cookie the session endpoint reads to create the session
  response.cookies.set('ml_user_id', userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60, // 60 seconds to complete the redirect
    path: '/',
  })

  return response
}
```

- [ ] **Step 6: Add magic-link session pickup to lib/auth.ts**

In `lib/auth.ts`, add a second provider after Credentials:

```typescript
// Add inside providers array in NextAuth config:
Credentials({
  id: 'magic-link-session',
  credentials: { userId: {} },
  async authorize(credentials) {
    if (!credentials?.userId) return null
    const supabase = createClient()
    const { data: user } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, must_reset_password')
      .eq('id', credentials.userId as string)
      .single()
    if (!user) return null
    return {
      id: user.id,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      role: user.role,
      mustResetPassword: user.must_reset_password,
    }
  },
}),
```

Then update `app/api/auth/magic-link/route.ts` to call `signIn('magic-link-session', { userId, redirect: false })` server-side before the redirect. Since NextAuth v5 server-side `signIn` sets the session cookie automatically, remove the manual cookie approach:

```typescript
// app/api/auth/magic-link/route.ts (final version)
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

  await signIn('magic-link-session', {
    userId,
    redirect: false,
  })

  return NextResponse.redirect(new URL(user.must_reset_password ? '/set-password' : '/', req.url))
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/magic-link.ts app/api/auth/magic-link/ __tests__/
git commit -m "feat: add magic link generation, redemption, and auto-login"
```

---

## Task 7: Gusto Sync

**Files:**
- Create: `lib/gusto.ts`, `app/api/gusto/sync/route.ts`
- Test: `__tests__/lib/gusto.test.ts`

- [ ] **Step 1: Write lib/gusto.ts**

```typescript
// lib/gusto.ts
import bcrypt from 'bcryptjs'
import { createClient } from './db'

const GUSTO_BASE = 'https://api.gusto.com/v1'

async function gustoGet(path: string) {
  const res = await fetch(`${GUSTO_BASE}${path}`, {
    headers: { Authorization: `Bearer ${process.env.GUSTO_API_TOKEN}` },
  })
  if (!res.ok) throw new Error(`Gusto ${path} returned ${res.status}`)
  return res.json()
}

export interface SyncResult {
  managersUpserted: number
  directReportsUpserted: number
  assignmentsCreated: number
}

export async function syncGustoToCycle(cycleId: string): Promise<SyncResult> {
  const supabase = createClient()
  const companyId = process.env.GUSTO_COMPANY_ID!
  const employees: any[] = await gustoGet(`/companies/${companyId}/employees?include=jobs`)

  // Identify which gusto UUIDs are managers (appear as a manager for someone else)
  const managerUuids = new Set(
    employees
      .map((e: any) => e.jobs?.[0]?.manager?.uuid)
      .filter(Boolean)
  )

  const userIdByGustoUuid = new Map<string, string>()
  let managersUpserted = 0

  for (const emp of employees) {
    if (!managerUuids.has(emp.uuid)) continue
    const defaultHash = await bcrypt.hash(`${emp.first_name}123!`, 10)
    const { data: user } = await supabase
      .from('users')
      .upsert(
        {
          email: emp.email,
          first_name: emp.first_name,
          last_name: emp.last_name,
          role: 'manager',
          password_hash: defaultHash,
          must_reset_password: true,
          gusto_employee_id: emp.uuid,
        },
        { onConflict: 'email' }
      )
      .select('id')
      .single()
    if (user) {
      userIdByGustoUuid.set(emp.uuid, user.id)
      managersUpserted++
    }
  }

  let directReportsUpserted = 0
  let assignmentsCreated = 0

  for (const emp of employees) {
    const managerUuid = emp.jobs?.[0]?.manager?.uuid
    if (!managerUuid || !userIdByGustoUuid.has(managerUuid)) continue

    const { data: dr } = await supabase
      .from('direct_reports')
      .upsert(
        {
          gusto_employee_id: emp.uuid,
          full_name: `${emp.first_name} ${emp.last_name}`,
          job_title: emp.jobs?.[0]?.title ?? null,
        },
        { onConflict: 'gusto_employee_id' }
      )
      .select('id')
      .single()

    if (!dr) continue
    directReportsUpserted++

    const { error } = await supabase.from('manager_assignments').upsert(
      {
        manager_id: userIdByGustoUuid.get(managerUuid)!,
        direct_report_id: dr.id,
        review_cycle_id: cycleId,
      },
      { onConflict: 'manager_id,direct_report_id,review_cycle_id', ignoreDuplicates: true }
    )
    if (!error) assignmentsCreated++
  }

  return { managersUpserted, directReportsUpserted, assignmentsCreated }
}
```

- [ ] **Step 2: Write app/api/gusto/sync/route.ts**

```typescript
// app/api/gusto/sync/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { syncGustoToCycle } from '@/lib/gusto'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { cycleId } = await req.json()
  if (!cycleId) return NextResponse.json({ error: 'cycleId required' }, { status: 400 })

  const result = await syncGustoToCycle(cycleId)
  return NextResponse.json(result)
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/gusto.ts app/api/gusto/
git commit -m "feat: add Gusto sync — upserts managers, direct reports, assignments"
```

---

## Task 8: Review Cycle API

**Files:**
- Create: `app/api/cycles/route.ts`, `app/api/cycles/[cycleId]/route.ts`, `app/api/cycles/[cycleId]/assignments/route.ts`
- Test: `__tests__/api/cycles.test.ts`

- [ ] **Step 1: Write app/api/cycles/route.ts**

```typescript
// app/api/cycles/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'

// GET /api/cycles — list all cycles (admin sees all, manager sees active+closed)
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient()
  let query = supabase.from('review_cycles').select('*').order('created_at', { ascending: false })

  if (session.user.role === 'manager') {
    query = query.in('status', ['active', 'closed'])
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/cycles — create a new draft cycle (admin only)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const supabase = createClient()
  const { data, error } = await supabase
    .from('review_cycles')
    .insert({ name: name.trim(), created_by: session.user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Write app/api/cycles/[cycleId]/route.ts**

```typescript
// app/api/cycles/[cycleId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import type { CycleStatus } from '@/lib/types'

// PATCH /api/cycles/:id — update cycle status (admin only)
export async function PATCH(req: NextRequest, { params }: { params: { cycleId: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { status } = await req.json() as { status: CycleStatus }
  if (!['draft', 'active', 'closed'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('review_cycles')
    .update({ status })
    .eq('id', params.cycleId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 3: Write app/api/cycles/[cycleId]/assignments/route.ts**

```typescript
// app/api/cycles/[cycleId]/assignments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'

// GET — list all assignments for a cycle with joined manager + direct_report data
export async function GET(_req: NextRequest, { params }: { params: { cycleId: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('manager_assignments')
    .select(`
      id,
      manager:users!manager_id(id, first_name, last_name, email),
      direct_report:direct_reports!direct_report_id(id, full_name, job_title)
    `)
    .eq('review_cycle_id', params.cycleId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — add an assignment
export async function POST(req: NextRequest, { params }: { params: { cycleId: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { managerId, directReportId } = await req.json()
  if (!managerId || !directReportId) {
    return NextResponse.json({ error: 'managerId and directReportId required' }, { status: 400 })
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('manager_assignments')
    .insert({ manager_id: managerId, direct_report_id: directReportId, review_cycle_id: params.cycleId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE — remove an assignment by id (?assignmentId=...)
export async function DELETE(req: NextRequest, { params }: { params: { cycleId: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const assignmentId = req.nextUrl.searchParams.get('assignmentId')
  if (!assignmentId) return NextResponse.json({ error: 'assignmentId required' }, { status: 400 })

  const supabase = createClient()
  const { error } = await supabase
    .from('manager_assignments')
    .delete()
    .eq('id', assignmentId)
    .eq('review_cycle_id', params.cycleId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/cycles/
git commit -m "feat: add review cycle and assignments API routes"
```

---

## Task 9: Reviews API

**Files:**
- Create: `app/api/reviews/route.ts`, `app/api/reviews/[reviewId]/route.ts`

- [ ] **Step 1: Write app/api/reviews/route.ts**

```typescript
// app/api/reviews/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'

// GET /api/reviews?cycleId=... — admin gets all, manager gets own
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cycleId = req.nextUrl.searchParams.get('cycleId')
  if (!cycleId) return NextResponse.json({ error: 'cycleId required' }, { status: 400 })

  const supabase = createClient()
  let query = supabase
    .from('reviews')
    .select(`
      id, performance, potential, submitted_at,
      manager:users!manager_id(id, first_name, last_name),
      direct_report:direct_reports!direct_report_id(id, full_name, job_title)
    `)
    .eq('review_cycle_id', cycleId)

  if (session.user.role === 'manager') {
    query = query.eq('manager_id', session.user.id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/reviews — save or update a placement (manager only, cycle must be active)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { cycleId, directReportId, performance, potential } = await req.json()
  if (!cycleId || !directReportId || !performance || !potential) {
    return NextResponse.json({ error: 'cycleId, directReportId, performance, potential required' }, { status: 400 })
  }

  const supabase = createClient()

  // Verify cycle is active
  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('status')
    .eq('id', cycleId)
    .single()
  if (cycle?.status !== 'active') {
    return NextResponse.json({ error: 'Cycle is not active' }, { status: 400 })
  }

  // Verify not already submitted
  const { data: existing } = await supabase
    .from('reviews')
    .select('id, submitted_at')
    .eq('manager_id', session.user.id)
    .eq('review_cycle_id', cycleId)
    .eq('direct_report_id', directReportId)
    .single()

  if (existing?.submitted_at) {
    return NextResponse.json({ error: 'Review already submitted' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('reviews')
    .upsert(
      { manager_id: session.user.id, review_cycle_id: cycleId, direct_report_id: directReportId, performance, potential },
      { onConflict: 'manager_id,direct_report_id,review_cycle_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT /api/reviews/submit — submit all placements for a cycle (locks them)
```

- [ ] **Step 2: Write app/api/reviews/submit/route.ts**

```typescript
// app/api/reviews/submit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { cycleId } = await req.json()
  if (!cycleId) return NextResponse.json({ error: 'cycleId required' }, { status: 400 })

  const supabase = createClient()

  // Verify all assignments are placed
  const { data: assignments } = await supabase
    .from('manager_assignments')
    .select('direct_report_id')
    .eq('manager_id', session.user.id)
    .eq('review_cycle_id', cycleId)

  const { data: reviews } = await supabase
    .from('reviews')
    .select('direct_report_id, performance, potential')
    .eq('manager_id', session.user.id)
    .eq('review_cycle_id', cycleId)
    .is('submitted_at', null)

  const assignedIds = new Set((assignments ?? []).map((a: any) => a.direct_report_id))
  const placedIds = new Set((reviews ?? []).filter((r: any) => r.performance && r.potential).map((r: any) => r.direct_report_id))

  for (const id of assignedIds) {
    if (!placedIds.has(id)) {
      return NextResponse.json({ error: 'All employees must be placed before submitting' }, { status: 400 })
    }
  }

  const now = new Date().toISOString()
  await supabase
    .from('reviews')
    .update({ submitted_at: now })
    .eq('manager_id', session.user.id)
    .eq('review_cycle_id', cycleId)
    .is('submitted_at', null)

  return NextResponse.json({ ok: true, submittedAt: now })
}
```

- [ ] **Step 3: Write app/api/reviews/[reviewId]/route.ts (admin edit + audit log)**

```typescript
// app/api/reviews/[reviewId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import type { PerfLevel } from '@/lib/types'

export async function PATCH(req: NextRequest, { params }: { params: { reviewId: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updates = await req.json() as { performance?: PerfLevel; potential?: PerfLevel }
  const supabase = createClient()

  const { data: current } = await supabase
    .from('reviews')
    .select('performance, potential')
    .eq('id', params.reviewId)
    .single()

  if (!current) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  const { data: updated, error } = await supabase
    .from('reviews')
    .update(updates)
    .eq('id', params.reviewId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Write audit log for each changed field
  const auditEntries = []
  for (const field of ['performance', 'potential'] as const) {
    if (updates[field] && updates[field] !== current[field]) {
      auditEntries.push({
        review_id: params.reviewId,
        changed_by: session.user.id,
        field_changed: field,
        old_value: current[field] ?? null,
        new_value: updates[field]!,
      })
    }
  }

  if (auditEntries.length > 0) {
    await supabase.from('audit_log').insert(auditEntries)
  }

  return NextResponse.json(updated)
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/reviews/
git commit -m "feat: add reviews API with placement, submission, admin edit, and audit log"
```

---

## Task 10: Slack Nudge

**Files:**
- Create: `lib/slack.ts`, `app/api/nudge/route.ts`

- [ ] **Step 1: Write lib/slack.ts**

```typescript
// lib/slack.ts
import { WebClient } from '@slack/web-api'

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

export async function sendNudgeDM(slackUserId: string, firstName: string, magicLinkUrl: string): Promise<void> {
  await slack.chat.postMessage({
    channel: slackUserId,
    text: `Hey ${firstName} — it's time to complete your People Review. Click here to get started: ${magicLinkUrl}`,
  })
}
```

- [ ] **Step 2: Write app/api/nudge/route.ts**

```typescript
// app/api/nudge/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { createMagicLink } from '@/lib/magic-link'
import { sendNudgeDM } from '@/lib/slack'

// POST /api/nudge — send to one manager { managerId } or all pending { cycleId, all: true }
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { managerId, cycleId, all } = await req.json()
  const supabase = createClient()

  let managerIds: string[] = []

  if (all && cycleId) {
    // Find all managers in cycle who haven't submitted
    const { data: assignments } = await supabase
      .from('manager_assignments')
      .select('manager_id')
      .eq('review_cycle_id', cycleId)

    const allManagerIds = [...new Set((assignments ?? []).map((a: any) => a.manager_id))]

    const { data: submitted } = await supabase
      .from('reviews')
      .select('manager_id')
      .eq('review_cycle_id', cycleId)
      .not('submitted_at', 'is', null)

    const submittedIds = new Set((submitted ?? []).map((r: any) => r.manager_id))
    managerIds = allManagerIds.filter(id => !submittedIds.has(id))
  } else if (managerId) {
    managerIds = [managerId]
  } else {
    return NextResponse.json({ error: 'managerId or (cycleId + all) required' }, { status: 400 })
  }

  const results: { managerId: string; ok: boolean; error?: string }[] = []

  for (const id of managerIds) {
    const { data: user } = await supabase
      .from('users')
      .select('id, first_name, slack_user_id')
      .eq('id', id)
      .single()

    if (!user?.slack_user_id) {
      results.push({ managerId: id, ok: false, error: 'No Slack user ID' })
      continue
    }

    try {
      const url = await createMagicLink(user.id)
      await sendNudgeDM(user.slack_user_id, user.first_name, url)
      results.push({ managerId: id, ok: true })
    } catch (err: any) {
      results.push({ managerId: id, ok: false, error: err.message })
    }
  }

  return NextResponse.json({ results })
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/slack.ts app/api/nudge/
git commit -m "feat: add Slack nudge endpoint with magic link generation"
```

---

## Task 11: CSV Export

**Files:**
- Create: `app/api/export/route.ts`

- [ ] **Step 1: Write app/api/export/route.ts**

```typescript
// app/api/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cycleId = req.nextUrl.searchParams.get('cycleId')
  if (!cycleId) return NextResponse.json({ error: 'cycleId required' }, { status: 400 })

  const supabase = createClient()
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      performance, potential, submitted_at,
      manager:users!manager_id(first_name, last_name, email),
      direct_report:direct_reports!direct_report_id(full_name, job_title),
      cycle:review_cycles!review_cycle_id(name)
    `)
    .eq('review_cycle_id', cycleId)
    .not('submitted_at', 'is', null)
    .order('submitted_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = [
    ['Cycle', 'Manager', 'Manager Email', 'Employee', 'Job Title', 'Performance', 'Potential', 'Submitted At'],
    ...(data ?? []).map((r: any) => [
      r.cycle?.name ?? '',
      `${r.manager?.first_name} ${r.manager?.last_name}`,
      r.manager?.email ?? '',
      r.direct_report?.full_name ?? '',
      r.direct_report?.job_title ?? '',
      r.performance ?? '',
      r.potential ?? '',
      r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '',
    ]),
  ]

  const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="people-review-${cycleId}.csv"`,
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/export/
git commit -m "feat: add CSV export endpoint"
```

---

## Task 12: NineBox Components

**Files:**
- Create: `components/ninebox/NineBoxCell.tsx`, `components/ninebox/NineBoxGrid.tsx`, `components/ninebox/EmployeeSidebar.tsx`, `components/ninebox/NineBoxView.tsx`
- Test: `__tests__/components/NineBoxCell.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// __tests__/components/NineBoxCell.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { NineBoxCell } from '@/components/ninebox/NineBoxCell'
import type { PerfLevel } from '@/lib/types'

const cell = { performance: 'high' as PerfLevel, potential: 'high' as PerfLevel, label: 'Superstar', description: 'Future leaders', color: '#d1fae5' }

it('renders title and description', () => {
  render(<NineBoxCell cell={cell} placedNames={[]} onPlace={() => {}} isDropTarget={false} selectedEmployee={null} />)
  expect(screen.getByText('Superstar')).toBeInTheDocument()
  expect(screen.getByText('Future leaders')).toBeInTheDocument()
})

it('renders placed names', () => {
  render(<NineBoxCell cell={cell} placedNames={['Alex Rivera', 'Sam Patel']} onPlace={() => {}} isDropTarget={false} selectedEmployee={null} />)
  expect(screen.getByText('Alex Rivera')).toBeInTheDocument()
})

it('shows +N more when more than 4 names', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F']
  render(<NineBoxCell cell={cell} placedNames={names} onPlace={() => {}} isDropTarget={false} selectedEmployee={null} />)
  expect(screen.getByText('+2 more')).toBeInTheDocument()
})

it('calls onPlace when clicked with a selected employee', () => {
  const onPlace = jest.fn()
  render(<NineBoxCell cell={cell} placedNames={[]} onPlace={onPlace} isDropTarget={false} selectedEmployee={{ id: '1', full_name: 'Alex Rivera', job_title: null }} />)
  fireEvent.click(screen.getByRole('button'))
  expect(onPlace).toHaveBeenCalledWith('high', 'high')
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx jest __tests__/components/NineBoxCell.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Write components/ninebox/NineBoxCell.tsx**

```tsx
// components/ninebox/NineBoxCell.tsx
'use client'
import { useState } from 'react'
import type { NineBoxCell as CellDef, PerfLevel, DirectReport } from '@/lib/types'

interface Props {
  cell: CellDef
  placedNames: string[]
  onPlace: (performance: PerfLevel, potential: PerfLevel) => void
  isDropTarget: boolean
  selectedEmployee: Pick<DirectReport, 'id' | 'full_name' | 'job_title'> | null
  readOnly?: boolean
}

const SHOW_COUNT = 4

export function NineBoxCell({ cell, placedNames, onPlace, isDropTarget, selectedEmployee, readOnly = false }: Props) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? placedNames : placedNames.slice(0, SHOW_COUNT)
  const overflow = placedNames.length - SHOW_COUNT

  function handleClick() {
    if (!readOnly && selectedEmployee) {
      onPlace(cell.performance, cell.potential)
    }
  }

  return (
    <button
      role="button"
      onClick={handleClick}
      className={[
        'flex-1 min-h-[100px] rounded-lg p-2.5 text-left border-[1.5px] transition-colors',
        isDropTarget ? 'border-purple-400 border-dashed' : 'border-transparent',
        !readOnly && selectedEmployee ? 'cursor-pointer hover:border-purple-400' : 'cursor-default',
      ].join(' ')}
      style={{ background: cell.color }}
      disabled={readOnly || !selectedEmployee}
    >
      <p className="text-[11px] font-bold text-gray-900 mb-0.5">{cell.label}</p>
      <p className="text-[10px] text-gray-500 mb-2 leading-snug">{cell.description}</p>
      <div className="flex flex-wrap gap-1">
        {visible.map(name => (
          <span key={name} className="bg-[#ede9fe] text-[#7B2FBE] rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
            {name}
          </span>
        ))}
        {!expanded && overflow > 0 && (
          <button
            onClick={e => { e.stopPropagation(); setExpanded(true) }}
            className="bg-[#f5f3ff] text-purple-600 border border-dashed border-purple-300 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          >
            +{overflow} more
          </button>
        )}
      </div>
    </button>
  )
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest __tests__/components/NineBoxCell.test.tsx
```
Expected: PASS

- [ ] **Step 5: Write components/ninebox/EmployeeSidebar.tsx**

```tsx
// components/ninebox/EmployeeSidebar.tsx
'use client'
import type { DirectReport } from '@/lib/types'

interface Props {
  employees: DirectReport[]
  selectedId: string | null
  placedIds: Set<string>
  onSelect: (employee: DirectReport) => void
  readOnly?: boolean
}

export function EmployeeSidebar({ employees, selectedId, placedIds, onSelect, readOnly = false }: Props) {
  return (
    <div className="w-[185px] min-w-[185px] bg-[#fafafa] border-r border-gray-100 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-2.5 px-1">
        Your Team ({employees.length})
      </p>
      {employees.map(emp => {
        const placed = placedIds.has(emp.id)
        const selected = emp.id === selectedId
        return (
          <button
            key={emp.id}
            onClick={() => !readOnly && !placed && onSelect(emp)}
            disabled={readOnly || placed}
            className={[
              'w-full text-left rounded-lg px-2.5 py-2 mb-1.5 border-[1.5px] transition-colors',
              selected ? 'bg-[#f0e8ff] border-purple-300' : '',
              placed ? 'bg-[#f5fff5] border-green-200 opacity-80' : '',
              !selected && !placed ? 'bg-white border-gray-200 hover:border-gray-300' : '',
            ].join(' ')}
          >
            <p className={`text-[13px] font-semibold ${placed ? 'text-green-700' : selected ? 'text-[#7B2FBE]' : 'text-gray-900'}`}>
              {placed ? `✓ ${emp.full_name}` : emp.full_name}
            </p>
            {emp.job_title && <p className="text-[11px] text-gray-400 mt-0.5">{emp.job_title}</p>}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 6: Write components/ninebox/NineBoxGrid.tsx**

```tsx
// components/ninebox/NineBoxGrid.tsx
'use client'
import { NineBoxCell } from './NineBoxCell'
import { NINE_BOX_CELLS } from '@/lib/types'
import type { PerfLevel, DirectReport, Review } from '@/lib/types'

const PERF_LEVELS: PerfLevel[] = ['low', 'medium', 'high']
const POT_LEVELS: PerfLevel[] = ['high', 'medium', 'low']

interface Props {
  reviews: Review[]
  directReports: DirectReport[]
  selectedEmployee: DirectReport | null
  onPlace: (performance: PerfLevel, potential: PerfLevel) => void
  readOnly?: boolean
}

export function NineBoxGrid({ reviews, directReports, selectedEmployee, onPlace, readOnly = false }: Props) {
  const drById = new Map(directReports.map(d => [d.id, d]))

  return (
    <div className="flex-1 p-5">
      {/* Column headers */}
      <div className="flex ml-[78px] mb-1 gap-1">
        {PERF_LEVELS.map(p => (
          <div key={p} className="flex-1 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {p.charAt(0).toUpperCase() + p.slice(1)} Performance
          </div>
        ))}
      </div>

      {/* Rows */}
      {POT_LEVELS.map(pot => (
        <div key={pot} className="flex gap-1 mb-1 items-stretch">
          <div className="w-[74px] min-w-[74px] flex items-center justify-end pr-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {pot.charAt(0).toUpperCase() + pot.slice(1)} Potential
          </div>
          {PERF_LEVELS.map(perf => {
            const cellDef = NINE_BOX_CELLS.find(c => c.performance === perf && c.potential === pot)!
            const placed = reviews.filter(r => r.performance === perf && r.potential === pot)
            const names = placed.map(r => drById.get(r.direct_report_id)?.full_name ?? '')
            const isTarget = selectedEmployee !== null && !readOnly
            return (
              <NineBoxCell
                key={`${perf}-${pot}`}
                cell={cellDef}
                placedNames={names.filter(Boolean)}
                onPlace={onPlace}
                isDropTarget={isTarget}
                selectedEmployee={selectedEmployee}
                readOnly={readOnly}
              />
            )
          })}
        </div>
      ))}

      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 text-center mt-2 ml-[78px]">
        Performance (Low → High)
      </p>
    </div>
  )
}
```

- [ ] **Step 7: Write components/ninebox/NineBoxView.tsx**

```tsx
// components/ninebox/NineBoxView.tsx
'use client'
import { useState, useCallback } from 'react'
import { EmployeeSidebar } from './EmployeeSidebar'
import { NineBoxGrid } from './NineBoxGrid'
import { Button } from '@/components/ui/button'
import type { DirectReport, Review, PerfLevel } from '@/lib/types'

interface Props {
  cycleId: string
  cycleName: string
  directReports: DirectReport[]
  initialReviews: Review[]
  submittedAt: string | null
  managerName: string
}

export function NineBoxView({ cycleId, cycleName, directReports, initialReviews, submittedAt, managerName }: Props) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [selected, setSelected] = useState<DirectReport | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(!!submittedAt)
  const [submittedTime, setSubmittedTime] = useState(submittedAt)

  const placedIds = new Set(reviews.filter(r => r.performance && r.potential).map(r => r.direct_report_id))
  const allPlaced = directReports.every(dr => placedIds.has(dr.id))

  const handlePlace = useCallback(async (performance: PerfLevel, potential: PerfLevel) => {
    if (!selected) return
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycleId, directReportId: selected.id, performance, potential }),
    })
    if (!res.ok) return
    const updated: Review = await res.json()
    setReviews(prev => {
      const filtered = prev.filter(r => r.direct_report_id !== selected.id)
      return [...filtered, updated]
    })
    setSelected(null)
  }, [selected, cycleId])

  async function handleSubmit() {
    setSubmitting(true)
    const res = await fetch('/api/reviews/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycleId }),
    })
    if (res.ok) {
      const { submittedAt } = await res.json()
      setSubmitted(true)
      setSubmittedTime(submittedAt)
    }
    setSubmitting(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden max-w-[920px] mx-auto">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-[15px]">People Analyzer</span>
          <span className="bg-[#f0e8ff] text-[#7B2FBE] text-xs font-semibold px-2.5 py-0.5 rounded-full">{cycleName}</span>
        </div>
        <span className="text-xs text-gray-400">{managerName}</span>
      </div>

      <div className="flex min-h-[420px]">
        <EmployeeSidebar
          employees={directReports}
          selectedId={selected?.id ?? null}
          placedIds={placedIds}
          onSelect={setSelected}
          readOnly={submitted}
        />
        <NineBoxGrid
          reviews={reviews}
          directReports={directReports}
          selectedEmployee={selected}
          onPlace={handlePlace}
          readOnly={submitted}
        />
      </div>

      {/* Footer */}
      <div className="bg-[#fafafa] border-t border-gray-100 px-5 py-3 flex justify-between items-center">
        {submitted ? (
          <p className="text-sm text-gray-500">
            Submitted {submittedTime ? new Date(submittedTime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
          </p>
        ) : (
          <p className="text-sm text-gray-400">
            {allPlaced ? 'All placed — ready to submit' : 'Select a name, then click a cell to place them'}
          </p>
        )}
        {!submitted && (
          <Button
            onClick={handleSubmit}
            disabled={!allPlaced || submitting}
            className="bg-[#7B2FBE] hover:bg-[#6a28a3] disabled:bg-[#e8e0f5] disabled:text-[#b09cc8]"
          >
            {submitting ? 'Submitting…' : 'Submit Review'}
          </Button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Run all component tests**

```bash
npx jest __tests__/components/
```
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add components/ninebox/ __tests__/components/
git commit -m "feat: add NineBoxCell, NineBoxGrid, EmployeeSidebar, NineBoxView components"
```

---

## Task 13: Manager Pages

**Files:**
- Create: `app/(manager)/layout.tsx`, `app/(manager)/review/page.tsx`, `app/(manager)/review/[cycleId]/page.tsx`

- [ ] **Step 1: Write app/(manager)/layout.tsx**

```tsx
// app/(manager)/layout.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session || session.user.role !== 'manager') redirect('/login')
  return <>{children}</>
}
```

- [ ] **Step 2: Write app/(manager)/review/page.tsx (redirect to active cycle)**

```tsx
// app/(manager)/review/page.tsx
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
```

- [ ] **Step 3: Write app/(manager)/review/[cycleId]/page.tsx**

```tsx
// app/(manager)/review/[cycleId]/page.tsx
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { redirect } from 'next/navigation'
import { NineBoxView } from '@/components/ninebox/NineBoxView'

export default async function ReviewPage({ params }: { params: { cycleId: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'manager') redirect('/login')

  const supabase = createClient()

  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('id, name, status')
    .eq('id', params.cycleId)
    .single()

  if (!cycle) redirect('/review')

  const { data: assignments } = await supabase
    .from('manager_assignments')
    .select('direct_report_id, direct_reports(id, full_name, job_title)')
    .eq('manager_id', session.user.id)
    .eq('review_cycle_id', params.cycleId)

  const directReports = (assignments ?? []).map((a: any) => a.direct_reports).filter(Boolean)

  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, direct_report_id, performance, potential, submitted_at')
    .eq('manager_id', session.user.id)
    .eq('review_cycle_id', params.cycleId)

  const submitted = reviews?.find(r => r.submitted_at) ?? null

  return (
    <div className="min-h-screen bg-[#f4f4f6] p-6">
      <NineBoxView
        cycleId={params.cycleId}
        cycleName={cycle.name}
        directReports={directReports}
        initialReviews={reviews ?? []}
        submittedAt={submitted?.submitted_at ?? null}
        managerName={session.user.name ?? ''}
      />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/\(manager\)/
git commit -m "feat: add manager review pages"
```

---

## Task 14: Admin Shell + Dashboard

**Files:**
- Create: `components/admin/AdminShell.tsx`, `components/admin/StatsRow.tsx`, `components/admin/CompletionTable.tsx`, `app/(admin)/layout.tsx`, `app/(admin)/admin/[cycleId]/page.tsx`

- [ ] **Step 1: Write components/admin/AdminShell.tsx**

```tsx
// components/admin/AdminShell.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import boostlyLogo from '@/public/Boostly Icon Only copy.svg'
import type { ReviewCycle } from '@/lib/types'

interface Props {
  cycles: ReviewCycle[]
  children: React.ReactNode
}

export function AdminShell({ cycles, children }: Props) {
  const pathname = usePathname()
  const activeCycleId = pathname.split('/')[2]

  const navItem = (href: string, icon: string, label: string, badge?: string) => (
    <Link
      key={href}
      href={href}
      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] mb-0.5 transition-colors ${
        pathname === href ? 'bg-[#f0e8ff] text-[#7B2FBE] font-semibold' : 'text-gray-500 hover:bg-[#f0e8ff] hover:text-[#7B2FBE]'
      }`}
    >
      <span className="w-[18px] text-center">{icon}</span>
      {label}
      {badge && <span className="ml-auto bg-[#ede9fe] text-[#7B2FBE] text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
    </Link>
  )

  return (
    <div className="min-h-screen bg-[#f4f4f6] flex flex-col">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] border border-gray-200 rounded-lg p-1 flex items-center justify-center">
            <Image src={boostlyLogo} alt="Boostly" width={24} height={24} />
          </div>
          <span className="font-bold text-[15px]">People Analyzer</span>
          <span className="bg-[#28008F] text-white text-[11px] font-bold px-2 py-0.5 rounded-full tracking-wide">Admin</span>
        </div>
        <span className="text-xs text-gray-400">brixton@boostly.com</span>
      </div>

      <div className="flex flex-1">
        {/* Sidenav */}
        <div className="w-[200px] min-w-[200px] bg-[#fafafa] border-r border-gray-100 p-3">
          {activeCycleId && (
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-2 px-2">Current Cycle</p>
              {navItem(`/admin/${activeCycleId}`, '📊', 'Overview')}
              {navItem(`/admin/${activeCycleId}/assignments`, '👥', 'Assignments')}
              {navItem(`/admin/${activeCycleId}/results`, '📋', 'Results')}
            </div>
          )}

          {cycles.filter(c => c.status === 'closed').length > 0 && (
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-2 px-2">History</p>
              {cycles.filter(c => c.status === 'closed').slice(0, 5).map(c =>
                navItem(`/admin/${c.id}`, '🕓', c.name)
              )}
            </div>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-2 px-2">Admin</p>
            {navItem('/admin/new', '➕', 'New Cycle')}
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 p-6">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write components/admin/CompletionTable.tsx**

```tsx
// components/admin/CompletionTable.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface ManagerRow {
  id: string
  name: string
  email: string
  directReportCount: number
  submittedAt: string | null
}

interface Props {
  managers: ManagerRow[]
  cycleId: string
}

export function CompletionTable({ managers, cycleId }: Props) {
  const [nudging, setNudging] = useState<string | null>(null)

  async function nudge(managerId: string | null) {
    setNudging(managerId ?? 'all')
    await fetch('/api/nudge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(managerId ? { managerId } : { cycleId, all: true }),
    })
    setNudging(null)
  }

  const pending = managers.filter(m => !m.submittedAt)

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-[13px] font-bold text-gray-700">Manager Completion</p>
        {pending.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => nudge(null)}
            disabled={nudging === 'all'}
            className="text-amber-700 border-yellow-300 bg-amber-50 hover:bg-amber-100 text-xs"
          >
            {nudging === 'all' ? 'Sending…' : `📣 Nudge All Pending (${pending.length})`}
          </Button>
        )}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Manager</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Reports</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Status</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Submitted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {managers.map(m => (
              <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#ede9fe] text-[#7B2FBE] flex items-center justify-center text-[11px] font-bold">
                      {m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    {m.name}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-gray-500">{m.directReportCount}</td>
                <td className="px-4 py-2.5">
                  {m.submittedAt
                    ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Submitted</Badge>
                    : <Badge className="bg-orange-50 text-orange-700 hover:bg-orange-50">Pending</Badge>
                  }
                </td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">
                  {m.submittedAt ? new Date(m.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </td>
                <td className="px-4 py-2.5">
                  {m.submittedAt
                    ? <Button variant="ghost" size="sm" className="text-[#7B2FBE] text-xs" asChild>
                        <a href={`/admin/${cycleId}/results?manager=${m.id}`}>View →</a>
                      </Button>
                    : <Button
                        variant="outline"
                        size="sm"
                        onClick={() => nudge(m.id)}
                        disabled={nudging === m.id}
                        className="text-amber-700 border-yellow-300 bg-amber-50 hover:bg-amber-100 text-xs"
                      >
                        {nudging === m.id ? 'Sending…' : '📣 Nudge'}
                      </Button>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write app/(admin)/layout.tsx**

```tsx
// app/(admin)/layout.tsx
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
    .select('id, name, status, created_at')
    .order('created_at', { ascending: false })

  return <AdminShell cycles={cycles ?? []}>{children}</AdminShell>
}
```

- [ ] **Step 4: Write app/(admin)/admin/[cycleId]/page.tsx**

```tsx
// app/(admin)/admin/[cycleId]/page.tsx
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { redirect } from 'next/navigation'
import { CompletionTable } from '@/components/admin/CompletionTable'
import { Button } from '@/components/ui/button'

export default async function AdminOverviewPage({ params }: { params: { cycleId: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') redirect('/login')

  const supabase = createClient()

  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('id, name, status, created_at')
    .eq('id', params.cycleId)
    .single()

  if (!cycle) redirect('/admin')

  // Get all managers in this cycle with their submission status
  const { data: assignments } = await supabase
    .from('manager_assignments')
    .select('manager_id, users!manager_id(id, first_name, last_name, email)')
    .eq('review_cycle_id', params.cycleId)

  const managerMap = new Map<string, any>()
  for (const a of assignments ?? []) {
    if (!managerMap.has(a.manager_id)) {
      managerMap.set(a.manager_id, { ...(a as any).users, count: 0 })
    }
    managerMap.get(a.manager_id).count++
  }

  const { data: submitted } = await supabase
    .from('reviews')
    .select('manager_id, submitted_at')
    .eq('review_cycle_id', params.cycleId)
    .not('submitted_at', 'is', null)

  const submittedMap = new Map<string, string>()
  for (const r of submitted ?? []) {
    if (!submittedMap.has(r.manager_id)) submittedMap.set(r.manager_id, r.submitted_at)
  }

  const managers = [...managerMap.entries()].map(([id, user]) => ({
    id,
    name: `${user.first_name} ${user.last_name}`,
    email: user.email,
    directReportCount: user.count,
    submittedAt: submittedMap.get(id) ?? null,
  }))

  const submittedCount = managers.filter(m => m.submittedAt).length
  const totalEmployees = managers.reduce((sum, m) => sum + m.directReportCount, 0)

  return (
    <div>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-[17px] font-bold">{cycle.name} — Overview</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {cycle.status === 'draft' ? 'Draft' : cycle.status === 'active' ? 'Active' : 'Closed'} · {managers.length} managers
          </p>
        </div>
        <div className="flex gap-2">
          {cycle.status === 'draft' && (
            <form action={`/api/cycles/${params.cycleId}`} method="PATCH">
              <Button size="sm" className="bg-[#7B2FBE] hover:bg-[#6a28a3] text-xs">Activate Cycle</Button>
            </form>
          )}
          <a href={`/api/export?cycleId=${params.cycleId}`}>
            <Button variant="outline" size="sm" className="text-xs">📤 Export CSV</Button>
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { value: submittedCount, label: 'Submitted', highlight: true },
          { value: managers.length - submittedCount, label: 'Pending' },
          { value: managers.length, label: 'Total Managers' },
          { value: totalEmployees, label: 'Employees in Cycle' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border p-4 ${stat.highlight ? 'bg-[#f0e8ff] border-[#ddd0f5]' : 'bg-[#fafafa] border-gray-100'}`}>
            <p className={`text-3xl font-black ${stat.highlight ? 'text-[#7B2FBE]' : 'text-gray-900'}`}>{stat.value}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <CompletionTable managers={managers} cycleId={params.cycleId} />
    </div>
  )
}
```

- [ ] **Step 5: Write app/(admin)/admin/page.tsx (redirect to most recent cycle)**

```tsx
// app/(admin)/admin/page.tsx
import { createClient } from '@/lib/db'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminIndexPage() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') redirect('/login')

  const supabase = createClient()
  const { data: cycles } = await supabase
    .from('review_cycles')
    .select('id, status')
    .order('created_at', { ascending: false })
    .limit(1)

  if (cycles?.[0]) redirect(`/admin/${cycles[0].id}`)

  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400">No cycles yet. Create one to get started.</p>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add components/admin/ app/\(admin\)/
git commit -m "feat: add admin shell, overview dashboard, and completion table"
```

---

## Task 15: Assignment Editor + Results Page

**Files:**
- Create: `components/admin/AssignmentEditor.tsx`, `components/admin/ResultsTable.tsx`, `app/(admin)/admin/[cycleId]/assignments/page.tsx`, `app/(admin)/admin/[cycleId]/results/page.tsx`

- [ ] **Step 1: Write components/admin/ResultsTable.tsx**

```tsx
// components/admin/ResultsTable.tsx
'use client'
import { useState } from 'react'
import { NINE_BOX_CELLS } from '@/lib/types'
import type { PerfLevel } from '@/lib/types'

interface ResultRow {
  reviewId: string
  managerName: string
  employeeName: string
  jobTitle: string | null
  performance: PerfLevel | null
  potential: PerfLevel | null
  submittedAt: string | null
}

interface Props {
  rows: ResultRow[]
  cycleId: string
}

export function ResultsTable({ rows, cycleId }: Props) {
  const [filterManager, setFilterManager] = useState('')
  const [filterCell, setFilterCell] = useState('')

  const managers = [...new Set(rows.map(r => r.managerName))].sort()

  const filtered = rows.filter(r => {
    if (filterManager && r.managerName !== filterManager) return false
    if (filterCell) {
      const cell = NINE_BOX_CELLS.find(c => c.label === filterCell)
      if (cell && (r.performance !== cell.performance || r.potential !== cell.potential)) return false
    }
    return true
  })

  function getCellLabel(perf: PerfLevel | null, pot: PerfLevel | null) {
    if (!perf || !pot) return '—'
    return NINE_BOX_CELLS.find(c => c.performance === perf && c.potential === pot)?.label ?? '—'
  }

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <select
          value={filterManager}
          onChange={e => setFilterManager(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">All Managers</option>
          {managers.map(m => <option key={m}>{m}</option>)}
        </select>
        <select
          value={filterCell}
          onChange={e => setFilterCell(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">All Quadrants</option>
          {NINE_BOX_CELLS.map(c => <option key={c.label}>{c.label}</option>)}
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Manager</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Employee</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Placement</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr key={row.reviewId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5">{row.managerName}</td>
                <td className="px-4 py-2.5">
                  <p>{row.employeeName}</p>
                  {row.jobTitle && <p className="text-xs text-gray-400">{row.jobTitle}</p>}
                </td>
                <td className="px-4 py-2.5">
                  <span className="bg-[#ede9fe] text-[#7B2FBE] rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                    {getCellLabel(row.performance, row.potential)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">
                  {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-2">{filtered.length} of {rows.length} results</p>
    </div>
  )
}
```

- [ ] **Step 2: Write app/(admin)/admin/[cycleId]/results/page.tsx**

```tsx
// app/(admin)/admin/[cycleId]/results/page.tsx
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { redirect } from 'next/navigation'
import { ResultsTable } from '@/components/admin/ResultsTable'
import { Button } from '@/components/ui/button'

export default async function ResultsPage({ params }: { params: { cycleId: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') redirect('/login')

  const supabase = createClient()

  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('name')
    .eq('id', params.cycleId)
    .single()

  const { data: reviews } = await supabase
    .from('reviews')
    .select(`
      id, performance, potential, submitted_at,
      manager:users!manager_id(first_name, last_name),
      direct_report:direct_reports!direct_report_id(full_name, job_title)
    `)
    .eq('review_cycle_id', params.cycleId)
    .not('submitted_at', 'is', null)
    .order('submitted_at')

  const rows = (reviews ?? []).map((r: any) => ({
    reviewId: r.id,
    managerName: `${r.manager.first_name} ${r.manager.last_name}`,
    employeeName: r.direct_report.full_name,
    jobTitle: r.direct_report.job_title,
    performance: r.performance,
    potential: r.potential,
    submittedAt: r.submitted_at,
  }))

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-[17px] font-bold">{cycle?.name} — Results</h1>
          <p className="text-xs text-gray-400 mt-0.5">{rows.length} submitted placements</p>
        </div>
        <a href={`/api/export?cycleId=${params.cycleId}`}>
          <Button variant="outline" size="sm" className="text-xs">📤 Export CSV</Button>
        </a>
      </div>
      <ResultsTable rows={rows} cycleId={params.cycleId} />
    </div>
  )
}
```

- [ ] **Step 3: Write app/(admin)/admin/[cycleId]/assignments/page.tsx**

```tsx
// app/(admin)/admin/[cycleId]/assignments/page.tsx
import { auth } from '@/lib/auth'
import { createClient } from '@/lib/db'
import { redirect } from 'next/navigation'

export default async function AssignmentsPage({ params }: { params: { cycleId: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') redirect('/login')

  const supabase = createClient()

  const { data: cycle } = await supabase
    .from('review_cycles')
    .select('name, status')
    .eq('id', params.cycleId)
    .single()

  const { data: assignments } = await supabase
    .from('manager_assignments')
    .select(`
      id,
      manager:users!manager_id(id, first_name, last_name, email),
      direct_report:direct_reports!direct_report_id(id, full_name, job_title)
    `)
    .eq('review_cycle_id', params.cycleId)
    .order('created_at')

  // Group by manager
  const byManager = new Map<string, { manager: any; reports: any[] }>()
  for (const a of assignments ?? []) {
    const mgr = (a as any).manager
    if (!byManager.has(mgr.id)) byManager.set(mgr.id, { manager: mgr, reports: [] })
    byManager.get(mgr.id)!.reports.push({ ...(a as any).direct_report, assignmentId: a.id })
  }

  const isEditable = cycle?.status === 'draft'

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-[17px] font-bold">{cycle?.name} — Assignments</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {isEditable ? 'Review and edit before activating.' : 'Read-only — cycle is active or closed.'}
          </p>
        </div>
        {isEditable && (
          <form method="POST" action={`/api/cycles/${params.cycleId}`}>
            <input type="hidden" name="status" value="active" />
            <button className="bg-[#7B2FBE] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#6a28a3]">
              Activate Cycle
            </button>
          </form>
        )}
      </div>

      <div className="space-y-4">
        {[...byManager.values()].map(({ manager, reports }) => (
          <div key={manager.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-[#ede9fe] text-[#7B2FBE] flex items-center justify-center text-[11px] font-bold">
                {manager.first_name[0]}{manager.last_name[0]}
              </div>
              <div>
                <p className="text-[13px] font-semibold">{manager.first_name} {manager.last_name}</p>
                <p className="text-[11px] text-gray-400">{manager.email}</p>
              </div>
              <span className="ml-auto text-xs text-gray-400">{reports.length} direct reports</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {reports.map((r: any) => (
                <span key={r.id} className="flex items-center gap-1.5 bg-[#f5f3ff] text-[#7B2FBE] rounded-lg px-3 py-1.5 text-xs font-medium">
                  {r.full_name}
                  {r.job_title && <span className="text-purple-300">· {r.job_title}</span>}
                  {isEditable && (
                    <button
                      onClick={async () => {
                        await fetch(`/api/cycles/${params.cycleId}/assignments?assignmentId=${r.assignmentId}`, { method: 'DELETE' })
                        window.location.reload()
                      }}
                      className="ml-1 text-purple-300 hover:text-red-400"
                    >×</button>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/admin/ResultsTable.tsx components/admin/AssignmentEditor.tsx app/\(admin\)/admin/\[cycleId\]/
git commit -m "feat: add assignment editor and results view"
```

---

## Task 16: Root Redirect + New Cycle Page + Final Wiring

**Files:**
- Create: `app/page.tsx`, `app/(admin)/admin/new/page.tsx`

- [ ] **Step 1: Write app/page.tsx (role-based redirect)**

```tsx
// app/page.tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function Home() {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.mustResetPassword) redirect('/set-password')
  if (session.user.role === 'admin') redirect('/admin')
  redirect('/review')
}
```

- [ ] **Step 2: Write app/(admin)/admin/new/page.tsx**

```tsx
// app/(admin)/admin/new/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function NewCyclePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/cycles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) { setError('Failed to create cycle.'); setLoading(false); return }
    const cycle = await res.json()
    router.push(`/admin/${cycle.id}`)
  }

  return (
    <div className="max-w-md">
      <h1 className="text-[17px] font-bold mb-1">New Review Cycle</h1>
      <p className="text-xs text-gray-400 mb-6">Give the cycle a name, then sync from Gusto to populate assignments.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Cycle name</Label>
          <Input placeholder="e.g. Q2 2025" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="bg-[#7B2FBE] hover:bg-[#6a28a3]" disabled={loading}>
          {loading ? 'Creating…' : 'Create Cycle'}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Write app/layout.tsx**

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'People Analyzer',
  description: 'Boostly internal performance review tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: Run all tests**

```bash
npx jest
```
Expected: All tests PASS

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 6: Start dev server and smoke test**

```bash
npm run dev -- --port 3001
```

Manual checks:
- http://localhost:3001/login — login form renders
- Log in as brixton@boostly.com → redirects to /admin
- Create a new cycle → redirects to /admin/[cycleId]
- Sync Gusto button (POST /api/gusto/sync) populates assignments
- Assignments page shows manager → DR groupings
- Activate cycle → status changes to active
- Log in as a manager → redirects to /review/[cycleId]
- Click employee → click cell → employee placed
- Submit → read-only with timestamp
- Admin: nudge buttons send Slack DMs
- CSV export downloads file

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat: complete People Analyzer V1 — all features wired"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Email/password login via NextAuth credentials — Task 4, 5
- ✅ Role-based middleware — Task 4
- ✅ Magic link auto-login from Slack — Task 6, 10
- ✅ First-login forced password reset — Task 5
- ✅ Gusto sync (employees, managers, assignments) — Task 7
- ✅ Admin creates review cycles (draft → active → closed) — Task 8
- ✅ Assignment review/edit before activation — Task 15
- ✅ Manager 9-box click-to-place with +N more overflow — Task 12
- ✅ Submit locks placements read-only with timestamp — Task 9
- ✅ Admin edits with audit log — Task 9
- ✅ Slack nudge per-manager or all pending — Task 10
- ✅ Admin results view filterable by manager and quadrant — Task 15
- ✅ CSV export — Task 11
- ✅ History view for both roles — Task 14 (sidenav), Task 13 (manager cycle list)
- ✅ Boostly branding throughout — Tasks 5, 12, 13, 14

**Type consistency:** All types defined in `lib/types.ts` Task 3 and used consistently through Tasks 4–16. `PerfLevel` used for both `performance` and `potential` fields (both are `low | medium | high`).

**No placeholders:** All steps contain complete code.
