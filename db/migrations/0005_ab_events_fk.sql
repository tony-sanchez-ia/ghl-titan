-- PRP-009 Fase 5: al declarar ganadora de un test A/B se borra la variante perdedora.
-- El FK original (on delete cascade) borraría su HISTORIAL de eventos con ella:
-- se cambia a "set null" (los eventos quedan contando a nivel de paso).

alter table funnel_events drop constraint funnel_events_variant_id_fkey;
alter table funnel_events
  add constraint funnel_events_variant_id_fkey
  foreign key (variant_id) references funnel_step_variants(id) on delete set null;
