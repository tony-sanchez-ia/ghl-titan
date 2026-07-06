/**
 * ID aleatorio único. NO usar crypto.randomUUID() directamente en código de cliente:
 * solo existe en contextos seguros (HTTPS/localhost) y este proyecto se prueba
 * desde otras máquinas de la LAN por http://IP:3000 (contexto NO seguro).
 * crypto.getRandomValues sí está disponible en contextos no seguros.
 */
export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes =
    typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
      ? crypto.getRandomValues(new Uint8Array(16))
      : Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
