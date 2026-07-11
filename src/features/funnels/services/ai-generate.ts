import { generateObject } from 'ai'
import { z } from 'zod'
import { uid } from '@/shared/lib/uid'
import { aiModel, getOpenRouter } from '@/lib/ai/openrouter'
import { newPageSection } from './design'
import type { PageBlock, PageDesign } from '@/types/database'

/**
 * Generación de páginas por IA (OpenRouter + generateObject con schema Zod).
 * La IA NUNCA produce HTML crudo: devuelve bloques tipados con texto plano
 * que nosotros escapamos y mapeamos a PageDesign. Sin imágenes ni vídeos
 * (la IA inventaría URLs falsas).
 */

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)

const aiBlockSchema = z.object({
  type: z.enum(['heading', 'text', 'button', 'divider', 'spacer', 'form']),
  text: z.string().max(2000).optional().describe('Contenido del titular o párrafo (texto plano, sin HTML)'),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().describe('Jerarquía del titular: 1 hero, 2 sección, 3 apartado'),
  align: z.enum(['left', 'center', 'right']).optional(),
  label: z.string().max(120).optional().describe('Texto del botón o del formulario'),
})

const aiSectionSchema = z.object({
  layout: z.enum(['1', '2']).describe('1 = una columna, 2 = dos columnas iguales'),
  tone: z.enum(['base', 'suave', 'oscuro']).describe('Fondo: base = fondo de página, suave = gris tenue, oscuro = contraste fuerte'),
  blocks: z.array(aiBlockSchema).min(1).max(10).describe('Bloques de la sección; con layout 2 se reparten entre columnas'),
})

const aiStepSchema = z.object({
  name: z.string().max(60).describe('Nombre corto del paso, p. ej. "Inicio" o "Gracias"'),
  seo_title: z.string().max(160).describe('Título SEO de la página'),
  seo_description: z.string().max(300).describe('Descripción SEO'),
  sections: z.array(aiSectionSchema).min(1).max(10),
})

const aiFunnelSchema = z.object({
  button_color: hexColor.describe('Color de los botones acorde al negocio'),
  steps: z.array(aiStepSchema).min(1).max(4).describe('Pasos del embudo, en orden'),
})

export type AiGeneratedStep = {
  name: string
  seo_title: string
  seo_description: string
  design: PageDesign
}

function escText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Texto plano de la IA → html del bloque de texto (escapado + saltos de línea). */
function plainToHtml(text: string): string {
  return escText(text).replace(/\n/g, '<br>')
}

const TONE_BG: Record<'base' | 'suave' | 'oscuro', string | undefined> = {
  base: undefined,
  suave: '#f1f5f9',
  oscuro: '#0f172a',
}

function mapBlocks(
  blocks: z.infer<typeof aiBlockSchema>[],
  hasForm: boolean
): { blocks: PageBlock[]; hasForm: boolean } {
  const out: PageBlock[] = []
  for (const b of blocks) {
    if (b.type === 'heading' && b.text) {
      out.push({ id: uid(), type: 'heading', config: { text: b.text, level: b.level ?? 2, align: b.align ?? 'left' } })
    } else if (b.type === 'text' && b.text) {
      out.push({ id: uid(), type: 'text', config: { html: plainToHtml(b.text), align: b.align ?? 'left' } })
    } else if (b.type === 'button') {
      out.push({ id: uid(), type: 'button', config: { label: b.label || 'Quiero saber más', url: '', align: b.align ?? 'center' } })
    } else if (b.type === 'form' && !hasForm) {
      // el formulario queda listo para que Tony elija cuál en el editor
      out.push({ id: uid(), type: 'form', config: { label: b.label || 'Enviar', align: 'center' } })
      hasForm = true
    } else if (b.type === 'divider') {
      out.push({ id: uid(), type: 'divider', config: {} })
    } else if (b.type === 'spacer') {
      out.push({ id: uid(), type: 'spacer', config: { height: 40 } })
    }
  }
  return { blocks: out, hasForm }
}

