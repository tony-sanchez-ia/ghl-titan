# PRP-012: Cursos — publicación visible + alumnos invitados

> **Estado**: COMPLETADO (2026-07-11). E2E 11/11: banner borrador, publicar, alta de alumno,
> enlace personal entra directo, modo invitados bloquea el form. Datos de prueba limpiados.
> El "Curso de Piano" de Tony quedó PUBLICADO (era la causa de su 404) con acceso libre.
> OJO: sus 2 lecciones siguen SIN publicar (checkbox por lección) — avisado en el reporte.
> **Origen**: Tony creó "Curso de Piano", /learn/piano-course daba 404 (estaba en Borrador)
> y no sabía cómo autorizar a un alumno concreto.

## Objetivo
1. Que sea evidente cuándo un curso NO es visible (Borrador) y cómo publicarlo.
2. Gestión de alumnos por curso: añadir por email → enlace de acceso personal,
   ver progreso, quitar acceso.
3. Modo de acceso por curso (decisión Tony): 'open' (inscripción libre, como hoy)
   o 'invite' (solo invitados: el formulario público de inscripción se bloquea).

## Contexto real mapeado
- Flujo actual: cookie httpOnly `course_email_{courseId}` (email, 1 año) + enrollStudent
  (self-service, solo cursos published, crea contacto+enrollment).
- `course_enrollments`: unique (course_id, email); progress cascade on delete.
- CourseHeaderActions ya tiene Publicar + chip de estado, pero sin aviso de consecuencias.
- **BUG encontrado**: "Copiar enlace" usa navigator.clipboard directo → roto en LAN http
  (gotcha 2026-07-06). Fix: helper copyText con fallback execCommand.

## Cambios
- Migración 0008: `courses.access_mode` ('open' default) + `course_enrollments.access_token`
  unique (backfill con gen_random_bytes hex — pgcrypto ya activo).
- Ruta pública GET /learn/[slug]/access/[token]: valida token → set cookie → redirect
  al curso. El enlace personal funciona en modo open e invite.
- Actions: addStudent (contacto+enrollment+token, igual que enrollStudent pero admin),
  removeStudent, enrollStudent bloquea si access_mode='invite' y genera token.
- UI: banner de aviso en editor si Borrador; Publicar como botón primario en Borrador;
  card "Alumnos" bajo el editor (lista con progreso X/Y, copiar enlace personal,
  eliminar; form añadir por nombre+email); CourseForm con selector de acceso;
  EnrollGate muestra "solo por invitación" si invite.
- shared/lib/clipboard.ts: copyText con fallback para contextos no seguros (LAN).

## Validación
- tsc + build; E2E browser: publicar curso, alumno invitado entra por enlace personal,
  modo invite bloquea el form público, progreso visible en la card Alumnos.

## Aprendizajes
*(se rellena durante la implementación)*
