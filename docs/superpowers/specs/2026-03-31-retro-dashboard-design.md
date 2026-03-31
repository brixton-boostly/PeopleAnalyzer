# Retro + Dashboard Design Spec
**Date:** 2026-03-31
**Author:** Brixton (Head of People, Boostly)

---

## Overview

Two features are being added to the People Analyzer:

1. **Retro** — a quarterly employee self-reflection form, delivered via Slack magic link, visible to the employee, their manager, and admin
2. **Dashboard improvements** — a richer Results view with KPI cards and color-coded placement tags, plus a redesigned Assignments tab that tracks both People Analyzer and Retro completion

---

## 1. Retro

### Concept

Every quarter, alongside the People Analyzer (manager 9-box reviews), every employee completes a short self-reflection ("Retro"). The Retro is tied to the same review cycle but launched separately by admin — giving control over timing (e.g., send Retro first so employees reflect before managers assess, or simultaneously).

### Default Questions (admin-editable before launch)

1. What accomplishments am I most proud of this quarter, and what made them possible?
2. Where did I fall short of my goals, and what would I do differently?
3. What do I need — from my manager, team, or company — to be more effective next quarter?

### Access & Visibility

- Employees access via **Slack magic link** (no account required)
- Completed Retros are visible to: **employee**, **their manager**, and **admin**
- Manager leaves one **overall comment** per employee's Retro (not per-question)
- Employee can return to the same magic link to view their submission and any manager feedback

### Lifecycle

`draft` → `active` → `closed` (mirrors People Analyzer cycle status, but controlled independently via a `retro_status` field)

---

## 2. Data Model

### Changes to `review_cycles`

```sql
ALTER TABLE review_cycles
  ADD COLUMN retro_questions JSONB DEFAULT '[
    "What accomplishments am I most proud of this quarter, and what made them possible?",
    "Where did I fall short of my goals, and what would I do differently?",
    "What do I need — from my manager, team, or company — to be more effective next quarter?"
  ]'::jsonb,
  ADD COLUMN retro_status TEXT DEFAULT 'draft' CHECK (retro_status IN ('draft', 'active', 'closed'));
```

### New `retros` table

```sql
CREATE TABLE retros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES review_cycles(id),
  employee_id UUID NOT NULL REFERENCES direct_reports(id),
  responses JSONB, -- array of { question: string, answer: string }
  submitted_at TIMESTAMPTZ,
  manager_comment TEXT,
  manager_commented_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cycle_id, employee_id)
);
```

### Changes to `magic_links`

```sql
ALTER TABLE magic_links
  ADD COLUMN type TEXT DEFAULT 'review' CHECK (type IN ('review', 'retro')),
  ADD COLUMN employee_id UUID REFERENCES direct_reports(id);
```

---

## 3. New Routes

| Route | Method | Description |
|---|---|---|
| `/retro/[token]` | GET | Employee-facing Retro form (no auth required) |
| `/api/retro/submit` | POST | Save employee responses |
| `/api/retro/comment` | PATCH | Manager saves overall comment |
| `/api/retro/send` | POST | Admin sends magic link DMs to all employees in a cycle |

---

## 4. Employee Experience (`/retro/[token]`)

- Simple single-page form, no login required
- Header: cycle name, employee first name greeting, note that manager and leadership will see responses
- Three question cards, each labeled (01 — Wins / 02 — Growth / 03 — Needs) with a textarea
- "Submit Retro" button
- After submission: shows their responses read-only, plus manager comment once written
- Footer note: "You can return to this link to view your submission and any manager feedback"

---

## 5. Manager Experience

New **"Team Retros"** tab added to the manager review flow (alongside the existing 9-box tab):

- Lists all direct reports
- Green dot = submitted, grey dot = not yet submitted
- Submitted employees are expandable: shows each question + answer, plus a comment box
- Manager types an overall comment and saves (auto-saves on blur or explicit Save button)
- Pending employees shown collapsed and greyed out

---

## 6. Admin Experience

### Assignments Tab (redesigned)

**Two stat cards** at the top:
- People Analyzer card: submission count, progress bar, "Send All Pending" button
- Retro card: submission count (0/41 before launch), progress bar, "Edit Questions · Launch Retro" button

"Edit Questions · Launch Retro" opens a modal where admin can edit the 3 question strings, then clicks Launch to set `retro_status = 'active'` and trigger Slack DMs to all employees.

**Employee table** now has two status columns:
- 9-Box: ✓ Done / Pending
- Retro: ✓ Done / — (dash if Retro not yet launched)

Per-row actions: Copy Link (always), Nudge (when 9-box pending).

### Results Tab (redesigned)

**KPI cards row** (4 cards):
1. 9-Box Complete (X of Y managers, %)
2. Retro Complete (X of Y employees, %)
3. Top Placement (label of most-populated 9-box cell, count)
4. Needs Attention (count of employees in low perf or low potential cells)

**List/9-Box toggle** remains. In list view:
- Columns: Employee, Manager, Placement, 9-Box Note, Retro
- Placement tags use the **exact background and text color of the corresponding 9-box cell** (no generic purple)
- Retro column shows a "View" button that opens a **slide-over panel** with the employee's full Retro responses + manager comment

**9-Box view** unchanged (existing grid).

---

## 7. Placement Tag Colors

| Label | Background | Text |
|---|---|---|
| Superstar | `#d1fae5` | `#065f46` |
| Rising Star | `#fef9c3` | `#854d0e` |
| Rough Diamond | `#fce7f3` | `#9d174d` |
| Key Player | `#dcfce7` | `#166534` |
| Core Player | `#eff6ff` | `#1e40af` |
| Trusted Pro | `#e0f2fe` | `#075985` |
| Inconsistent | `#fff1f2` | `#9f1239` |
| Workhorse | `#f0fdf4` | `#14532d` |
| Question Mark | `#fef2f2` | `#991b1b` |

---

## 8. Out of Scope

- Cross-cycle trending (employee movement between quarters) — deferred to a future spec
- Employee accounts / login — Retro is magic-link only
- Per-question manager feedback — single overall comment only
- Retro analytics / aggregation across employees — deferred
