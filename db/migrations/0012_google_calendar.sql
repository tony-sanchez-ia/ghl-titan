-- PRP-017: Google Calendar + Meet por cita.
-- El evento de Google asociado a cada reserva (null si no había conexión al reservar).
-- La conexión Google reutiliza integration_connections (0007) como fila provider='google'.

begin;

alter table bookings add column google_event_id text;

commit;
