// Crea un usuario admin ya confirmado usando la service_role key.
// Uso: node scripts/create-admin.js <email> <password>
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
const url = envFile.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]
const serviceKey = envFile.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]

const [email, password] = process.argv.slice(2)
if (!email || !password) {
  console.error('Uso: node scripts/create-admin.js <email> <password>')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

supabase.auth.admin
  .createUser({ email, password, email_confirm: true })
  .then(({ data, error }) => {
    if (error) {
      console.error('ERROR:', error.message)
      process.exit(1)
    }
    console.log('OK: admin creado y confirmado →', data.user.email)
  })
