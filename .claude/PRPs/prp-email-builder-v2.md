# PRP-008: Editor de emails de marketing V2 (secciones + bloques nuevos + estilos globales)

> **Estado**: COMPLETADO (2026-07-06) — 6 fases implementadas y verificadas E2E: secciones con
> columnas (email real con render híbrido inline-block + media query), 5 bloques nuevos (saneado
> verificado con tests unitarios + XSS bloqueado), estilos globales, /e/[token] personalizado y
> clicks de todos los links nuevos trackeados. Migración V1→V2 sin pérdidas. typecheck + build OK,
> ningún archivo >500 líneas. Datos de prueba limpiados.
> **Fecha**: 2026-07-06
> **Proyecto**: GHL Titan
> **Alcance**: PACK COMPLETO aprobado por Tony (Niveles 1 + 2 + 3)
> **Referencias visuales**: `referencias/email_mkt/bloques1.png` (paleta de elementos GHL) y
> `referencias/email_mkt/bloques2.png` (layouts de columnas GHL)
> **Construye sobre**: PRP-007 (COMPLETADO) — no toca campañas/cola/tracking/baja, solo el diseñador,
> el render y dos añadidos públicos (página "ver en navegador").

---

## Objetivo

Subir el diseñador de emails de PRP-007 al nivel del editor de GoHighLevel: **secciones con columnas**
(layouts 1/2/3/4 y proporciones 1/3:2/3, 2/3:1/3, 1/4:3/4, 3/4:1/4, con fondo y padding propios y
apilado en móvil), **cinco bloques nuevos** (redes sociales, vídeo, formulario, código HTML y texto
con formato inline), **estilos globales** (color de fondo del email + color de botones) y un link
público **"ver este email en el navegador"** — todo compatible con los diseños ya guardados
(migración automática, sin perder nada).

## Por Qué

| Problema | Solución |
|----------|----------|
| El editor V1 solo apila bloques en una columna: no se pueden hacer emails "texto + imagen al lado", cabeceras con logo y menú, ni pies con iconos de redes — el 80% de las newsletters reales | Secciones con columnas tipo GHL: eliges el layout (1, 2, 3, 4 columnas o proporciones), cada columna acepta bloques, y en el móvil las columnas se apilan solas |
| Faltan piezas que cualquier email de marketing lleva: iconos de redes sociales, un vídeo clicable, un botón que lleve a un formulario de captura, o pegar un HTML hecho fuera | 5 bloques nuevos: Redes sociales, Vídeo (miniatura + play → link), Formulario (botón a un form de captura existente), Código HTML y Texto con negrita/cursiva/enlaces (con tracking de clicks) |
| Todos los emails salen con el mismo fondo gris y los botones azules fijos: cero identidad de marca | Estilos globales por email: color de fondo y color de botones, aplicados en el editor y en el envío |
| Si Gmail rompe el email o recorta las imágenes, el contacto no tiene alternativa | Link "ver este email en el navegador": una página pública con la versión exacta y personalizada de su email |

**Valor de negocio**: el diseñador deja de ser "suficiente" y pasa a ser comparable al de GHL
($100/mes): Tony puede montar newsletters con marca propia (columnas, redes, vídeo, colores) sin
herramientas externas, y cada pieza sigue siendo medible (los enlaces nuevos también trackean clicks).

## Qué

