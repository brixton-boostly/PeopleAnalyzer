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
