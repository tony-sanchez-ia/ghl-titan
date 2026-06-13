// Ejecuta un archivo SQL contra la BD de Supabase (DATABASE_URL de .env.local)
// Uso: node scripts/run-sql.js supabase/migrations/0001_profiles.sql
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
const dbUrl = envFile.match(/^DATABASE_URL=(.+)$/m)?.[1]
if (!dbUrl) {
  console.error('DATABASE_URL no encontrada en .env.local')
  process.exit(1)
}

const sqlFile = process.argv[2]
if (!sqlFile) {
  console.error('Uso: node scripts/run-sql.js <archivo.sql>')
  process.exit(1)
}

const sql = fs.readFileSync(sqlFile, 'utf8')
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

client
  .connect()
  .then(() => client.query(sql))
  .then(() => {
    console.log(`OK: ${sqlFile} ejecutado`)
    return client.end()
  })
  .catch((err) => {
    console.error(`ERROR en ${sqlFile}:`, err.message)
    process.exit(1)
  })
