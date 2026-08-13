import { timingSafeEqual } from 'crypto'
import { createMcpHandler } from 'mcp-handler'
import { z } from 'zod'
import {
  addNoteToContact,
  addTagToContact,
  audienceSummary,
  campaignContent,
  campaignList,
  contactCard,
  removeTagFromContact,
  searchContacts,
} from '@/features/assistant/services/crm-data'

/**
 * Servidor MCP de GHL Titan (PRP-016): el "Business OS" de Tony (Claude Code)
 * se conecta aquí para consultar prospectos y hacer seguimiento.
 * - Auth: token estático por header Authorization: Bearer (env MCP_API_TOKEN).
 *   Los /api/* NO pasan por el proxy → se valida aquí.
 * - Lectura + escrituras seguras (etiquetar dispara automatizaciones, notas).
 *   NUNCA exponer: enviar emails, borrar, campañas de escritura.
 */

function json(result: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
}

const mcpHandler = createMcpHandler((server) => {
  server.registerTool(
    'resumen_audiencia',
    {
      title: 'Resumen de audiencia',
      description:
        'Totales del CRM: contactos, bajas y etiquetas con cuántos contactos tiene cada una.',
      inputSchema: z.object({}),
    },
    async () => json(await audienceSummary())
  )

  server.registerTool(
    'buscar_contactos',
    {
      title: 'Buscar contactos',
      description:
        'Busca contactos por texto (nombre, email, teléfono, empresa) y/o etiqueta exacta. Hasta 20 resultados + total.',
      inputSchema: z.object({
        consulta: z.string().max(200).optional().describe('Texto a buscar'),
        etiqueta: z.string().max(100).optional().describe('Filtrar por etiqueta exacta'),
      }),
    },
    async (input) => json(await searchContacts(input))
  )

  server.registerTool(
    'ver_contacto',
    {
      title: 'Ver ficha de contacto',
      description:
        'Ficha 360 de un contacto: datos, etiquetas y últimas interacciones (citas, emails, formularios, notas). Busca por email o nombre.',
      inputSchema: z.object({
        consulta: z.string().min(2).max(200).describe('Email o nombre del contacto'),
      }),
    },
    async ({ consulta }) => json(await contactCard(consulta))
  )

  server.registerTool(
    'listar_campanas',
    {
      title: 'Listar campañas',
      description:
        'Campañas de email con estado y estadísticas (destinatarios, enviados, clicks). Solo lectura.',
      inputSchema: z.object({}),
    },
    async () => json(await campaignList())
  )

  server.registerTool(
    'ver_campana',
    {
      title: 'Ver contenido de campaña',
      description: 'Asunto y texto de los bloques de una campaña (id de listar_campanas). Solo lectura.',
      inputSchema: z.object({ id: z.string().uuid() }),
    },
    async ({ id }) => json(await campaignContent(id))
  )

  server.registerTool(
    'etiquetar_contacto',
    {
      title: 'Añadir etiqueta',
      description:
        'Añade una etiqueta a un contacto (por id o email exacto) para clasificarlo o marcar seguimiento. DISPARA las automatizaciones con trigger de esa etiqueta, igual que hacerlo a mano en el panel.',
      inputSchema: z.object({
        contacto: z.string().min(2).max(200).describe('Id (uuid) o email exacto del contacto'),
        etiqueta: z.string().min(1).max(100).describe('La etiqueta a añadir'),
      }),
    },
    async ({ contacto, etiqueta }) => json(await addTagToContact(contacto, etiqueta))
  )

  server.registerTool(
    'quitar_etiqueta',
    {
      title: 'Quitar etiqueta',
      description: 'Quita una etiqueta de un contacto (por id o email exacto). No dispara automatizaciones.',
      inputSchema: z.object({
        contacto: z.string().min(2).max(200).describe('Id (uuid) o email exacto del contacto'),
        etiqueta: z.string().min(1).max(100).describe('La etiqueta a quitar'),
      }),
    },
    async ({ contacto, etiqueta }) => json(await removeTagFromContact(contacto, etiqueta))
  )

  server.registerTool(
    'anadir_nota',
    {
      title: 'Añadir nota',
      description:
        'Añade una nota al timeline de un contacto (por id o email exacto). Útil para registrar seguimiento hecho desde fuera.',
      inputSchema: z.object({
        contacto: z.string().min(2).max(200).describe('Id (uuid) o email exacto del contacto'),
        texto: z.string().min(1).max(2000).describe('El texto de la nota'),
      }),
    },
    async ({ contacto, texto }) => json(await addNoteToContact(contacto, texto))
  )
})

function authorized(req: Request): boolean {
  const token = process.env.MCP_API_TOKEN
  if (!token) return false // sin token configurado, el MCP queda apagado
  const header = req.headers.get('authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice(7) : ''
  const a = Buffer.from(provided)
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function guarded(req: Request): Promise<Response> {
  if (!authorized(req)) return new Response('No autorizado', { status: 401 })
  return mcpHandler(req)
}

export { guarded as GET, guarded as POST, guarded as DELETE }