function mapStep(step: z.infer<typeof aiStepSchema>, buttonColor: string): AiGeneratedStep {
  let hasForm = false
  const design: PageDesign = {
    version: 1,
    styles: { background_color: '#ffffff', button_color: buttonColor, text_color: '#0f172a' },
    sections: step.sections.map((s) => {
      const mapped = mapBlocks(s.blocks, hasForm)
      hasForm = mapped.hasForm
      const section = newPageSection(s.layout, mapped.blocks)
      if (s.layout === '2' && mapped.blocks.length > 1) {
        // repartir bloques entre las dos columnas
        const half = Math.ceil(mapped.blocks.length / 2)
        section.columns = [mapped.blocks.slice(0, half), mapped.blocks.slice(half)]
      }
      section.config = {
        background_color: TONE_BG[s.tone],
        padding: 64,
      }
      return section
    }),
  }
  return {
    name: step.name,
    seo_title: step.seo_title,
    seo_description: step.seo_description,
    design,
  }
}

const SYSTEM_PROMPT = `Eres un copywriter y diseñador de landing pages de conversión (frameworks AIDA y PAS).
Diseñas embudos de venta en ESPAÑOL para el negocio que se te describe.
Reglas:
- Paso 1: landing de venta completa (hero con titular potente nivel 1, dolor/beneficios, prueba social si encaja, CTA claro y UN formulario de captura al final).
- Último paso: página de gracias breve (confirma y dice qué pasará ahora).
- Titulares concretos y específicos del negocio (nada genérico tipo "Bienvenido").
- Textos de párrafo de 2-4 frases, directos, hablando al cliente ("tú").
- Usa secciones con tono "oscuro" para el hero o el CTA final si aporta contraste.
- NO inventes testimonios con nombres reales ni cifras imposibles de verificar.`

const WEBSITE_SYSTEM_PROMPT = `Eres un copywriter y diseñador de sitios web corporativos.
Diseñas sitios web en ESPAÑOL para el negocio que se te describe (marca, servicios, confianza).
Reglas:
- Primera página: la HOME (hero con propuesta de valor clara, qué hace el negocio, servicios o beneficios, prueba social si encaja, CTA de contacto con UN formulario al final).
- Añade 1-2 páginas más si aportan (ej. "Servicios", "Contacto" con formulario).
- Titulares concretos y específicos del negocio (nada genérico tipo "Bienvenido").
- Textos de párrafo de 2-4 frases, claros y profesionales, hablando al cliente ("tú").
- Usa secciones con tono "oscuro" para el hero o el CTA final si aporta contraste.
- NO inventes testimonios con nombres reales ni cifras imposibles de verificar.`

async function generatePages(
  system: string,
  prompt: string
): Promise<AiGeneratedStep[]> {
  const openrouter = getOpenRouter()
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { object } = await generateObject({
        model: openrouter(aiModel()),
        schema: aiFunnelSchema,
        system,
        prompt,
      })
      return object.steps.map((s) => mapStep(s, object.button_color))
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof Error ? lastError : new Error('La IA no devolvió un diseño válido')
}

/** Genera los pasos del funnel con IA a partir del brief. Reintenta 1 vez si falla. */
export async function generateFunnelPages(input: {
  funnelName: string
  brief: string
}): Promise<AiGeneratedStep[]> {
  return generatePages(
    SYSTEM_PROMPT,
    `Nombre del embudo: ${input.funnelName}\n\nBrief del negocio:\n${input.brief}\n\nDiseña el embudo completo.`
  )
}

/** Genera las páginas de un SITIO WEB con IA (PRP-014). Mismo esquema, copy de sitio corporativo. */
export async function generateWebsitePages(input: {
  siteName: string
  brief: string
}): Promise<AiGeneratedStep[]> {
  return generatePages(
    WEBSITE_SYSTEM_PROMPT,
    `Nombre del sitio web: ${input.siteName}\n\nBrief del negocio:\n${input.brief}\n\nDiseña el sitio web completo.`
  )
}

/** Reescribe el texto de un bloque (titular o párrafo) manteniendo el contexto del negocio. */
export async function rewriteText(input: {
  current: string
  kind: 'heading' | 'text'
  brief: string | null
}): Promise<string> {
  const openrouter = getOpenRouter()
  const { object } = await generateObject({
    model: openrouter(aiModel()),
    schema: z.object({
      rewritten: z.string().max(2000).describe('El texto reescrito, solo el texto, sin comillas ni HTML'),
    }),
    system:
      'Eres un copywriter de conversión. Reescribe el texto que se te da: más persuasivo, concreto y claro, en español. Mantén la longitud aproximada y la intención.',
    prompt: `${input.brief ? `Contexto del negocio: ${input.brief}\n\n` : ''}Tipo: ${
      input.kind === 'heading' ? 'titular' : 'párrafo'
    }\nTexto actual:\n${input.current}`,
  })
  return object.rewritten
}
