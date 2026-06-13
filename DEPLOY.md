# Deploy de GHL Titan en VPS (EasyPanel / Docker)

> Stack: **Next.js 16 + Supabase** (Postgres gestionado en la nube). NO usa Prisma/SQLite ni NextAuth,
> así que NO hace falta volumen de datos ni `prisma migrate` ni `AUTH_SECRET`. La base de datos ya
> vive en Supabase (cloud); el contenedor solo sirve la app.

## Lo que ya está preparado (en el repo)
- `next.config.ts` → `output: 'standalone'`
- `Dockerfile` (multi-stage, build standalone → `node server.js`)
- `.dockerignore`

## ⚠️ Gotcha crítico: las variables `NEXT_PUBLIC_*` se incrustan en el BUILD
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `NEXT_PUBLIC_SITE_URL` se
"hornean" en el JavaScript durante `npm run build`, NO se leen en runtime. Por eso el Dockerfile
las recibe como **build args**. En EasyPanel hay que pasarlas como *Build Arguments* además de
como variables de entorno (las de runtime que NO son public sí se leen al arrancar).

## Pasos en EasyPanel

1. **Pre-requisito**: el proyecto debe estar en un repo Git (GitHub/GitLab). Hoy NO es repo git
   (`git init` + push pendiente). EasyPanel también permite subir por otros medios, pero GitHub es lo cómodo.
2. **New Project** → nombre (p.ej. `ghl-titan`).
3. **Add Service → App** → Source: GitHub → selecciona el repo → branch `main`.
4. **Build method: Dockerfile** | Path: `/Dockerfile`.
5. **Domains** → añade tu dominio/subdominio → activa HTTPS (SSL automático vía Traefik).
   - Registro DNS: un `A` apuntando a la IP del VPS (o CNAME si usas subdominio).
6. **Build Arguments** (necesarias en build por ser NEXT_PUBLIC):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://jrojsliuubvsjxkkzrxq.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   NEXT_PUBLIC_SITE_URL=https://tu-dominio.com
   ```
7. **Environment** (runtime — solo servidor, NO public):
   ```
   SUPABASE_SERVICE_ROLE_KEY=<service role key>
   RESEND_API_KEY=<tu key de resend>
   EMAIL_FROM=GHL Titan <no-reply@tu-dominio.com>   # tras verificar dominio en Resend
   EMAIL_ADMIN=titanicfactorymedia@gmail.com
   CRON_SECRET=<un token largo y secreto>
   NODE_ENV=production
   ```
   (No hace falta `DATABASE_URL` en producción: la app habla con Supabase por su API, no por pg directo.
   `DATABASE_URL` solo lo usan los scripts locales de migración/import.)
8. **Deploy**.

## Tras el deploy
- **Supabase → Authentication → URL Configuration**: añade `https://tu-dominio.com` como Site URL
  y `https://tu-dominio.com/**` en Redirect URLs.
- **Cron de automatizaciones**: configura un cron que llame cada X minutos a
  `https://tu-dominio.com/api/cron/process-emails?token=<CRON_SECRET>`
  (EasyPanel tiene cron jobs, o usa cron-job.org / n8n).
- **Resend**: verifica tu dominio en resend.com/domains y cambia `EMAIL_FROM` a una dirección
  de ese dominio → se activan los emails a clientes (citas + secuencias).

## Redeploy
Push a Git → **Redeploy** en EasyPanel.

## Migraciones de BD
Las tablas ya están en Supabase (cloud). Si en el futuro añades migraciones nuevas
(`supabase/migrations/000X_*.sql`), aplícalas con `node scripts/run-sql.js <archivo>` desde tu
máquina (apunta a la misma Supabase de producción) — no van dentro del contenedor.
