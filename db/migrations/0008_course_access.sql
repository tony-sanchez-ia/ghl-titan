-- PRP-012: modo de acceso por curso + enlace de acceso personal por alumno.

begin;

-- 'open' = inscripción libre con el enlace público (como hasta ahora)
-- 'invite' = solo alumnos añadidos por el admin
alter table courses add column access_mode text not null default 'open';

-- Enlace de acceso personal: /learn/[slug]/access/[token]
alter table course_enrollments add column access_token text unique;
update course_enrollments
  set access_token = encode(gen_random_bytes(16), 'hex')
  where access_token is null;

commit;
