// Importa contactos del CSV de GHL directo a Neon (pg).
// Replica la lógica de src/features/contacts/services/csv-import.ts
// Uso: node scripts/import-contacts.js <ruta-al-csv>
const fs = require('fs')
const path = require('path')
const Papa = require('papaparse')
const { Client } = require('pg')

const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
const dbUrl = env.match(/^DATABASE_URL=(.+)$/m)[1]

const clean = (v) => {
  const s = (v ?? '').trim()
  return s === '' ? null : s
}
const parseDate = (v) => {
  const s = (v ?? '').trim()
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
const parseTags = (v) => {
  const s = (v ?? '').trim()
  if (!s) return []
  return Array.from(new Set(s.split(',').map((t) => t.trim()).filter(Boolean)))
}

async function main() {
  const csvPath = process.argv[2]
  const content = fs.readFileSync(csvPath, 'utf8')
  const { data } = Papa.parse(content, { header: true, skipEmptyLines: true })

  const rows = []
  for (const raw of data) {
    const ghlId = clean(raw['Contact Id'])
    const firstName = clean(raw['First Name'])
    const lastName = clean(raw['Last Name'])
    const email = clean(raw['Email'])
    const phone = clean(raw['Phone'])
    if (!ghlId && !firstName && !lastName && !email && !phone) continue
    rows.push({
      ghl_contact_id: ghlId,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      business_name: clean(raw['Business Name']),
      tags: parseTags(raw['Tags']),
      last_activity_at: parseDate(raw['Last Activity']),
    })
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const ghlIds = rows.map((r) => r.ghl_contact_id).filter(Boolean)
  const existing = await client.query(
    'select ghl_contact_id from contacts where ghl_contact_id = any($1)',
    [ghlIds]
  )
  const existingSet = new Set(existing.rows.map((e) => e.ghl_contact_id))

  const newIds = []
  for (const r of rows) {
    const res = await client.query(
      `insert into contacts (ghl_contact_id, first_name, last_name, email, phone, business_name, tags, last_activity_at, source)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'ghl_import')
       on conflict (ghl_contact_id) do update set
         first_name = excluded.first_name,
         last_name = excluded.last_name,
         email = excluded.email,
         phone = excluded.phone,
         business_name = excluded.business_name,
         tags = excluded.tags,
         last_activity_at = excluded.last_activity_at,
         updated_at = now()
       returning id, ghl_contact_id`,
      [r.ghl_contact_id, r.first_name, r.last_name, r.email, r.phone, r.business_name, r.tags, r.last_activity_at]
    )
    const c = res.rows[0]
    if (c.ghl_contact_id && !existingSet.has(c.ghl_contact_id)) newIds.push(c.id)
  }

  if (newIds.length > 0) {
    await client.query(
      `insert into contact_activities (contact_id, type, description, metadata)
       select unnest($1::uuid[]), 'imported', 'Importado desde GoHighLevel', '{}'`,
      [newIds]
    )
  }

  const withTags = rows.filter((r) => r.tags.length > 0).length
  console.log(
    `OK: ${rows.length} contactos procesados (${rows.length - existingSet.size} nuevos, ${existingSet.size} actualizados, ${withTags} con tags)`
  )
  await client.end()
}

main().catch((err) => {
  console.error('ERROR:', err.message)
  process.exit(1)
})
