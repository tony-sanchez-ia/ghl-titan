# PRP-013: Emails con diseño en las automatizaciones

> **Estado**: COMPLETADO (2026-07-11). E2E 12/12: toggle en el nodo, diseñador con autosave
> al config, snapshot al encolar, render V2 al enviar (fallo solo por Resend sin dominio =
> esperado), /r valida contra las URLs del diseño (anti open-redirect) y registra el click.
> Datos de prueba limpiados; nodo demo restaurado a modo simple.

## Objetivo
El paso "Enviar email" del builder de automatizaciones puede enviar emails con el
diseñador visual de Marketing (PRP-008: secciones/columnas/bloques/estilos), partiendo
opcionalmente de una Plantilla. El modo "Sencillo" (texto) se mantiene.

## Decisiones
- Se reutiliza el diseñador de MARKETING (no el de funnels): genera HTML compatible con
  clientes de correo (tablas+inline). Piezas reutilizadas: SectionCanvas, BlockSettings,
  SectionSettings, migrateDesign, renderEmailHtml.
- `automation_nodes.config` gana `email_mode` ('simple'|'designed') y `design` (jsonb V2,
  mismo formato que campañas/plantillas).
- **Snapshot del diseño al encolar**: scheduled_emails gana columna `design jsonb`
  (migración 0009). Se renderiza al ENVIAR con renderEmailHtml + rewriteUrl → /r/[token].
  Anti open-redirect: /r valida contra extractDesignUrls(design) si hay diseño, si no
  contra extractUrls(body) como antes.
- Los emails de automatización ahora RESPETAN la baja RGPD: contacto con unsubscribed_at
  → el email se marca failed 'Contacto dado de baja' sin enviarse (ambos modos). El email
  diseñado incluye el pie con link de baja real (unsubscribe_token del contacto).
- Merge tags {{nombre}} {{apellido}} {{email}} funcionan en asunto y diseño (como campañas).
- Página del diseñador: /automations/[id]/email/[nodeId] (protegida) con autosave por
  debounce vía updateNode, selector "Cargar plantilla" (email_templates) y volver al builder.

## Validación
tsc + build + E2E browser: crear paso diseñado, guardar, encolar (form de prueba),
verificar html renderizado con links /r/ y respeto de baja. Datos de prueba limpiados.

## Aprendizajes

### 2026-07-11: El form demo tiene consentimiento OBLIGATORIO
- **Error**: el E2E enviaba el form público sin marcar el checkbox de consentimiento
  (añadido por PRP-011) → la validación bloqueaba el submit y el trigger nunca disparaba.
- **Fix**: consultar el schema jsonb del form (campos required) ANTES de automatizar submits.
- **Aplicar en**: cualquier test E2E de formularios del Form Builder.

### 2026-07-11: pkill -f "next-server" mata TODOS los Next de la máquina
- **Error**: al parar el server de validación (:3111), el pkill tumbó también el server
  del puerto 3000 (el de pruebas de Tony) — máquina compartida.
- **Fix**: matar SIEMPRE por PID (ss -tlnp para localizarlo) o por patrón con el puerto.
- **Aplicar en**: toda limpieza de procesos en esta máquina.
