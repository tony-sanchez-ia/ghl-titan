#!/bin/sh
# EasyPanel no ofrece cron jobs para servicios App (su guía sugiere montarlo en el
# Dockerfile): bucle interno que dispara el procesador de automatizaciones cada 5 min.
# Corre como usuario no-root, por eso un bucle sh y no crond (que requiere root).
(
  while :; do
    sleep 300
    wget -qO- "http://localhost:3000/api/cron/process-emails?token=${CRON_SECRET}" >/dev/null 2>&1
  done
) &

exec node server.js
