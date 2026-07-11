# PRP-014: Sitios web multidominio tipo GHL

> **Estado**: COMPLETADO (2026-07-11). E2E 15/15: crear sitio, añadir página, editor con
> autosave, publicar, /w/[slug] + /w/[slug]/[pagina], scripts head/body ejecutándose,
> favicon, formulario embebido crea contacto, y multidominio vía Host header → /sites.
> tsc + build limpios. Datos de prueba limpiados. DEPLOY.md ampliado al runbook de sitios.

## Objetivo
Sección **Web → Sitios web**: sitios con varias páginas (Inicio, Contacto, Gracias…)
editadas con el MISMO editor visual de páginas de los embudos, publicados en dominio
propio (mismo mecanismo Host-rewrite → /sites/[host] que los funnels, EasyPanel/Traefik
en el VPS), con favicon y scripts de seguimiento (GA/Pixel) por sitio. Casos de Tony:
web de la agencia Titanic Factory, web de la división de IA, webs temporales de producto.

## Contexto real mapeado
- Editor de páginas de funnels: PageBuilder (shell) + PageCanvas + PageBlockSettings +
  page-render.tsx (PageView compartido editor↔público). Sanitizado server-side al guardar.
- Multidominio: proxy.ts isMainHost + rewrite → /sites/[host]; funnel_domains.hostname unique;
  RESERVED_SEGMENTS para paths en dominio propio; runbook DNS+EasyPanel en DEPLOY.md.
- IA: ai-generate.ts (generateObject + schema de pasos; prompt orientado a funnels).
- Forms embebidos: EmbeddedFunnelForm exige stepId/variantId (tracking de funnel).

## Decisiones
1. Tablas nuevas (migración 0010): websites (name, slug, brief, favicon_url, head_scripts,
   body_scripts, status), website_pages (slug único por sitio, is_home, seo, design jsonb,
   position), website_domains (hostname unique). Un dominio no puede estar a la vez en
   funnel_domains y website_domains (check cruzado en las actions de ambos).
2. REUTILIZAR page-render/PageCanvas/PageBlockSettings tal cual; nuevo WebsitePageBuilder
   (shell sin A/B, guarda en website_pages). PageBlockSettings pasa de `funnelId` a un
   callback `onRewrite` (inversión limpia: cada builder enchufa su action de IA).
3. Forms en sitios web: PageTrackContext.stepId/variantId pasan a nullable;
   EmbeddedFunnelForm omite el tracking de funnel cuando faltan (el contacto + las
   automatizaciones SÍ se crean igual). Sin analytics propios de sitio en V1: los cubre
   el usuario con sus scripts (GA/Pixel) — decisión de alcance.
4. IA: generateWebsitePages en ai-generate.ts (mismo schema/mapeo, system prompt de
   sitio web corporativo en vez de embudo de venta) + rewriteWebsiteBlockText (brief del sitio).
5. Rutas: /websites (panel, protegida → añadir a proxy), /w/[site]/[[...page]] (vista
   pública en dominio principal, solo publicados), /sites/[host] extendido: primero
   funnel por hostname, si no sitio web (path '' = home, '/slug' = página).
6. Scripts de seguimiento: se inyectan en el HTML SSR de las páginas públicas
   (head_scripts + body_scripts, RSC → se ejecutan en el primer parse). Favicon vía
   generateMetadata icons.

## Validación
tsc + build + E2E browser: crear sitio (sin IA — no hay key), añadir páginas, editar,
publicar, /w/slug y /w/slug/pagina sirven, dominio simulado via Host header → /sites,
formulario embebido crea contacto, scripts presentes en el HTML. Datos de prueba limpiados.

## Aprendizajes
*(se rellena durante la implementación)*
