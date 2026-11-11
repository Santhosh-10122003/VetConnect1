#!/bin/sh
# A mounted disk (Render, Fly, a Docker volume) is usually owned by root. Fix that, then run the app as the unprivileged user.
set -e
mkdir -p "${UPLOADS_DIR:-/data/uploads}" /app/logs
chown -R jenni:jenni "${UPLOADS_DIR:-/data/uploads}" /app/logs 2>/dev/null || true
exec su-exec jenni java -XX:MaxRAMPercentage=75 -Djava.security.egd=file:/dev/./urandom -jar /app/app.jar
