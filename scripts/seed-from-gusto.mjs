// One-time seed script — run with: node scripts/seed-from-gusto.mjs
import bcrypt from 'bcryptjs'

const SUPABASE_URL = 'https://dingknoibgywhzvbbiml.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpbmdrbm9pYmd5d2h6dmJiaW1sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI4Njk4NSwiZXhwIjoyMDg5ODYyOTg1fQ.AmkcFWIoeWusWJaZAA6geQokXdD5rA1rUimbVk1lLOk'
const ADMIN_ID = 'e7504aca-6d35-4350-843d-85b873ca37ca' // Brixton

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

async function sb(method, table, body, query = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${table}: ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

// ── Data from Gusto + Slack lookup ───────────────────────────────────────────

const MANAGERS = [
  { email: 'shane@boostly.com',         first_name: 'Shane',    last_name: 'Murphy',   gusto_uuid: '5c252105-d8d9-4ebe-9101-c194e0d6918a', slack_user_id: 'U73F9153P',   title: 'CEO' },
  { email: 'travisse@boostly.com',       first_name: 'Travisse', last_name: 'Hansen',   gusto_uuid: 'd73b3402-4899-4d7e-be35-04b0a6396471', slack_user_id: 'U04QQAQT6E4', title: 'Head of Product' },
  { email: 'jim@boostly.com',            first_name: 'James',    last_name: 'Mayes',    gusto_uuid: 'f5e6f952-fe71-49e2-b8f6-9808976295a9', slack_user_id: 'U07TXCY7MRA', title: 'CTO' },
  { email: 'jamie@boostly.com',          first_name: 'Jamie',    last_name: 'Thayne',   gusto_uuid: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f', slack_user_id: 'U087DEYJ4SK', title: 'Manager, Sales Development' },
  { email: 'nick@boostly.com',           first_name: 'Nicholas', last_name: 'Powell',   gusto_uuid: '60d787c9-67e6-47f0-8cac-3706f5ef5229', slack_user_id: 'U08P06V9SUR', title: 'SVP, Revenue' },
  { email: 'brandon.heath@boostly.com',  first_name: 'Brandon',  last_name: 'Heath',    gusto_uuid: '93d8cfd2-ad5a-4223-87eb-e4b53cb6b570', slack_user_id: 'U0ACX86LNL9', title: 'Sales Manager' },
]

const DIRECT_REPORTS = [
  { gusto_uuid: 'b98b9b42-f5fd-4659-b623-3d041fd5b7d6', full_name: 'Michael Murphy',      title: 'Chief Innovation Officer',           manager_gusto: '5c252105-d8d9-4ebe-9101-c194e0d6918a' },
  { gusto_uuid: '42627bfa-422d-4502-8179-5bebc7745178', full_name: 'Brianna Davis',        title: 'Customer Support Specialist',        manager_gusto: '60d787c9-67e6-47f0-8cac-3706f5ef5229' },
  { gusto_uuid: 'afea0c2e-8f18-4fbe-96a6-68be4cfb65ce', full_name: 'Tyler Beagley',        title: 'Enablement Operations Specialist',   manager_gusto: 'd73b3402-4899-4d7e-be35-04b0a6396471' },
  { gusto_uuid: '7631b801-7f5f-4de7-b520-5603a10fea27', full_name: 'Dallas Williams',      title: 'CSM 2',                              manager_gusto: '60d787c9-67e6-47f0-8cac-3706f5ef5229' },
  { gusto_uuid: '52c0eead-92b3-4e92-b7f0-46b2c4080bb5', full_name: 'Kyle Baker',           title: 'AE',                                 manager_gusto: '93d8cfd2-ad5a-4223-87eb-e4b53cb6b570' },
  { gusto_uuid: 'd73b3402-4899-4d7e-be35-04b0a6396471', full_name: 'Travisse Hansen',      title: 'Head of Product',                    manager_gusto: '5c252105-d8d9-4ebe-9101-c194e0d6918a' },
  { gusto_uuid: 'a8d9d1bc-d2d3-44db-861b-b3db00de8f9a', full_name: 'Christian Carmicheal', title: 'Marketing Specialist',               manager_gusto: '60d787c9-67e6-47f0-8cac-3706f5ef5229' },
  { gusto_uuid: 'd2d1d92e-25f5-439e-8170-5195e4bf5f7c', full_name: 'Chris Hubbard',        title: 'CSM 2',                              manager_gusto: '60d787c9-67e6-47f0-8cac-3706f5ef5229' },
  { gusto_uuid: 'f5e6f952-fe71-49e2-b8f6-9808976295a9', full_name: 'James Mayes',          title: 'CTO',                                manager_gusto: '5c252105-d8d9-4ebe-9101-c194e0d6918a' },
  { gusto_uuid: '52d60bc3-4845-473c-9807-8ce102c11409', full_name: 'Ella Van Horn',         title: 'SDR 3',                              manager_gusto: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f' },
  { gusto_uuid: '3d4f9757-1439-4900-b011-498adfde6d3f', full_name: 'James Cozza',          title: 'Developer',                          manager_gusto: 'f5e6f952-fe71-49e2-b8f6-9808976295a9' },
  { gusto_uuid: '16251322-c7cf-47e2-bf78-575c20047304', full_name: 'Kole Minnoch',         title: 'AE',                                 manager_gusto: '93d8cfd2-ad5a-4223-87eb-e4b53cb6b570' },
  { gusto_uuid: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f', full_name: 'Jamie Thayne',         title: 'Manager, Sales Development',         manager_gusto: '60d787c9-67e6-47f0-8cac-3706f5ef5229' },
  { gusto_uuid: '68c722f1-cb71-4744-9477-3dbe48e1c21b', full_name: 'Vanessa Wright',       title: 'AM 3',                               manager_gusto: '60d787c9-67e6-47f0-8cac-3706f5ef5229' },
  { gusto_uuid: '9d9dff2c-58b0-4dee-999e-6b3d1c76c04f', full_name: 'Keegan Bigelow',       title: 'SDR 3',                              manager_gusto: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f' },
  { gusto_uuid: '54db671f-b12d-401d-8d5c-760f0b8c694e', full_name: 'William Nuckolls',     title: 'SDR',                                manager_gusto: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f' },
  { gusto_uuid: '0b836b21-16d3-4f91-8161-d09707cd7525', full_name: 'Sterling Evans',       title: 'AE',                                 manager_gusto: '93d8cfd2-ad5a-4223-87eb-e4b53cb6b570' },
  { gusto_uuid: '6adc7417-18be-4946-b01d-06ce84178988', full_name: 'Thomas Gardner',       title: 'Head of People & Recruiting',        manager_gusto: '5c252105-d8d9-4ebe-9101-c194e0d6918a' },
  { gusto_uuid: '32782916-df5c-4010-ab7a-fd167b771d8b', full_name: 'Cole Felis',           title: 'SDR 3',                              manager_gusto: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f' },
  { gusto_uuid: '94437c36-4aef-4135-8cb9-a0b6fd54976e', full_name: 'Jacob Badolato',       title: 'Software Engineer',                  manager_gusto: 'f5e6f952-fe71-49e2-b8f6-9808976295a9' },
  { gusto_uuid: 'bf9de12b-28c1-4f4c-b73a-4faee3496c11', full_name: 'Daniel Squires',       title: 'Software Engineer',                  manager_gusto: 'f5e6f952-fe71-49e2-b8f6-9808976295a9' },
  { gusto_uuid: 'b44419bf-4e58-4a54-b537-5748901fbd28', full_name: 'Jackson Call',         title: 'AE',                                 manager_gusto: '93d8cfd2-ad5a-4223-87eb-e4b53cb6b570' },
  { gusto_uuid: 'bc3d254e-844b-4280-b3e9-66a891bd1484', full_name: 'Braden York',          title: 'Sr. Revenue Operations Manager',     manager_gusto: '60d787c9-67e6-47f0-8cac-3706f5ef5229' },
  { gusto_uuid: '60d787c9-67e6-47f0-8cac-3706f5ef5229', full_name: 'Nicholas Powell',      title: 'SVP, Revenue',                       manager_gusto: '5c252105-d8d9-4ebe-9101-c194e0d6918a' },
  { gusto_uuid: 'bd808676-46e7-4c43-8a49-2f52b1189500', full_name: 'David Hall',           title: 'Chief of Staff',                     manager_gusto: '5c252105-d8d9-4ebe-9101-c194e0d6918a' },
  { gusto_uuid: '15bb57c7-e757-4544-a7ad-333a798d2120', full_name: 'Cameron Stephens',     title: 'Senior Product Manager',             manager_gusto: 'd73b3402-4899-4d7e-be35-04b0a6396471' },
  { gusto_uuid: '26955783-6898-409c-9014-56b63459ba4f', full_name: 'Tyler Price',          title: 'CSM 1',                              manager_gusto: '60d787c9-67e6-47f0-8cac-3706f5ef5229' },
  { gusto_uuid: '970c64e6-9ade-4820-aa41-4fbee1fdf130', full_name: 'Chris Booth',          title: 'Head of Finance',                    manager_gusto: '5c252105-d8d9-4ebe-9101-c194e0d6918a' },
  { gusto_uuid: '14412e79-8a94-472c-a3ff-3294e454e69b', full_name: 'Jillian Hatch',        title: 'SDR 2',                              manager_gusto: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f' },
  { gusto_uuid: 'ad91fb03-faf0-4b44-8931-3db5c2885fbb', full_name: 'Kassidy Johnson',      title: 'CSM 2',                              manager_gusto: '60d787c9-67e6-47f0-8cac-3706f5ef5229' },
  { gusto_uuid: 'f81c6143-12d6-41c9-8c7e-49326a303477', full_name: 'Duke McFarland',       title: 'AM 1',                               manager_gusto: '60d787c9-67e6-47f0-8cac-3706f5ef5229' },
  { gusto_uuid: 'ce2e1b38-5eff-41dc-a817-23216e2ea459', full_name: 'Brian Johnson',        title: 'Principal Software Engineer',        manager_gusto: 'f5e6f952-fe71-49e2-b8f6-9808976295a9' },
  { gusto_uuid: 'a7c60c95-cbaf-46b1-8a05-d62f60039d4f', full_name: 'Karissa Cozza',        title: 'Product Specialist',                 manager_gusto: 'd73b3402-4899-4d7e-be35-04b0a6396471' },
  { gusto_uuid: 'eef216ff-6690-4a72-b364-f3d9a51a4b41', full_name: 'Jacob Merriman',       title: 'SDR',                                manager_gusto: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f' },
  { gusto_uuid: '8cdff686-0325-49a9-af52-afbf278e0f54', full_name: 'Jesse Thayne',         title: 'AE',                                 manager_gusto: '93d8cfd2-ad5a-4223-87eb-e4b53cb6b570' },
  { gusto_uuid: '54d7f467-9aa5-4bf1-b2cf-616facda94c2', full_name: 'Jonathan Watkins',     title: 'AM 1',                               manager_gusto: '60d787c9-67e6-47f0-8cac-3706f5ef5229' },
  { gusto_uuid: '93d8cfd2-ad5a-4223-87eb-e4b53cb6b570', full_name: 'Brandon Heath',        title: 'Sales Manager',                      manager_gusto: '60d787c9-67e6-47f0-8cac-3706f5ef5229' },
  { gusto_uuid: 'e3e4e426-9715-4845-b65f-1bdde460e855', full_name: 'Afton Erickson',       title: 'Sales Development Representative',   manager_gusto: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f' },
  { gusto_uuid: '0a35ab47-f899-4bd5-9a3d-dede209698c1', full_name: 'Trevor Herrick',       title: 'Sales Development Representative',   manager_gusto: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f' },
  { gusto_uuid: '46e8d497-084b-4dbb-916e-fbd50cbdf011', full_name: 'Dylan Whitaker',       title: 'Sales Development Representative',   manager_gusto: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f' },
  { gusto_uuid: 'e00671a7-e83e-4490-bdb6-77bdc5679c07', full_name: 'Cooper Bucalo',        title: 'Sales Development Representative',   manager_gusto: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f' },
]

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('Creating review cycle...')
const [cycle] = await sb('POST', 'review_cycles', {
  name: 'Q1 2026',
  status: 'draft',
  created_by: ADMIN_ID,
})
console.log(`  ✓ Cycle: ${cycle.name} (${cycle.id})`)

console.log('\nUpserting managers...')
const managerIdByGustoUuid = new Map()
for (const m of MANAGERS) {
  const hash = await bcrypt.hash(`${m.first_name}123!`, 10)
  const existing = await fetch(
    `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(m.email)}&select=id`,
    { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
  ).then(r => r.json())

  let userId
  if (existing.length > 0) {
    // Update existing user with slack + gusto info
    await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(m.email)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ slack_user_id: m.slack_user_id, gusto_employee_id: m.gusto_uuid }),
    })
    userId = existing[0].id
    console.log(`  ~ ${m.first_name} ${m.last_name} (updated existing)`)
  } else {
    const [user] = await sb('POST', 'users', {
      email: m.email,
      first_name: m.first_name,
      last_name: m.last_name,
      role: 'manager',
      password_hash: hash,
      must_reset_password: true,
      gusto_employee_id: m.gusto_uuid,
      slack_user_id: m.slack_user_id,
    })
    userId = user.id
    console.log(`  + ${m.first_name} ${m.last_name}`)
  }
  managerIdByGustoUuid.set(m.gusto_uuid, userId)
}

console.log('\nUpserting direct reports + assignments...')
for (const dr of DIRECT_REPORTS) {
  const managerId = managerIdByGustoUuid.get(dr.manager_gusto)
  if (!managerId) { console.log(`  ! No manager found for ${dr.full_name}`); continue }

  // Upsert direct_report
  const existing = await fetch(
    `${SUPABASE_URL}/rest/v1/direct_reports?gusto_employee_id=eq.${dr.gusto_uuid}&select=id`,
    { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
  ).then(r => r.json())

  let drId
  if (existing.length > 0) {
    drId = existing[0].id
  } else {
    const [row] = await sb('POST', 'direct_reports', {
      gusto_employee_id: dr.gusto_uuid,
      full_name: dr.full_name,
      job_title: dr.title,
    })
    drId = row.id
  }

  // Upsert assignment
  await fetch(`${SUPABASE_URL}/rest/v1/manager_assignments`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({
      manager_id: managerId,
      direct_report_id: drId,
      review_cycle_id: cycle.id,
    }),
  })

  console.log(`  ✓ ${dr.full_name} → ${MANAGERS.find(m => m.gusto_uuid === dr.manager_gusto)?.first_name}`)
}

console.log('\n✅ Done! Summary:')
console.log(`  Cycle: ${cycle.name} (${cycle.id})`)
console.log(`  Managers: ${MANAGERS.length}`)
console.log(`  Direct reports: ${DIRECT_REPORTS.length}`)