### Criterios de Éxito
- [ ] **Secciones y columnas**: se pueden añadir secciones con layout 1 / 2 / 3 / 4 columnas y las variantes 1/3:2/3, 2/3:1/3, 1/4:3/4 y 3/4:1/4 (como `bloques2.png`); cada sección tiene color de fondo y padding propios; se pueden reordenar y borrar secciones; los bloques se añaden/mueven/borran dentro de cada columna.
- [ ] **Móvil**: en la vista previa móvil del editor Y en el email real, las columnas se apilan verticalmente (verificado con la prueba real en Gmail).
- [ ] **Migración automática**: TODAS las campañas y plantillas guardadas con el editor V1 (bloques planos) se abren, se previsualizan y se envían idénticas, convertidas al vuelo a secciones de 1 columna. Cero pérdida de datos, sin migración SQL.
- [ ] **Bloque Redes sociales**: lista de redes (Facebook, Instagram, X, YouTube, LinkedIn, TikTok, WhatsApp) con su URL; se renderizan como iconos clicables (con tracking) alineables.
- [ ] **Bloque Vídeo**: URL del vídeo + miniatura (autodetectada si es YouTube, manual si no) con distintivo de play; el click lleva al vídeo (con tracking).
- [ ] **Bloque Formulario**: selector de un formulario de captura existente (tabla `forms`) → botón que lleva a `/form/[slug]` (con tracking).
- [ ] **Bloque Código HTML**: textarea de HTML que se inserta tal cual en el email, con aviso claro de "para usuarios avanzados".
- [ ] **Texto con formato inline**: en el bloque de texto se puede poner negrita, cursiva y enlaces sin librerías externas; los enlaces del texto se reescriben a `/r/[token]` al enviar (tracking) y siguen validados anti open-redirect.
- [ ] **Estilos globales**: panel con color de fondo del email y color de los botones; se aplican en la vista previa, en la prueba y en el envío real (botón y bloque formulario).
- [ ] **Ver en el navegador**: los emails de campaña llevan el link "Ver este email en el navegador" → página pública con la versión personalizada de ese destinatario (merge tags aplicados y link de baja real).
- [ ] `npm run typecheck` y `npm run build` pasan; ningún archivo supera 500 líneas.

### Comportamiento Esperado

**Happy path (diseñar con columnas):**
1. Tony abre una campaña → el diseñador muestra su email de siempre (aunque fuera de la V1: migrado solo, idéntico).
2. Pulsa "+" → elige "Sección" → layout **2/3 : 1/3**. En la columna ancha añade un bloque de texto, en la estrecha una imagen.
3. Selecciona la sección → cambia su color de fondo y el padding en el panel de ajustes.
4. En el texto, selecciona una frase → pulsa **B** (negrita) y añade un enlace a su página de reservas.
5. Añade una sección de 1 columna al final con el bloque **Redes sociales** (Instagram + YouTube) y otra con el bloque **Vídeo** (pega el link de YouTube: la miniatura aparece sola).
6. Abre **Estilos** → fondo del email crema, botones en su azul de marca. Toda la vista previa se actualiza.
7. Cambia a vista móvil: las dos columnas se ven apiladas. Pulsa "Enviarme una prueba" y en Gmail se ve igual (columnas en escritorio, apilado en el móvil).

**Happy path (enviar y ver en navegador):**
8. Envía la campaña. Cada contacto recibe el email con "Ver este email en el navegador" arriba.
9. Un contacto con imágenes bloqueadas pulsa ese link → página pública con SU email exacto (su nombre en los merge tags, su link de baja). Pulsa un enlace del texto → `/r/[token]` registra el click y le redirige.
10. En Estadísticas, los clicks de enlaces de texto, redes, vídeo y formulario cuentan igual que los de los botones.

---

## Contexto

