import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/**
 * Cifrado simétrico para secretos de integraciones (refresh tokens).
 * AES-256-GCM con clave derivada de AUTH_SECRET. SOLO servidor.
 * Formato: base64(iv | ciphertext | authTag).
 */

const IV_BYTES = 12
const TAG_BYTES = 16

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET no configurado')
  // Derivación determinista con dominio propio (no reutiliza la clave JWT tal cual)
  return createHash('sha256').update(`integration-tokens:${secret}`).digest()
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString('base64')
}

/** Devuelve null si el payload está corrupto o la clave cambió. */
export function decryptToken(enc: string): string | null {
  try {
    const buf = Buffer.from(enc, 'base64')
    const iv = buf.subarray(0, IV_BYTES)
    const tag = buf.subarray(buf.length - TAG_BYTES)
    const ciphertext = buf.subarray(IV_BYTES, buf.length - TAG_BYTES)
    const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
