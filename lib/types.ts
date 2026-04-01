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
  retro_participant_ids?: string[] | null
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
