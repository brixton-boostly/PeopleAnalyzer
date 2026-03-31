-- supabase/migrations/003_add_retro.sql

-- Allow retro magic links (no user account needed)
ALTER TABLE magic_links ALTER COLUMN user_id DROP NOT NULL;

-- Retro status enum (following project convention from 001_initial_schema.sql)
CREATE TYPE retro_status AS ENUM ('draft', 'active', 'closed');

-- Retro link metadata
ALTER TABLE magic_links
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'review'
    CHECK (type IN ('review', 'retro')),
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES direct_reports(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES review_cycles(id) ON DELETE CASCADE;

-- Employee Slack IDs for Retro DMs
ALTER TABLE direct_reports
  ADD COLUMN IF NOT EXISTS slack_user_id TEXT;

-- Retro questions + status on the cycle
ALTER TABLE review_cycles
  ADD COLUMN IF NOT EXISTS retro_questions JSONB NOT NULL DEFAULT '["What accomplishments am I most proud of this quarter, and what made them possible?","Where did I fall short of my goals, and what would I do differently?","What do I need — from my manager, team, or company — to be more effective next quarter?"]'::jsonb,
  ADD COLUMN IF NOT EXISTS retro_status retro_status NOT NULL DEFAULT 'draft';

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
