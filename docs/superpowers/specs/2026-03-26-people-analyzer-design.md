# Boostly People Analyzer — Design Spec
**Date:** 2026-03-26 | **Author:** Brixton Gardner | **Status:** Approved

---

## What We're Building

An internal web app where managers place their direct reports on a 9-box performance/potential grid. Brixton (admin) sees all results across the org, manages review cycles, edits placements with a full audit trail, and sends individual Slack nudges with magic-link auto-login. Managers complete their own 9-box and can view historical submissions.

---

## Users & Roles

**Admin (Brixton only)**
- Email: brixton@boostly.com
- Creates and manages review cycles
- Syncs employee/manager data from Gusto API
- Reviews and edits manager-to-direct-report assignments before activating a cycle
- Monitors completion status across all managers
- Sends Slack DM nudges to specific managers or all pending at once
- Views all submitted results, filterable and exportable to CSV
- Can edit any placement after submission — every edit is captured in the audit log

**Manager**
- Any Boostly employee with direct reports
- Account pre-seeded from Gusto sync (no self-signup)
- Default password: `[FIRSTNAME]123!` — forced to reset on first login
- Completes their own 9-box only; cannot see other managers' results
- After submission: view is read-only
- Can view all their historical submissions across past cycles

---

## Core Features

### 1. Auth
- Email + password login via NextAuth credentials provider
- Role assigned based on email match (admin vs. manager)
- **Magic link auto-login:** Slack nudge includes a signed, single-use token URL. Clicking it creates a session automatically. Token expires in 24h.
- After first magic-link login: manager is prompted to set a permanent password before accessing anything
- Subsequent visits: email + password login (or another magic link from a future nudge)

### 2. Review Cycles
- Admin creates a named cycle (e.g. "Q2 2025") — status starts as `draft`
- Admin syncs from Gusto, reviews/edits assignments, then activates the cycle (`active`)
- Managers can only submit while a cycle is `active`
- Admin can close a cycle (`closed`) when done
- Both admin and managers can view all historical cycles (read-only)

### 3. Gusto Sync
- Admin triggers a sync manually from the sidebar ("Sync Gusto")
- Pulls all employees and their manager relationships via Gusto API
- Creates/updates `users` (managers) and `direct_reports` records
- Populates `manager_assignments` for the current draft cycle
- Admin reviews the resulting assignments table and can edit before activating

### 4. Assignment Review (Admin)
- Table view: each row is a manager with their assigned direct reports
- Admin can add/remove direct reports per manager
- Edits are scoped to the current cycle — does not affect past cycles
- Once satisfied, admin activates the cycle

### 5. Manager 9-Box
- Left sidebar: list of direct reports for the active cycle
- Center: 9-box grid with labeled cells (Performance × Potential)
- **Interaction:** Click an employee to select them (highlighted in sidebar), then click a cell to place them
- Placed employees show a checkmark in the sidebar; their name appears as a purple pill tag in the cell
- Cells with many names show first 4 + a "+N more" chip (expands on click)
- Submit button activates only when all direct reports are placed
- After submission: view becomes read-only with timestamp

**9-box cell labels (Performance low→high, Potential high→low):**
| | Low Perf | Med Perf | High Perf |
|---|---|---|---|
| **High Potential** | Rough Diamond | Rising Star | Superstar |
| **Med Potential** | Inconsistent | Core Player | Key Player |
| **Low Potential** | Question Mark | Workhorse | Trusted Pro |

Each cell has a distinct pastel background color for visual differentiation.

### 6. Admin Results View
- Filterable table: Manager, Employee, 9-box placement, Submission date
- Filter by manager or by 9-box quadrant
- Admin can edit any placement — each edit writes to the audit log (field, old value, new value, timestamp, changed_by)
- Export to CSV

### 7. Slack Nudge
- Admin sends nudges from the Overview tab
- Per-row "Nudge" button for individual managers
- "Nudge All Pending" button at the top targets only managers who haven't submitted
- Each nudge sends a Slack DM via bot token: _"Hey [First Name] — it's time to complete your People Review. Click here to get started: [magic link]"_
- Magic link is generated fresh per nudge (single-use, 24h expiry)

---

## Data Model

### `users`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| email | text | unique |
| first_name | text | |
| last_name | text | |
| role | enum | `admin` \| `manager` |
| slack_user_id | text | for DMs |
| password_hash | text | |
| must_reset_password | boolean | true on first login |
| gusto_employee_id | text | from Gusto sync |
| created_at | timestamp | |

### `direct_reports`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| gusto_employee_id | text | |
| full_name | text | |
| job_title | text | |
| created_at | timestamp | |

### `review_cycles`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | e.g. "Q2 2025" |
| status | enum | `draft` \| `active` \| `closed` |
| created_by | uuid FK → users | |
| created_at | timestamp | |

### `manager_assignments`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| manager_id | uuid FK → users | |
| direct_report_id | uuid FK → direct_reports | |
| review_cycle_id | uuid FK → review_cycles | |
| created_at | timestamp | |

### `reviews`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| manager_id | uuid FK → users | |
| direct_report_id | uuid FK → direct_reports | |
| review_cycle_id | uuid FK → review_cycles | |
| performance | enum | `low` \| `medium` \| `high` |
| potential | enum | `low` \| `medium` \| `high` |
| submitted_at | timestamp | null until submitted |

### `audit_log`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| review_id | uuid FK → reviews | |
| changed_by | uuid FK → users | |
| field_changed | text | e.g. "performance" |
| old_value | text | |
| new_value | text | |
| changed_at | timestamp | |

### `magic_links`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | |
| token | text | signed, unique |
| expires_at | timestamp | 24h from creation |
| used_at | timestamp | null until redeemed |

---

## Architecture

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Postgres) · Vercel

**Auth:** NextAuth credentials provider for email/password sessions. Custom magic link tokens stored in `magic_links` table — generated per nudge, validated in a dedicated API route, single-use.

**Gusto sync:** Server-side API route calls Gusto MCP/API. Pulls employees and manager relationships. Upserts `users`, `direct_reports`, and `manager_assignments` for the current draft cycle.

**Slack nudge:** Server-side API route calls Slack API via bot token. Generates a fresh magic link token, constructs the DM, sends to `slack_user_id`. Triggered by admin button — never scheduled.

**Authorization:** Middleware checks NextAuth session on every request. Admin routes (anything under `/admin`) are blocked for manager-role sessions. Managers only see data scoped to their own `user_id`.

---

## UI Design

**Branding:** Boostly purple `#7B2FBE` / `#28008F`, light backgrounds (`#fff`, `#fafafa`, `#f4f4f6`), white cards with subtle borders, Boostly SVG icon in the top-left nav.

**Manager view:** Sidebar (team list) + 9-box grid center. Click-to-select → click-to-place interaction. "+N more" overflow on busy cells. Submit button activates when all placed.

**Admin dashboard:** Left sidenav (Overview / Assignments / Results / History / Admin actions) + main content. Stats row at top of overview. Completion table with per-row nudge and "Nudge All Pending". Export CSV in top right.

---

## Out of Scope (V1)

- Self-serve account creation
- Employee access (employees never log in)
- Automated/scheduled nudges
- Email-based magic links (Slack only)
- Mobile-optimized layout (desktop-first)

---

## Success Criteria

A manager receives a Slack nudge, clicks the link, is auto-logged in, sets their password (first time only), places their team on the 9-box, and submits — in under 5 minutes. Brixton can see every manager's results across all cycles in one view, nudge stragglers individually, and export the full dataset.
