// Run: node scripts/sync-gusto-mcp.mjs
// Syncs Gusto data (fetched via MCP) into a review cycle

import bcrypt from 'bcryptjs'

const SUPABASE_URL = 'https://dingknoibgywhzvbbiml.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpbmdrbm9pYmd5d2h6dmJiaW1sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI4Njk4NSwiZXhwIjoyMDg5ODYyOTg1fQ.AmkcFWIoeWusWJaZAA6geQokXdD5rA1rUimbVk1lLOk'
const CYCLE_ID = '363589da-5eb2-42fd-a049-c591a9b011ec' // Q1 2026

const SLACK_IDS = {
  'shane@boostly.com':          'U73F9153P',
  'travisse@boostly.com':       'U04QQAQT6E4',
  'jim@boostly.com':            'U07TXCY7MRA',
  'jamie@boostly.com':          'U087DEYJ4SK',
  'nick@boostly.com':           'U08P06V9SUR',
  'brandon.heath@boostly.com':  'U0ACX86LNL9',
}

// Fresh from Gusto MCP — 42 active employees
const employees = [
  { uuid: 'b98b9b42-f5fd-4659-b623-3d041fd5b7d6', first_name: 'Michael',   last_name: 'Murphy',     email: 'mikey@boostly.com',           manager_uuid: '5c252105-d8d9-4ebe-9101-c194e0d6918a', title: 'Chief Innovation Officer' },
  { uuid: '5c252105-d8d9-4ebe-9101-c194e0d6918a', first_name: 'Shane',     last_name: 'Murphy',     email: 'shane@boostly.com',           manager_uuid: null,                                   title: 'CEO' },
  { uuid: '42627bfa-422d-4502-8179-5bebc7745178', first_name: 'Brianna',   last_name: 'Davis',      email: 'brianna@boostly.com',         manager_uuid: '60d787c9-67e6-47f0-8cac-3706f5ef5229', title: 'Customer Support Specialist' },
  { uuid: 'afea0c2e-8f18-4fbe-96a6-68be4cfb65ce', first_name: 'Tyler',    last_name: 'Beagley',    email: 'tyler@boostly.com',           manager_uuid: 'd73b3402-4899-4d7e-be35-04b0a6396471', title: 'Enablement Operations Specialist' },
  { uuid: '7631b801-7f5f-4de7-b520-5603a10fea27', first_name: 'Dallas',   last_name: 'Williams',   email: 'dallas@boostly.com',          manager_uuid: '60d787c9-67e6-47f0-8cac-3706f5ef5229', title: 'CSM 2' },
  { uuid: '52c0eead-92b3-4e92-b7f0-46b2c4080bb5', first_name: 'Kyle',     last_name: 'Baker',      email: 'kyle@boostly.com',            manager_uuid: '93d8cfd2-ad5a-4223-87eb-e4b53cb6b570', title: 'AE' },
  { uuid: 'd73b3402-4899-4d7e-be35-04b0a6396471', first_name: 'Travisse', last_name: 'Hansen',     email: 'travisse@boostly.com',        manager_uuid: '5c252105-d8d9-4ebe-9101-c194e0d6918a', title: 'Head of Product' },
  { uuid: 'a8d9d1bc-d2d3-44db-861b-b3db00de8f9a', first_name: 'Christian',last_name: 'Carmicheal', email: 'christian@boostly.com',       manager_uuid: '60d787c9-67e6-47f0-8cac-3706f5ef5229', title: 'Marketing Specialist' },
  { uuid: 'd2d1d92e-25f5-439e-8170-5195e4bf5f7c', first_name: 'Chris',    last_name: 'Hubbard',    email: 'chris@boostly.com',           manager_uuid: '60d787c9-67e6-47f0-8cac-3706f5ef5229', title: 'CSM 2' },
  { uuid: 'f5e6f952-fe71-49e2-b8f6-9808976295a9', first_name: 'James',    last_name: 'Mayes',      email: 'jim@boostly.com',             manager_uuid: '5c252105-d8d9-4ebe-9101-c194e0d6918a', title: 'CTO' },
  { uuid: '52d60bc3-4845-473c-9807-8ce102c11409', first_name: 'Ella',     last_name: 'Van Horn',   email: 'ella@boostly.com',            manager_uuid: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f', title: 'SDR 3' },
  { uuid: '3d4f9757-1439-4900-b011-498adfde6d3f', first_name: 'James',    last_name: 'Cozza',      email: 'jimmy@boostly.com',           manager_uuid: 'f5e6f952-fe71-49e2-b8f6-9808976295a9', title: 'Developer' },
  { uuid: '16251322-c7cf-47e2-bf78-575c20047304', first_name: 'Kole',     last_name: 'Minnoch',    email: 'kole@boostly.com',            manager_uuid: '93d8cfd2-ad5a-4223-87eb-e4b53cb6b570', title: 'AE' },
  { uuid: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f', first_name: 'Jamie',    last_name: 'Thayne',     email: 'jamie@boostly.com',           manager_uuid: '60d787c9-67e6-47f0-8cac-3706f5ef5229', title: 'Manager, Sales Development' },
  { uuid: '68c722f1-cb71-4744-9477-3dbe48e1c21b', first_name: 'Vanessa',  last_name: 'Wright',     email: 'vanessa@boostly.com',         manager_uuid: '60d787c9-67e6-47f0-8cac-3706f5ef5229', title: 'AM 3' },
  { uuid: '9d9dff2c-58b0-4dee-999e-6b3d1c76c04f', first_name: 'Keegan',   last_name: 'Bigelow',    email: 'keegan@boostly.com',          manager_uuid: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f', title: 'SDR 3' },
  { uuid: '54db671f-b12d-401d-8d5c-760f0b8c694e', first_name: 'William',  last_name: 'Nuckolls',   email: 'will@boostly.com',            manager_uuid: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f', title: 'SDR' },
  { uuid: '0b836b21-16d3-4f91-8161-d09707cd7525', first_name: 'Sterling', last_name: 'Evans',      email: 'sterling@boostly.com',        manager_uuid: '93d8cfd2-ad5a-4223-87eb-e4b53cb6b570', title: 'AE' },
  { uuid: '6adc7417-18be-4946-b01d-06ce84178988', first_name: 'Thomas',   last_name: 'Gardner',    email: 'brixton@boostly.com',         manager_uuid: '5c252105-d8d9-4ebe-9101-c194e0d6918a', title: 'Head of People & Recruiting' },
  { uuid: '32782916-df5c-4010-ab7a-fd167b771d8b', first_name: 'Cole',     last_name: 'Felis',      email: 'cole.felis@boostly.com',      manager_uuid: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f', title: 'SDR 3' },
  { uuid: '94437c36-4aef-4135-8cb9-a0b6fd54976e', first_name: 'Jacob',    last_name: 'Badolato',   email: 'jacob.badolato@boostly.com',  manager_uuid: 'f5e6f952-fe71-49e2-b8f6-9808976295a9', title: 'Software Engineer' },
  { uuid: 'bf9de12b-28c1-4f4c-b73a-4faee3496c11', first_name: 'Daniel',   last_name: 'Squires',    email: 'daniel.squires@boostly.com',  manager_uuid: 'f5e6f952-fe71-49e2-b8f6-9808976295a9', title: 'Software Engineer' },
  { uuid: 'b44419bf-4e58-4a54-b537-5748901fbd28', first_name: 'Jackson',  last_name: 'Call',       email: 'jackson.call@boostly.com',   manager_uuid: '93d8cfd2-ad5a-4223-87eb-e4b53cb6b570', title: 'AE' },
  { uuid: 'bc3d254e-844b-4280-b3e9-66a891bd1484', first_name: 'Braden',   last_name: 'York',       email: 'braden.york@boostly.com',    manager_uuid: '60d787c9-67e6-47f0-8cac-3706f5ef5229', title: 'Sr. Revenue Operations Manager' },
  { uuid: '60d787c9-67e6-47f0-8cac-3706f5ef5229', first_name: 'Nicholas', last_name: 'Powell',     email: 'nick@boostly.com',            manager_uuid: '5c252105-d8d9-4ebe-9101-c194e0d6918a', title: 'SVP, Revenue' },
  { uuid: 'bd808676-46e7-4c43-8a49-2f52b1189500', first_name: 'David',    last_name: 'Hall',       email: 'david@boostly.com',           manager_uuid: '5c252105-d8d9-4ebe-9101-c194e0d6918a', title: 'Chief of Staff' },
  { uuid: '15bb57c7-e757-4544-a7ad-333a798d2120', first_name: 'Cameron',  last_name: 'Stephens',   email: 'cam@boostly.com',             manager_uuid: 'd73b3402-4899-4d7e-be35-04b0a6396471', title: 'Senior Product Manager' },
  { uuid: '26955783-6898-409c-9014-56b63459ba4f', first_name: 'Tyler',    last_name: 'Price',      email: 'tyler.price@boostly.com',    manager_uuid: '60d787c9-67e6-47f0-8cac-3706f5ef5229', title: 'CSM 1' },
  { uuid: '970c64e6-9ade-4820-aa41-4fbee1fdf130', first_name: 'Chris',    last_name: 'Booth',      email: 'chris.booth@boostly.com',    manager_uuid: '5c252105-d8d9-4ebe-9101-c194e0d6918a', title: 'Head of Finance' },
  { uuid: '14412e79-8a94-472c-a3ff-3294e454e69b', first_name: 'Jillian',  last_name: 'Hatch',      email: 'jillian.hatch@boostly.com',  manager_uuid: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f', title: 'SDR 2' },
  { uuid: 'ad91fb03-faf0-4b44-8931-3db5c2885fbb', first_name: 'Kassidy',  last_name: 'Johnson',    email: 'kassidy.farrer@boostly.com', manager_uuid: '60d787c9-67e6-47f0-8cac-3706f5ef5229', title: 'CSM 2' },
  { uuid: 'f81c6143-12d6-41c9-8c7e-49326a303477', first_name: 'Duke',     last_name: 'McFarland',  email: 'duke@boostly.com',            manager_uuid: '60d787c9-67e6-47f0-8cac-3706f5ef5229', title: 'AM 1' },
  { uuid: 'ce2e1b38-5eff-41dc-a817-23216e2ea459', first_name: 'Brian',    last_name: 'Johnson',    email: 'brian.johnson@boostly.com',  manager_uuid: 'f5e6f952-fe71-49e2-b8f6-9808976295a9', title: 'Principal Software Engineer' },
  { uuid: 'a7c60c95-cbaf-46b1-8a05-d62f60039d4f', first_name: 'Karissa',  last_name: 'Cozza',      email: 'karissa.cozza@boostly.com',  manager_uuid: 'd73b3402-4899-4d7e-be35-04b0a6396471', title: 'Product Specialist' },
  { uuid: 'eef216ff-6690-4a72-b364-f3d9a51a4b41', first_name: 'Jacob',    last_name: 'Merriman',   email: 'jacob.merriman@boostly.com', manager_uuid: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f', title: 'SDR' },
  { uuid: '8cdff686-0325-49a9-af52-afbf278e0f54', first_name: 'Jesse',    last_name: 'Thayne',     email: 'jesse.thayne@boostly.com',   manager_uuid: '93d8cfd2-ad5a-4223-87eb-e4b53cb6b570', title: 'AE' },
  { uuid: '54d7f467-9aa5-4bf1-b2cf-616facda94c2', first_name: 'Jonathan', last_name: 'Watkins',    email: 'jonathan.watkins@boostly.com',manager_uuid: '60d787c9-67e6-47f0-8cac-3706f5ef5229', title: 'AM 1' },
  { uuid: '93d8cfd2-ad5a-4223-87eb-e4b53cb6b570', first_name: 'Brandon',  last_name: 'Heath',      email: 'brandon.heath@boostly.com',  manager_uuid: '60d787c9-67e6-47f0-8cac-3706f5ef5229', title: 'Sales Manager' },
  { uuid: 'e3e4e426-9715-4845-b65f-1bdde460e855', first_name: 'Afton',    last_name: 'Erickson',   email: 'afton.erickson@boostly.com', manager_uuid: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f', title: 'Sales Development Representative' },
  { uuid: '0a35ab47-f899-4bd5-9a3d-dede209698c1', first_name: 'Trevor',   last_name: 'Herrick',    email: 'trevor.herrick@boostly.com', manager_uuid: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f', title: 'Sales Development Representative' },
  { uuid: '46e8d497-084b-4dbb-916e-fbd50cbdf011', first_name: 'Dylan',    last_name: 'Whitaker',   email: 'dylan.whitaker@boostly.com', manager_uuid: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f', title: 'Sales Development Representative' },
  { uuid: 'e00671a7-e83e-4490-bdb6-77bdc5679c07', first_name: 'Cooper',   last_name: 'Bucalo',     email: 'cooper.bucalo@boostly.com',  manager_uuid: 'f3ef76d9-604d-4a24-84c6-014dd3b3022f', title: 'Sales Development Representative' },
]

async function sb(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'resolution=merge-duplicates,return=representation' : 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// Identify manager UUIDs
const managerUuids = new Set(employees.map(e => e.manager_uuid).filter(Boolean))

// Upsert managers
const userIdByGustoUuid = new Map()
let managersUpserted = 0

for (const emp of employees) {
  if (!managerUuids.has(emp.uuid)) continue

  const hash = await bcrypt.hash(`${emp.first_name}123!`, 10)
  const slackId = SLACK_IDS[emp.email] ?? null

  const rows = await sb('POST', '/users?on_conflict=email', [{
    email: emp.email,
    first_name: emp.first_name,
    last_name: emp.last_name,
    role: 'manager',
    password_hash: hash,
    must_reset_password: true,
    gusto_employee_id: emp.uuid,
    slack_user_id: slackId,
  }])

  if (rows?.[0]) {
    userIdByGustoUuid.set(emp.uuid, rows[0].id)
    managersUpserted++
    console.log(`  ✓ Manager: ${emp.first_name} ${emp.last_name} (${emp.email}) slack=${slackId ?? 'none'}`)
  }
}

// Upsert direct reports + assignments
let drUpserted = 0
let assignmentsCreated = 0

for (const emp of employees) {
  const managerGustoUuid = emp.manager_uuid
  if (!managerGustoUuid || !userIdByGustoUuid.has(managerGustoUuid)) continue

  const drRows = await sb('POST', '/direct_reports?on_conflict=gusto_employee_id', [{
    gusto_employee_id: emp.uuid,
    full_name: `${emp.first_name} ${emp.last_name}`,
    job_title: emp.title ?? null,
  }])

  if (!drRows?.[0]) continue
  drUpserted++

  await sb('POST', '/manager_assignments?on_conflict=manager_id,direct_report_id,review_cycle_id', [{
    manager_id: userIdByGustoUuid.get(managerGustoUuid),
    direct_report_id: drRows[0].id,
    review_cycle_id: CYCLE_ID,
  }])
  assignmentsCreated++
}

// Activate the cycle
await sb('PATCH', `/review_cycles?id=eq.${CYCLE_ID}`, { status: 'active' })

console.log(`\nDone. ${managersUpserted} managers, ${drUpserted} DRs, ${assignmentsCreated} assignments. Cycle set to active.`)
