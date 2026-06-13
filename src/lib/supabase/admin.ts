import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con service-role. SOLO servidor.
 * Úsalo para operaciones públicas controladas (página de reservas /book/[slug])
 * donde no hay sesión de usuario pero sí queremos leer/escribir saltándonos RLS
 * de forma acotada. NUNCA importar desde un componente cliente.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
