# Boostly People Analyzer — PRD
**Version:** 1.0 | **Author:** Brixton Gardner | **Status:** Ready for Build

---

## What It Is

A simple internal web app where managers place their direct reports on a 9-box performance grid. Brixton sees everyone's results. Managers see only their own team.

---

## Users & Access

**Two roles: Admin and Manager.**

**Admin (Brixton only)**
- Login: brixton@boostly.com
- Can see all managers' completed 9-box results across the org
- Can push a Slack nudge to all managers prompting them to complete a review
- Sees completion status (who has and hasn't submitted, with timestamp)

**Manager**
- Any Boostly employee with direct reports
- Login: work email (pulled from Gusto employee list)
- Default password: [FIRSTNAME]123! (e.g., jamie@boostly.com → Jamie123!)
- On first login, user is forced to set a new password before accessing anything
- Can see and complete their own 9-box only
- Cannot see other managers' results

---

## Core Features

### 1. Login
- Email + password authentication
- Role assigned on login (admin vs. manager) based on email match
- No self-serve signup — accounts are pre-seeded from Gusto data

---

### 2. Admin: Slack Nudge
- Single button in admin dashboard: "Send Review Reminder"
- Sends a Slack DM to all managers with direct reports
- Message: "Hey [First Name] — it's time to complete your People Review. Click here to get started: [link]"
- Link takes manager directly to their 9-box in the app (authenticated via the link or prompts login)

---

### 3. Manager: 9-Box View
- Left sidebar: list of the manager's direct reports (name + role)
- Center: 9-box grid
  - X-axis: Performance (Low / Medium / High)
  - Y-axis: Potential (Low / Medium / High)
- Drag or click to place each direct report into one of the 9 cells
- Each employee can only occupy one cell
- "Submit Review" button locks the placement and records a timestamp
- After submission: view is read-only with timestamp shown ("Submitted March 26, 2025")

---

### 4. Admin: Results View
- Table or grid view of all submitted reviews
- Shows: Manager name, Employee name, 9-box placement, Submission date
- Filter by manager or by 9-box quadrant
- Export to CSV

---

## Data Model

**Users**
- id, email, first_name, last_name, role (admin / manager), slack_user_id, first_login (boolean)

**Direct Reports**
- id, name, role, manager_id

**Reviews**
- id, manager_id, employee_id, performance (low/medium/high), potential (low/medium/high), submitted_at

---

## Tech Notes

- Frontend: single-page HTML/JS app or lightweight React
- Auth: simple session-based login (no OAuth needed for V1)
- DB: Supabase (Postgres)
- Slack: Slack API (send DM via bot token) — triggered by admin button, not scheduled
- Hosting: Vercel

---

## Out of Scope (V1)

- Self-serve account creation
- Employee access (employees never log in)
- Historical trend view across multiple review cycles
- Automated scheduling of nudges
- Integration with Gusto API (seed accounts manually from Gusto export for V1)

---

## Success

A manager receives the Slack nudge, logs in, places their team on the 9-box, and submits — in under 5 minutes. Brixton can see every manager's completed results in one view.