### Referencias
- `referencias/email_mkt/bloques1.png` — paleta de elementos GHL (referencia de qué bloques y con qué nombres). Se implementan: Redes sociales, Vídeo, Código, Formularios, texto con formato. NO se implementan (fuera de alcance): Carrito, Productos, Carrusel, FAQ, Temporizador, RSS, Enlace a Rewards.
- `referencias/email_mkt/bloques2.png` — layouts de columnas GHL: 1, 2, 3, 4, 1/3:2/3, 2/3:1/3, 1/4:3/4, 3/4:1/4 (el preset "Texto e imagen" queda cubierto por el layout de 2 columnas).
- `src/features/marketing/components/EmailBuilder.tsx` (365 líneas) — editor actual: paleta con "+", selección, flechas, autoguardado con debounce 900ms, vista escritorio/móvil (600/375px). Se conserva el patrón; el lienzo pasa a componente propio.
- `src/features/marketing/components/blocks/BlockPreview.tsx` + `BlockSettings.tsx` — espejo visual de render.ts y panel de ajustes. Se extienden con los bloques nuevos.
- `src/features/marketing/services/render.ts` (130 líneas) — bloques → HTML email-safe (tablas + estilos inline, 600px). `extractDesignUrls()` alimenta `link_urls` (validación anti open-redirect) y `rewriteUrl` el tracking. AMBOS deben aprender a recorrer secciones/columnas y los bloques nuevos.
- `src/features/marketing/services/campaign-engine.ts` — renderiza el diseño por destinatario al enviar (merge + unsubscribe + rewrite). Punto donde se inyecta el link "ver en navegador" (`click_token` del destinatario ya existe y es único).
- `src/actions/marketing.ts` (311 líneas) — Zod de bloques (`blockSchema`/`designSchema`), `normalizeDesign`, snapshot al enviar (`renderEmailHtml` + `extractDesignUrls`), `sendCampaignTest`. Los esquemas cambian al modelo V2.
- `src/app/r/[token]/route.ts` — tracking con anti open-redirect contra `link_urls` del snapshot. NO cambia: basta con que `extractDesignUrls` incluya las URLs nuevas.
- `src/types/database.ts` líneas 234-301 — `EmailBlock/EmailBlockType/EmailBlockConfig`, `EmailCampaign.design`, `EmailTemplate.design`. El tipo del diseño pasa a `EmailDesign` (V2) con normalizador para el legado.
- `src/features/automations/services/queries.ts` + tipo `Form` (database.ts:158) — formularios de captura existentes (`forms`, página pública `/form/[slug]`) para el selector del bloque Formulario.
- `src/proxy.ts` — protección por lista de prefijos. La página pública `/e/[token]` NO se lista (pública a propósito, como `/unsubscribe`).
- `.claude/PRPs/prp-email-marketing.md` — PRP-007: aprendizajes y gotchas vigentes (Neon no Supabase, snapshot al enviar, idempotencia, límites Resend, proxy…).

### Arquitectura Propuesta (Feature-First)

Sin tablas nuevas ni migración SQL: el diseño sigue siendo `jsonb` en `email_campaigns.design` y
`email_templates.design`; solo cambia la FORMA del documento (versionado en el propio JSON).

```
src/features/marketing/
├── components/
│   ├── EmailBuilder.tsx            # se adelgaza: barra superior + asunto + autosave + estado
│   ├── SectionCanvas.tsx           # NUEVO: lienzo de secciones/columnas, inserción y reordenado
│   ├── SectionSettings.tsx         # NUEVO: ajustes de sección (layout, fondo, padding) + estilos globales
│   └── blocks/
│       ├── BlockPreview.tsx        # extendido: social, vídeo, formulario, html, texto con formato
│       ├── BlockSettings.tsx       # extendido (si roza 500 líneas, se parte por tipo de bloque)
│       └── RichTextInput.tsx       # NUEVO: contentEditable con negrita/cursiva/enlace (sin librerías)
├── services/
│   ├── design.ts                   # NUEVO: tipos helper + migrateDesign() V1→V2 + defaults + sanitizado
│   ├── render.ts                   # documento + secciones/columnas + estilos globales + apilado móvil
│   ├── render-blocks.ts            # NUEVO: bloque → HTML (extraído de render.ts por el límite de 500)
│   ├── campaign-engine.ts          # usa migrateDesign() + añade el link "ver en navegador"
│   └── queries.ts                  # + lookup público por click_token para /e/[token]
src/actions/marketing.ts            # Zod V2 (secciones, estilos, bloques nuevos, HTML saneado)
src/app/e/[token]/page.tsx          # NUEVO: página pública "ver este email en el navegador"
public/email/social/*.png           # NUEVO: iconos de redes email-safe (servidos por la propia app)
```

### Modelo de Datos (JSON del diseño, no SQL)

```ts
// V2 — lo que se guarda en email_campaigns.design / email_templates.design
interface EmailDesign {
  version: 2
  styles: {
    background_color: string   // fondo del email (default #f1f5f9, el actual)
    button_color: string       // color de botones y bloque formulario (default #2563eb, el actual)
  }
  sections: EmailSection[]
}

type SectionLayout = '1' | '2' | '3' | '4' | '1/3:2/3' | '2/3:1/3' | '1/4:3/4' | '3/4:1/4'

interface EmailSection {
  id: string
  layout: SectionLayout
  config: { background_color?: string; padding?: number }  // padding vertical en px
  columns: EmailBlock[][]      // un array de bloques por columna (longitud fija según layout)
}

// EmailBlockType gana: 'social' | 'video' | 'form' | 'html'
// EmailBlockConfig gana:
//   html?: string                     // text (formato inline saneado: b/strong/i/em/a/br) y bloque html
//   networks?: { network: SocialNetwork; url: string }[]   // social
//   video_url?: string; thumbnail_url?: string             // video
//   form_id?: string                                       // form (+ label del botón en `label`)
```

