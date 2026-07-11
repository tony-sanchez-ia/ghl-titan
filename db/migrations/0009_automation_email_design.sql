-- PRP-013: emails con diseño en automatizaciones.
-- Snapshot del diseño (formato V2 de marketing) al encolar; se renderiza al enviar.

begin;

alter table scheduled_emails add column design jsonb;

commit;
