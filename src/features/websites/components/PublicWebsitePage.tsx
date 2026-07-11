import { PageView } from '@/features/funnels/components/page-render'
import { migratePageDesign } from '@/features/funnels/services/design'
import type { Website, WebsitePage } from '@/types/database'

/**
 * Render público de una página de sitio web (RSC). Reutiliza el PageView de
 * funnels con track de sitio (stepId/variantId null → sin métricas de funnel;
 * los formularios embebidos SÍ crean contacto + automatizaciones).
 *
 * Los scripts de seguimiento del sitio (GA/Pixel) se inyectan en el HTML SSR:
 * al venir en el documento inicial, el navegador los ejecuta en el parseo.
 */
export function PublicWebsitePage({ website, page }: { website: Website; page: WebsitePage }) {
  return (
    <>
      {website.head_scripts && (
        <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: website.head_scripts }} />
      )}
      <PageView
        design={migratePageDesign(page.design)}
        mode="public"
        track={{ stepId: null, variantId: null, nextUrl: null }}
      />
      {website.body_scripts && (
        <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: website.body_scripts }} />
      )}
    </>
  )
}
