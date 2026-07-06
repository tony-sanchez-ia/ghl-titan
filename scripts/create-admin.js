// Crea (o resetea la contraseña de) el usuario admin en Neon.
// Uso: node scripts/create-admin.js <email> <password>
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')
const bcrypt = require('bcryptjs')

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
const dbUrl = envFile.match(/^DATABASE_URL=(.+)$/m)?.[1]

const [email, password] = process.argv.slice(2)
if (!email || !password) {
  console.error('Uso: node scripts/create-admin.js <email> <password>')
  process.exit(1)
}

async function main() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  const hash = await bcrypt.hash(password, 10)
  const res = await client.query(
    `insert into users (email, password_hash) values ($1, $2)
     on conflict (email) do update set password_hash = excluded.password_hash, updated_at = now()
     returning email`,
    [email.toLowerCase(), hash]
  )
  console.log('OK: admin creado/actualizado →', res.rows[0].email)
  await client.end()
}

main().catch((err) => {
  console.error('ERROR:', err.message)
  process.exit(1)
})
