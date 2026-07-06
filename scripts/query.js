// Ejecuta una query SQL inline y muestra los resultados (DATABASE_URL de .env.local)
// Uso: node scripts/query.js "select version()"
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
const dbUrl = envFile.match(/^DATABASE_URL=(.+)$/m)?.[1]
if (!dbUrl) {
  console.error('DATABASE_URL no encontrada en .env.local')
  process.exit(1)
}

const sql = process.argv[2]
if (!sql) {
  console.error('Uso: node scripts/query.js "<sql>"')
  process.exit(1)
}

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

client
  .connect()
  .then(() => client.query(sql))
  .then((res) => {
    const results = Array.isArray(res) ? res : [res]
    for (const r of results) {
      if (r.rows?.length) console.table(r.rows)
      else console.log(`(${r.command}: ${r.rowCount ?? 0} filas)`)
    }
    return client.end()
  })
  .catch((err) => {
    console.error('ERROR:', err.message)
    process.exit(1)
  })
