# BUSINESS_LOGIC.md - GHL Titan

> Generado por Titan Factory | Fecha: 2026-06-12

## 1. Problema de Negocio

**Dolor:** Titanic Factory paga ~$100/mes por GoHighLevel y usa menos del 10% de
la plataforma: contactos capturados vía agendación, un curso online, y una
automatización de email. Todo lo demás (funnels, páginas, telefonía, WhatsApp,
pipeline) está sin uso. Además, GHL no es instanciable a coste cero: cada nuevo
cliente/situación implicaría más coste de suscripción.

**Costo actual:** ~$1.200/año en suscripción infrautilizada, más la fricción de
una interfaz sobrecargada para tareas simples.

## 2. Solución

**Propuesta de valor:** Una plataforma de marketing ligera e instanciable
("GHL Titan") que replica los 4 módulos que realmente se usan — CRM de
contactos, agendación tipo Calendly, cursos online y automatizaciones de
email — desplegable en minutos para cada cliente o situación, con coste de
infraestructura ~$0-25/mes por instancia.

**Modelo de instanciación:** plantilla → un despliegue por cliente
(1 instancia = 1 proyecto Supabase + 1 deploy Vercel + 1 dominio propio).
Aislamiento total entre instancias. Sin multi-tenancy central en V1.

**Flujo principal (Happy Path) — V1, instancia Titanic Factory:**
1. Un prospecto abre la página pública de reservas (ej: `citas.titanicfactory.com/descubrimiento`)
2. Elige fecha/hora entre los huecos libres (horario semanal definido por el admin; las citas existentes bloquean huecos)
3. Rellena el formulario (nombre, apellidos, email, teléfono) y confirma
4. El sistema: crea/actualiza el contacto en el CRM → crea evento en el Google Calendar del admin con Google Meet único → envía email de confirmación con el enlace → programa email recordatorio
5. El admin ve la cita en su agenda y el contacto en el CRM con su timeline de actividad

## 3. Usuario Objetivo

**Rol:**
- **Admin (Tony / dueño de la instancia):** gestiona contactos, configura su
  calendario y disponibilidad, revisa citas. Admin único por instancia en V1.
- **Prospecto (público, sin login):** reserva una cita desde la página pública.

**Contexto:** consultor/agencia de IA que captura leads vía llamadas de
descubrimiento. No técnico: la plataforma debe ser más simple y más bonita que GHL.

## 4. Arquitectura de Datos

**Input:**
- CSV de contactos exportado de GHL (190 contactos: nombre, apellidos, teléfono, email, empresa, fecha alta, tags)
- Formulario público de reserva de cita
- Configuración del calendario (disponibilidad semanal, reglas de reserva)

**Output:**
- Emails transaccionales: confirmación de cita (con enlace Meet) + recordatorio
- Evento en Google Calendar del admin con Google Meet único por cita
- Dashboard admin: contactos, citas próximas, actividad

**Storage (Supabase tables sugeridas):**
- `profiles`: admin de la instancia (vía add-login)
- `contacts`: contactos del CRM (nombre, apellidos, email, teléfono, empresa, tags, fuente, notas)
- `contact_activities`: timeline por contacto (cita creada, formulario enviado, email enviado)
- `calendars`: definición de cada tipo de cita (nombre, slug público, duración, descripción, reglas: aviso mínimo, ventana de días, buffer)
- `calendar_availability`: franjas semanales de disponibilidad por calendario
- `bookings`: citas reservadas (contacto, calendario, fecha/hora, estado, enlace Meet, event_id de Google)
- `google_credentials`: token OAuth del admin para crear eventos con Meet (cifrado)

**Decisiones de producto tomadas (2026-06-12):**
- Disponibilidad: horario fijo semanal definido por admin (sin sync Outlook en V1; fase 2 posible)
- Videollamada: Google Meet único por cita → requiere conectar cuenta Google del admin (OAuth)
- Alcance V1: CRM + Agenda + emails de cita. Automatizaciones (form → secuencia) y estructura de Cursos = fase 2
- Usuarios: admin único por instancia (equipo/roles = futuro)
- Pipeline de ventas (oportunidades): FUERA — estaba sin uso en GHL
- Curso "IA TITANS EXPRESS": estructura del módulo de cursos en fase 2; videos pendientes de localizar (no prioritario)

## 5. KPI de Éxito

**Métrica principal:** poder cancelar la suscripción de GoHighLevel.
Desglose V1:
- Los 190 contactos migrados y consultables en el CRM propio
- Una reserva real completada de punta a punta: página pública → cita con Meet → email de confirmación recibido
- Instancia desplegada en dominio propio de Titanic Factory

## 6. Especificación Técnica (Para el Agente)

### Features a Implementar (Feature-First)
```
src/features/
├── auth/           # Login admin (Supabase, email/password) — skill add-login
├── contacts/       # CRM: lista, ficha con timeline, tags, import CSV de GHL
├── scheduling/     # Calendarios, disponibilidad, página pública de reserva, gestión de citas
├── google-meet/    # OAuth Google + creación de evento con Meet por cita
└── notifications/  # Emails transaccionales de cita (confirmación + recordatorio) — base skill add-emails

# Fase 2 (estructura preparada, no en V1):
# ├── courses/      # Cursos: módulos, lecciones (video/texto/quiz), certificado
# └── automations/  # Formularios públicos + secuencias de email
```

### Stack Confirmado
- **Frontend:** Next.js 16 + React 19 + TypeScript + Tailwind 3.4
- **Backend:** Supabase (Auth + Database + Storage + RLS)
- **Emails:** Resend + React Email (skill add-emails)
- **Integraciones:** Google Calendar API (evento + Meet por cita)
- **Validación:** Zod | **State:** Zustand (si necesario)
- **MCPs:** Next.js DevTools + Playwright + Supabase

### Próximos Pasos
1. [ ] Elegir design system (pendiente: pregunta al usuario)
2. [ ] Setup Supabase de la instancia Titanic Factory (.env.local)
3. [ ] add-login → auth del admin
4. [ ] PRP del módulo `contacts` (CRM + import CSV) → bucle-agentico
5. [ ] PRP del módulo `scheduling` + `google-meet` + emails de cita → bucle-agentico
6. [ ] Testing E2E con Playwright (reserva completa de punta a punta)
7. [ ] Deploy Vercel + dominio
8. [ ] Migrar los 190 contactos reales → cancelar GHL
```