**Migración automática (en código, perezosa)**: `migrateDesign(raw)` — si el valor guardado es un
array (V1), devuelve `{ version: 2, styles: defaults, sections: [una sección layout '1' con todos los
bloques en su única columna] }`; el texto plano V1 se conserva tal cual (render legado escape+`<br>`).
Se aplica en TODO punto que lea un diseño (builder, render, engine, snapshot, plantillas). Se
persiste en V2 solo cuando el usuario guarda (autosave); las campañas ya enviadas nunca se
reescriben (su snapshot está congelado y el render al vuelo migra en memoria).

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo FASES. Las subtareas se generan al entrar a cada fase
> con el bucle agéntico (mapear contexto → generar subtareas → ejecutar).

### Fase 1: Modelo de diseño V2 + migración automática (sin cambios visuales)
**Objetivo**: Tipos `EmailDesign/EmailSection` en database.ts, `design.ts` con `migrateDesign()` y defaults, Zod V2 en actions, y TODOS los consumidores (EmailBuilder, render.ts, campaign-engine, plantillas, snapshot) trabajando con el documento V2. El editor renderiza secciones de 1 columna exactamente igual que hoy.
**Validación**: abrir las campañas y plantillas REALES existentes → idénticas en editor y en prueba real; guardar y reabrir; typecheck pasa.

### Fase 2: Secciones y columnas en el editor
**Objetivo**: `SectionCanvas` + `SectionSettings`: añadir sección eligiendo layout (paleta visual como `bloques2.png`), fondo y padding por sección, reordenar/borrar secciones, y añadir/mover/borrar bloques dentro de cada columna (patrón "+" y flechas, sin drag&drop). Vista móvil del editor apila las columnas.
**Validación**: montar en el browser un email con secciones 2/3:1/3 y de 3 columnas, con fondos distintos; recargar sin perder nada; vista móvil apilada.

### Fase 3: Render email-safe de secciones + apilado real en móvil
**Objetivo**: `render.ts`/`render-blocks.ts` generan las secciones como tablas anidadas email-safe (600px, estilos inline) con apilado móvil (técnica híbrida `inline-block` + media query de refuerzo), respetando fondo/padding por sección. `extractDesignUrls` y `rewriteUrl` recorren secciones/columnas. BlockPreview sigue siendo espejo fiel.
**Validación**: prueba real recibida en Gmail: columnas en escritorio, apiladas en el móvil; los links de bloques dentro de columnas trackean como antes.

### Fase 4: Bloques nuevos (redes, vídeo, formulario, HTML, texto con formato)
**Objetivo**: los 5 bloques completos en paleta + ajustes + preview + render: Redes sociales (iconos PNG servidos desde `public/email/social/`, links con tracking), Vídeo (miniatura auto de YouTube o manual + distintivo play → link con tracking), Formulario (selector de `forms` → botón a `/form/[slug]` con tracking y color global), Código HTML (textarea, se inserta tal cual, saneado básico y preview aislada), y `RichTextInput` para negrita/cursiva/enlaces en el bloque de texto (HTML saneado con whitelist en servidor; los `<a>` se reescriben a `/r/[token]` y entran en `link_urls`).
**Validación**: email de prueba real con los 5 bloques → se ve bien en Gmail; click en un enlace del texto y en un icono de red → tracking registrado y redirect correcto.

### Fase 5: Estilos globales + "ver este email en el navegador"
**Objetivo**: panel de Estilos (fondo del email + color de botones) aplicado en preview y render. Página pública `/e/[token]` (token = `click_token` del destinatario) que renderiza SU email personalizado (merge + link de baja real, sin reescritura de tracking o con ella — decidir en fase); `campaign-engine` añade el link "Ver este email en el navegador" arriba del email en envíos de campaña (no en pruebas, que no tienen destinatario).
**Validación**: E2E real — recibir campaña, abrir "ver en navegador" desde otro dispositivo, ver el email personalizado; cambiar estilos globales y ver el efecto en editor + prueba.

