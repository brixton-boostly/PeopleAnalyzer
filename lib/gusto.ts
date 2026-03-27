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

  const employees: any[] = await gustoGet(
    `/companies/${companyId}/employees?terminated=false&per=100`
  )

  // Identify which UUIDs are referenced as manager_uuid by someone else
  const managerUuids = new Set(
    employees
      .map((e: any) => e.manager_uuid)
      .filter(Boolean)
  )

  // Map gusto UUID → internal user ID (for managers)
  const userIdByGustoUuid = new Map<string, string>()
  let managersUpserted = 0

  for (const emp of employees) {
    if (!managerUuids.has(emp.uuid)) continue

    const email = emp.work_email || emp.email
    const defaultHash = await bcrypt.hash(`${emp.first_name}123!`, 10)

    const { data: user } = await supabase
      .from('users')
      .upsert(
        {
          email,
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
    // Only process employees whose manager is a known manager
    const managerGustoUuid = emp.manager_uuid
    if (!managerGustoUuid || !userIdByGustoUuid.has(managerGustoUuid)) continue

    const title = emp.jobs?.[0]?.title ?? null

    const { data: dr } = await supabase
      .from('direct_reports')
      .upsert(
        {
          gusto_employee_id: emp.uuid,
          full_name: `${emp.first_name} ${emp.last_name}`,
          job_title: title,
        },
        { onConflict: 'gusto_employee_id' }
      )
      .select('id')
      .single()

    if (!dr) continue
    directReportsUpserted++

    const { error } = await supabase.from('manager_assignments').upsert(
      {
        manager_id: userIdByGustoUuid.get(managerGustoUuid)!,
        direct_report_id: dr.id,
        review_cycle_id: cycleId,
      },
      { onConflict: 'manager_id,direct_report_id,review_cycle_id', ignoreDuplicates: true }
    )
    if (!error) assignmentsCreated++
  }

  return { managersUpserted, directReportsUpserted, assignmentsCreated }
}
