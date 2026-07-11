# Deploy de GHL Titan en VPS (EasyPanel / Docker)

> Stack: **Next.js 16 + Neon** (Postgres gestionado en la nube, conexión directa con `pg`).
> Auth propia (cookie de sesión firmada con `AUTH_SECRET` + bcrypt). NO usa Prisma/SQLite,
> así que NO hace falta volumen de datos ni `prisma migrate`. La base de datos vive en Neon;
> el contenedor solo sirve la app.

## Lo que ya está preparado (en el repo)
- `next.config.ts` → `output: 'standalone'`
- `Dockerfile` (multi-stage, build standalone → `node server.js`)
- `.dockerignore`

## ⚠️ Gotcha crítico: las variables `NEXT_PUBLIC_*` se incrustan en el BUILD
`NEXT_PUBLIC_SITE_URL` se "hornea" en el JavaScript durante `npm run build`, NO se lee en
runtime. Por eso el Dockerfile la recibe como **build arg**. En EasyPanel hay que pasarla como
*Build Argument* además de como variable de entorno (las de runtime que NO son public sí se
leen al arrancar).

## Pasos en EasyPanel

1. **Pre-requisito**: el proyecto debe estar en un repo Git (GitHub/GitLab).
2. **New Project** → nombre (p.ej. `ghl-titan`).
3. **Add Service → App** → Source: GitHub → selecciona el repo → branch `main`.
4. **Build method: Dockerfile** | Path: `/Dockerfile`.
5. **Domains** → añade tu dominio/subdominio → activa HTTPS (SSL automático vía Traefik).
   - Registro DNS: un `A` apuntando a la IP del VPS (o CNAME si usas subdominio).
6. **Build Arguments** (necesarias en build por ser NEXT_PUBLIC):
   ```
   NEXT_PUBLIC_SITE_URL=https://tu-dominio.com
   ```
7. **Environment** (runtime — solo servidor, NO public):
   ```
   DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require
   AUTH_SECRET=<64 hex chars — genera con: openssl rand -hex 32>
   RESEND_API_KEY=<tu key de resend>
   EMAIL_FROM=GHL Titan <no-reply@tu-dominio.com>   # tras verificar dominio en Resend
   EMAIL_ADMIN=titanicfactorymedia@gmail.com
   CRON_SECRET=<un token largo y secreto>
   NODE_ENV=production
   ```
   (Usa el **pooler host** de Neon en `DATABASE_URL` si esperas muchas conexiones; para una
   instancia única el host directo va bien.)
8. **Deploy**.

## Tras el deploy
- **Cron de automatizaciones**: configura un cron que llame cada X minutos a
  `https://tu-dominio.com/api/cron/process-emails?token=<CRON_SECRET>`
  (EasyPanel tiene cron jobs, o usa cron-job.org / n8n).
- **Resend**: verifica tu dominio en resend.com/domains y cambia `EMAIL_FROM` a una dirección
  de ese dominio → se activan los emails a clientes (citas + secuencias).

## Redeploy
Push a Git → **Redeploy** en EasyPanel.

## Migraciones de BD
Las tablas ya están en Neon (`db/migrations/0001_init.sql` aplicada). Si en el futuro añades
migraciones nuevas (`db/migrations/000X_*.sql`), aplícalas con `node scripts/run-sql.js <archivo>`
desde tu máquina (apunta a la misma Neon de producción) — no van dentro del contenedor.

## Crear/resetear el admin
`node scripts/create-admin.js <email> <password>` (upsert por email). El registro público en
`/signup` solo funciona mientras no exista ningún usuario (primera puesta en marcha).

## Multidominio: dominios para funnels (PRP-009) y sitios web (PRP-014)

GHL Titan sirve cada embudo O sitio web desde su propio dominio apoyándose en el sistema
de dominios de EasyPanel (Traefik emite el SSL de forma automática). Runbook por dominio:

1. **DNS** (proveedor del dominio): registro `A` del dominio (p. ej.
   `ofertatrading.com`, o un subdominio con `CNAME`) apuntando a la **IP del VPS**.
2. **EasyPanel**: servicio de GHL Titan → **Domains** → *Add Domain* → escribir el dominio
   (HTTPS activado). Traefik pide el certificado Let's Encrypt solo.
   - ⚠️ Si el DNS aún no ha propagado, la emisión del certificado falla: espera unos minutos
     y vuelve a intentarlo (EasyPanel reintenta al re-guardar el dominio).
3. **Titan**: panel → **Embudos** → (tu embudo) → *Dominios propios*, o bien
   **Sitios web** → (tu sitio) → *Dominio propio* → añadir el mismo dominio.

Con eso, `https://el-dominio/` sirve el primer paso del embudo (o la página de inicio del
sitio web) y `https://el-dominio/<slug>` cada paso/página. El panel sigue viviendo SOLO en
el dominio principal (`NEXT_PUBLIC_SITE_URL`). No hay límite de dominios: repite el runbook.

- Cómo funciona por dentro: `src/proxy.ts` detecta el header `Host`; si no es el dominio
  principal (ni localhost/IP) reescribe internamente a `/sites/<host>/...`, que busca el
  dominio primero en `funnel_domains` y después en `website_domains`. Dominio no
  registrado → 404. Un dominio no puede apuntar a la vez a un embudo y a un sitio.
- ⚠️ `NEXT_PUBLIC_SITE_URL` debe ser el dominio del PANEL. Las URLs públicas de los funnels
  en dominios de cliente se generan relativas al propio dominio (nunca desde esa variable).
- Prueba sin DNS (desde tu máquina): `curl -H "Host: dominio-del-cliente" https://IP-del-VPS/`
  o añade el dominio a tu `/etc/hosts`.