### Fase 6: Validación Final
**Objetivo**: Sistema funcionando end-to-end, sin regresiones sobre PRP-007.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright: recorrido E2E (abrir campaña V1 migrada → añadir sección con columnas → bloques nuevos → estilos → prueba → enviar → click en link de texto → ver en navegador → estadísticas cuadran)
- [ ] Campañas/plantillas antiguas intactas; datos de prueba limpiados (preferencia de Tony)
- [ ] Ningún archivo > 500 líneas
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.
> El conocimiento persiste para futuros PRPs. El mismo error NUNCA ocurre dos veces.

### 2026-07-06: toolbars flotantes (absolute) tapan controles en contenedores vacíos
- **Error**: la barra de herramientas de sección (`absolute top-1.5`) interceptaba los clicks de los
  botones "Bloque" de las columnas vacías (la sección vacía es baja y todo queda debajo de la barra).
- **Fix**: barra ESTÁTICA (en flujo, `inline-flex` con margen) que ocupa su propia fila al seleccionar.
  Regla: en canvases editables, los toolbars flotantes solo sobre elementos con altura garantizada.
- **Aplicar en**: futuros editores visuales de la fábrica (workflow builder, page builder).

---

## Gotchas

> Cosas críticas a tener en cuenta ANTES de implementar

