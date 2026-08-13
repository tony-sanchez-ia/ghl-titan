import { tool } from 'ai'
import { z } from 'zod'
import { queryOne } from '@/lib/db'
import { uid } from '@/shared/lib/uid'
import { DEFAULT_STYLES, newSection } from '@/features/marketing/services/design'
import {
  audienceSummary,
  campaignContent,
  campaignList,
  contactCard,
  searchContacts,
} from './crm-data'
import { addMemoryEntry, memoryExists } from './memory'
import type { EmailBlock, EmailDesign } from '@/types/database'

/**
 * Herramientas del Asistente IA (Vercel AI SDK `tool()` + zod).
 * La lógica de datos vive en crm-data.ts (compartida con el servidor MCP).
 * Solo lectura sobre contactos/campañas + creación de BORRADORES.
 * No existe (a propósito) ninguna herramienta de envío.
 */

export const assistantTools = {
  resumen_audiencia: tool({
    description:
      'Resumen de la audiencia: total de contactos, bajas, y etiquetas con cuántos contactos tiene cada una. Úsala para segmentar o dimensionar una newsletter.',
    inputSchema: z.object({}),
    execute: async () => audienceSummary(),
  }),

  buscar_contactos: tool({
    description:
      'Busca contactos por texto (nombre, email, teléfono o empresa) y/o por etiqueta. Devuelve hasta 20 resultados y el total.',
    inputSchema: z.object({
      consulta: z.string().max(200).optional().describe('Texto a buscar (nombre, email, empresa…)'),
      etiqueta: z.string().max(100).optional().describe('Filtrar por una etiqueta exacta'),
    }),
    execute: async (input) => searchContacts(input),
  }),

  ver_contacto: tool({
    description:
      'Ficha completa de UN contacto: datos, etiquetas y sus últimas interacciones (citas, emails, formularios). Busca por email o nombre.',
    inputSchema: z.object({
      consulta: z.string().min(2).max(200).describe('Email o nombre del contacto'),
    }),
    execute: async ({ consulta }) => contactCard(consulta),
  }),

  listar_campanas: tool({
    description:
      'Lista las campañas/newsletters existentes con su estado y estadísticas (destinatarios, enviados, clicks). Útil para ver qué se ha mandado ya y qué funcionó.',
    inputSchema: z.object({}),
    execute: async () => campaignList(),
  }),

  ver_campana: tool({
    description:
      'Contenido completo de una campaña (por id de listar_campanas): asunto y texto de todos sus bloques. Úsala para estudiar el copy de campañas anteriores.',
    inputSchema: z.object({
      id: z.string().uuid().describe('El id de la campaña'),
    }),
    execute: async ({ id }) => campaignContent(id),
  }),

  crear_borrador_newsletter: tool({
    description:
      'Crea un BORRADOR de newsletter real en Marketing → Campañas (nunca lo envía). Recibe el copy como bloques de texto plano en orden. Devuelve la ruta donde revisarlo.',
    inputSchema: z.object({
      nombre: z.string().min(1).max(160).describe('Nombre interno de la campaña'),
      asunto: z.string().min(1).max(200).describe('Asunto del email'),
      bloques: z
        .array(
          z.object({
            tipo: z.enum(['titular', 'texto', 'boton']),
            texto: z.string().min(1).max(4000).describe('Contenido en texto plano (sin HTML ni markdown)'),
            url: z.string().max(1000).optional().describe('Enlace del botón (solo tipo boton)'),
          })
        )
        .min(1)
        .max(20),
    }),
    execute: async ({ nombre, asunto, bloques }) => {
      const emailBlocks: EmailBlock[] = [
        { id: uid(), type: 'header', config: { title: 'GHL Titan' } },
        ...bloques.map((b): EmailBlock => {
          if (b.tipo === 'boton') {
            return {
              id: uid(),
              type: 'button',
              config: { label: b.texto.slice(0, 200), url: b.url ?? '', align: 'center' },
            }
          }
          return {
            id: uid(),
            type: 'text',
            config: { text: b.texto, size: b.tipo === 'titular' ? 'title' : 'normal', align: 'left' },
          }
        }),
        { id: uid(), type: 'footer', config: { footer_text: 'GHL Titan · Titanic Factory' } },
      ]
      const design: EmailDesign = {
        version: 2,
        styles: { ...DEFAULT_STYLES },
        sections: [newSection('1', emailBlocks)],
      }
      const row = await queryOne<{ id: string }>(
        `insert into email_campaigns (name, subject, design, status)
         values ($1, $2, $3, 'draft') returning id`,
        [nombre, asunto, JSON.stringify(design)]
      )
      return {
        creado: true,
        id: row!.id,
        ruta: `/marketing/campaigns/${row!.id}`,
        nota: 'Borrador creado. Tony puede retocarlo en el editor visual y enviarlo desde Marketing.',
      }
    },
  }),

  guardar_memoria: tool({
    description:
      'Guarda en la memoria de marca un dato duradero aprendido en la conversación (tono, público, ofertas, preferencias, qué funcionó). Una frase corta y autocontenida.',
    inputSchema: z.object({
      dato: z.string().min(4).max(500).describe('El dato a recordar, en una frase'),
    }),
    execute: async ({ dato }) => {
      if (await memoryExists(dato)) return { guardado: false, motivo: 'Ya estaba en la memoria' }
      await addMemoryEntry(dato, 'agent')
      return { guardado: true }
    },
  }),
}
