// Importa contactos del CSV de GHL usando la service_role key.
// Replica la lógica de src/features/contacts/services/csv-import.ts
// Uso: node scripts/import-contacts.js <ruta-al-csv>
const fs = require('fs')
const path = require('path')
const Papa = require('papaparse')
const { createClient } = require('@supabase/supabase-js')

const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)[1]
const serviceKey = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)[1]
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

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
      source: 'ghl_import',
    })
  }

  const ghlIds = rows.map((r) => r.ghl_contact_id).filter(Boolean)
  const { data: existing } = await supabase
    .from('contacts')
    .select('ghl_contact_id')
    .in('ghl_contact_id', ghlIds)
  const existingSet = new Set((existing ?? []).map((e) => e.ghl_contact_id))

  const { data: upserted, error } = await supabase
    .from('contacts')
    .upsert(rows, { onConflict: 'ghl_contact_id' })
    .select('id, ghl_contact_id')
  if (error) {
    console.error('ERROR upsert:', error.message)
    process.exit(1)
  }

  const newActivities = (upserted ?? [])
    .filter((c) => c.ghl_contact_id && !existingSet.has(c.ghl_contact_id))
    .map((c) => ({
      contact_id: c.id,
      type: 'imported',
      description: 'Importado desde GoHighLevel',
      metadata: {},
    }))
  if (newActivities.length > 0) {
    await supabase.from('contact_activities').insert(newActivities)
  }

  const withTags = rows.filter((r) => r.tags.length > 0).length
  console.log(`OK: ${rows.length} contactos procesados (${rows.length - existingSet.size} nuevos, ${existingSet.size} actualizados, ${withTags} con tags)`)
}

main()