- [ ] **Migración perezosa, jamás destructiva**: `migrateDesign()` en TODO punto de lectura (builder, render de prueba, snapshot, engine, crear-desde-plantilla, guardar-como-plantilla). Una campaña `sent` no se reescribe nunca; su render al vuelo migra en memoria. Probar con las campañas reales YA enviadas de Tony.
- [ ] **Columnas email-safe**: nada de flexbox/grid. Técnica híbrida: tablas anidadas + celdas `display:inline-block` con width fijo y `max-width:100%`, reforzada con `@media (max-width:480px)` en `<style>` del head (Gmail lo soporta desde 2016; Outlook desktop ignora el media query pero muestra las columnas de escritorio, que es aceptable). Probar la prueba real en Gmail móvil.
- [ ] **Gmail recorta emails > ~102KB de HTML**: con secciones y bloques nuevos el HTML crece. Mantener el render compacto y conservar el límite de tamaño del JSON (100KB) — subir el límite de bloques con cabeza (p. ej. 20 secciones × bloques por columna), no quitarlo.
- [ ] **Texto con formato sin librerías**: `contentEditable` + `document.execCommand('bold'|'italic'|'createLink')` — deprecado pero universal y sin dependencias (anti-patrón vigente: sin librerías de editor). OBLIGATORIO sanear en servidor con whitelist estricta (`b/strong/i/em/a[href http/https]/br`) antes de guardar: el HTML del usuario jamás se confía. El preview del bloque puede usar `dangerouslySetInnerHTML` SOLO con el HTML ya saneado.
- [ ] **Escape asimétrico texto V1 vs V2**: el texto plano legado se escapa + `\n→<br>` (como hoy); el texto con formato ya ES HTML saneado y NO se re-escapa. Dos rutas claras en render-blocks (config `text` vs `html`), sin mezclarlas.
- [ ] **Merge tags en texto con formato**: `applyMergeTags` se aplica sobre el HTML saneado — los `{{nombre}}` no contienen `<`/`>`, no hay conflicto, pero aplicar merge DESPUÉS de sanear y ANTES de reescribir links.
- [ ] **Tracking de enlaces de texto**: los `<a href>` del HTML saneado deben (1) entrar en `extractDesignUrls` → `link_urls` del snapshot y (2) reescribirse con `rewriteUrl` al enviar. Si no, el anti open-redirect de `/r/[token]` los mandará al primer link del email (bug silencioso).
- [ ] **Bloque Código HTML: links SIN tracking** (decisión): no se reescriben ni se extraen — van directos al destino (sin pasar por `/r/`, no hay riesgo de open redirect). Documentarlo en el panel del bloque ("los enlaces de este bloque no cuentan clicks"). En el lienzo, render aislado (iframe sandbox o contenedor con overflow) para que su CSS no rompa el editor.
- [ ] **Iconos de redes**: PNGs propios en `public/email/social/` referenciados con `NEXT_PUBLIC_SITE_URL` absoluto (los emails necesitan URLs absolutas). En dev LAN funcionan vía `http://192.168.1.20:3000`; en producción exigen el deploy — avisar a Tony de que en emails reales los iconos se verán cuando la app esté publicada.
- [ ] **Miniatura de vídeo**: autodetectar SOLO YouTube (`img.youtube.com/vi/<id>/hqdefault.jpg` a partir de la URL); para Vimeo u otros, campo de miniatura manual. El "play" se resuelve simple y email-safe (badge/imagen bajo o sobre la miniatura sin hacks de posicionamiento frágiles) — decidir en fase probando en Gmail.
- [ ] **Página `/e/[token]`**: pública SIN tocar `src/proxy.ts` (la protección es por lista de prefijos — checklist de PRP-007 solo aplica a rutas de `(main)`). Token = `click_token` (16 bytes hex, no adivinable, mismo modelo de privacidad que `/unsubscribe`). Token inexistente → 404. Muestra datos personales del destinatario: no indexar (`robots` noindex).
- [ ] **Link "ver en navegador" solo en campañas**: `sendCampaignTest` no tiene destinatario/token → la prueba no lleva el link (o lleva un texto desactivado). No inventar tokens para pruebas.
- [ ] **Color global de botones**: sustituye el `#2563eb` hardcodeado en render y BlockPreview; aplica también al botón del bloque Formulario. Defaults = los valores actuales, para que los diseños migrados no cambien de aspecto.
- [ ] **Límite 500 líneas**: EmailBuilder (365) y BlockSettings (169) crecerán — partir DESDE EL PRINCIPIO (SectionCanvas, SectionSettings, render-blocks.ts, RichTextInput), no cuando ya se pasó.
- [ ] **Zod en todo**: sectionSchema (layout enum + columnas con longitud coherente con el layout), colores `#rrggbb` con regex, HTML con límite de tamaño, `networks` con enum de redes y URLs http/https, `form_id` uuid que exista.
- [ ] **Neon, no Supabase**: `query/queryOne` de `src/lib/db.ts`; sin RLS/supabase-js. No hace falta migración SQL en este PRP (todo es jsonb).
- [ ] **Vigentes de PRP-007**: límites de Resend (plan free ~100/día — avisar en lenguaje de negocio), dominio sin verificar (probar E2E con el email del admin), cron pendiente de configurar, `NEXT_PUBLIC_SITE_URL` correcto en LAN, snapshot congelado ANTES de materializar destinatarios.
- [ ] **Tony no es técnico**: nombres de bloques y avisos en lenguaje de negocio ("Redes sociales", "Vídeo", "Formulario", "Código (avanzado)", "Estilos"); la paleta de layouts se muestra visual (cajitas como GHL), no con texto "2/3:1/3" a pelo.

## Anti-Patrones

- NO usar librerías externas de editor ni drag&drop (grapesjs, unlayer, react-email, dnd-kit, tiptap, slate): contentEditable + patrón "+"/flechas existente.
- NO usar flexbox/grid/clases Tailwind en el HTML del email: tablas + estilos inline (+ media query de apilado como único CSS en head).
- NO migración SQL ni tablas nuevas: la V2 vive en el mismo jsonb, versionada en el documento.
- NO romper diseños V1: migración perezosa y sin pérdidas; defaults de estilos = aspecto actual.
- NO subir/almacenar imágenes (sigue sin haber storage): imágenes y miniaturas por URL; los únicos assets propios son los iconos de redes en `public/`.
- NO guardar HTML sin sanear (ni del texto con formato ni renderizar el bloque Código sin aislamiento en el editor).
- NO añadir bloques de GHL fuera del alcance (carrito, productos, carrusel, FAQ, temporizador, RSS).
- NO tocar el motor de automatizaciones ni la cola/estados de campañas de PRP-007: este PRP es editor + render + página pública.
- NO usar `any` (usar `unknown`); Zod en TODO input de usuario.

---

*PRP pendiente aprobación. No se ha modificado código.*
