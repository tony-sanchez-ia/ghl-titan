#!/bin/sh
# EasyPanel no ofrece cron jobs para servicios App (su guía sugiere montarlo en el
# Dockerfile): bucle interno que dispara el procesador de automatizaciones cada 5 min.
# Corre como usuario no-root, por eso un bucle sh y no crond (que requiere root).
# Docker inyecta HOSTNAME (id del contenedor) pisando el ENV del Dockerfile, y
# Next standalone se bindea a ese hostname: localhost puede NO estar escuchando.
# Llamamos al mismo host al que se bindea la app.
CRON_HOST="${HOSTNAME:-localhost}"
(
  while :; do
    sleep 300
    wget -qO- "http://${CRON_HOST}:${PORT:-3000}/api/cron/process-emails?token=${CRON_SECRET}" >/dev/null 2>&1 \
      || echo "[cron] fallo llamando al procesador (host ${CRON_HOST})"
  done
) &

exec node server.js
