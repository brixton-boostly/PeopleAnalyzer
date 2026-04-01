# Retro Admin Page Design

## Overview

Add a dedicated **Retro** page within each review cycle in the admin sidebar. Currently, retro launch lives inside the Assignments page, making it hard to find. The new page gives Retros a first-class home with a Setup tab (pre-launch) and Responses tab (post-launch).

---

## Architecture

### New route
`/admin/[cycleId]/retro` — server page that fetches cycle + employee + retro data, renders `RetroAdminView` client component.

### New component
`components/admin/RetroAdminView.tsx` — two tabs:
- **Setup** (shown when `retro_status === 'draft'`): editable questions list (add/edit/remove), employee selection checkboxes, Launch button
- **Responses** (shown when `retro_status === 'active' | 'closed'`): 3 stat cards (Sent / Submitted / Pending), employee table with status, View slide-over, Copy Link

### Nav change
`components/admin/AdminShell.tsx` — add `🔁 Retro` as the 4th nav item under each cycle, after Results.

### DB change
Add `retro_participant_ids JSONB` column to `review_cycles` (stores `string[]` of employee IDs included in the launch). Run this migration in Supabase SQL editor before implementing:
```sql
ALTER TABLE review_cycles ADD COLUMN IF NOT EXISTS retro_participant_ids JSONB;
```

### API changes

**`PATCH /api/cycles/[cycleId]/retro`** (new file: `app/api/cycles/[cycleId]/retro/route.ts`)
- Saves `retro_questions` draft without launching (used on question edits — optional autosave, or just on Launch)
- Body: `{ questions: string[] }`
- Updates `review_cycles.retro_questions` only; does NOT change `retro_status`

**`POST /api/retro/send`** (existing — extend)
- Accept optional `participantIds: string[]` in body
- If provided: filter employees to only those IDs; also save `retro_participant_ids` to the cycle
- If not provided: fall back to all employees (backward-compat)

---

## Components

### `RetroAdminView.tsx`

Props:
```ts
interface Props {
  cycleId: string
  cycleName: string
  retroStatus: RetroStatus          // 'draft' | 'active' | 'closed'
  initialQuestions: string[]        // from cycle.retro_questions
  initialParticipantIds: string[]   // from cycle.retro_participant_ids (empty = all selected)
  allEmployees: { id: string; full_name: string; job_title: string | null; manager_name: string }[]
  retros: {
    employee_id: string
    submitted_at: string | null
    responses: { question: string; answer: string }[]
    manager_comment: string | null
  }[]
}
```

**Setup tab** (locked read-only if `retroStatus !== 'draft'`):

Questions section:
- `questions` local state, initialized from `initialQuestions`
- Each question: `<textarea>` for editing + `×` remove button
- "+ Add question" button appends a blank question
- Min 1 question enforced (× disabled when only 1 remains)

Employee section:
- `selectedIds` local state: `Set<string>`, initialized from `initialParticipantIds` (if empty → all IDs)
- Select All / Clear All buttons
- Table: Employee, Manager, checkbox
- Contractors (no `slack_user_id`) shown grayed, unchecked by default, can still be included but will fail gracefully

Launch button: `Launch Retro → Send to {selectedIds.size} employees`
- Calls `POST /api/retro/send` with `{ cycleId, questions, participantIds: [...selectedIds] }`
- On success: page refreshes (router.refresh()) so retro_status flips to 'active'
- Disabled if 0 employees selected or launching in progress

**Responses tab**:
- Stat cards: Sent (= `retro_participant_ids.length`), Submitted, Pending
- Table: Employee, Manager, Status (✓ Submitted / Pending), Action (View or Copy Link)
- "View" opens a slide-over (same pattern as ResultsTable) with full responses + manager comment
- "Copy Link" calls `POST /api/retro/magic-link` with `{ employeeId, cycleId }` body and copies the returned `url` to clipboard

---

## Data Flow

```
page.tsx (server)
  → fetches: cycle (name, retro_status, retro_questions, retro_participant_ids)
  → fetches: allEmployees via manager_assignments JOIN direct_reports
  → fetches: retros for this cycle
  → renders RetroAdminView (client)
      → Setup tab: local state for questions + selectedIds
          → Launch → POST /api/retro/send → router.refresh()
      → Responses tab: read-only from retros prop
          → View → local slide-over state
          → Copy Link → POST /api/retro/magic-link
```

---

## Retro Send API Update

Current behavior: sends to all employees in cycle.

New behavior:
```ts
// In POST /api/retro/send body:
const { cycleId, questions, participantIds } = await req.json()

// Save participant IDs + questions + flip status
const updatePayload: Record<string, unknown> = { retro_status: 'active' }
if (Array.isArray(questions) && questions.length > 0) {
  updatePayload.retro_questions = questions
}
if (Array.isArray(participantIds) && participantIds.length > 0) {
  updatePayload.retro_participant_ids = participantIds
}
await supabase.from('review_cycles').update(updatePayload).eq('id', cycleId)

// Filter employees to participantIds if provided
const employeesToSend = participantIds?.length
  ? employees.filter(e => participantIds.includes(e.id))
  : employees
```

---

## Responses Tab — Participant List

After launch, the Responses tab should show exactly the employees who were sent the retro (i.e., `retro_participant_ids`). The page fetches these IDs and filters `allEmployees` accordingly so the table reflects who was included, not the full cycle roster.

---

## Error Handling

- Launch with 0 selected: button disabled, no API call
- Slack DM fails for individual employee: already handled per-employee in `/api/retro/send`, shown in result log (no UI change needed)
- Copy Link failure: show inline "Failed" text for 2s (same pattern as existing AssignmentsView)
- Questions: min 1 required before launch; disable Launch button if any question is blank

---

## What NOT to change

- `AssignmentsView.tsx` — keep the existing retro launch block as-is for now; it won't conflict since the new `/retro` page is additive. A future cleanup can remove the duplicate from Assignments.
- `RetroForm.tsx` / `TeamRetros.tsx` / manager-facing views — untouched
- Auth / magic link logic — untouched
