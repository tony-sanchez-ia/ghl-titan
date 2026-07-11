import { query, queryOne } from '@/lib/db'

/**
 * Medición de formularios, independiente del funnel (los forms se incrustan en
 * cualquier web y no dependen de la cookie `tv_id` del proxy). El `visitorId`
 * lo genera el cliente (localStorage) y viaja con cada vista/envío.
 */

/** Registra una vista. Dedupe: 1 por visitante+form+día (no inflar con recargas). */
export async function recordFormView(formId: string, visitorId: string): Promise<void> {
  await query(
    `insert into form_events (form_id, visitor_id, type)
     select $1, $2, 'view'
     where not exists (
       select 1 from form_events
       where form_id = $1 and visitor_id = $2 and type = 'view'
         and created_at >= current_date
     )`,
    [formId, visitorId]
  )
}

export interface FormStats {
  views: number // visitantes únicos
  submissions: number // envíos totales
}

/** Vistas únicas y envíos de un formulario, opcionalmente en los últimos N días. */
export async function getFormStats(formId: string, days: number | null = null): Promise<FormStats> {
  const row = await queryOne<FormStats>(
    `select
       (select count(distinct visitor_id)::int from form_events
        where form_id = $1 and type = 'view'
          and ($2::int is null or created_at >= now() - make_interval(days => $2::int))) as views,
       (select count(*)::int from form_submissions
        where form_id = $1
          and ($2::int is null or created_at >= now() - make_interval(days => $2::int))) as submissions`,
    [formId, days]
  )
  return row ?? { views: 0, submissions: 0 }
}
