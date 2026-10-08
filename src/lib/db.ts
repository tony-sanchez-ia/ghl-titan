import { Pool } from 'pg'

/**
 * Pool de conexiones a Neon (Postgres). SOLO servidor.
 * NUNCA importar desde un componente cliente.
 */
declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined
  // eslint-disable-next-line no-var
  var __dbLastQueryAt: number | undefined
}

function getPool(): Pool {
  if (!global.__dbPool) {
    global.__dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    })
  }
  return global.__dbPool
}

/** Momento (ms) de la última query de este proceso; 0 si aún no hubo ninguna. */
export function lastQueryAt(): number {
  return global.__dbLastQueryAt ?? 0
}

/** Ejecuta una query parametrizada y devuelve las filas tipadas. */
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  global.__dbLastQueryAt = Date.now()
  const res = await getPool().query(text, params)
  return res.rows as T[]
}

/** Como query() pero devuelve la primera fila o null. */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}
