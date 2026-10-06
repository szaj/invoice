#!/bin/sh
set -eu

cd /app

if [ "${RUN_MIGRATIONS_ON_START:-true}" = "true" ]; then
  if [ -z "${DIRECT_URL:-}" ] && [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: set DIRECT_URL or DATABASE_URL in deploy/plesk/env" >&2
    exit 1
  fi
  echo "Running prisma migrate deploy..."
  # prisma.config.ts resolves `prisma/config` from /app; CLI lives under /opt/prisma-cli.
  NODE_PATH="/opt/prisma-cli/node_modules${NODE_PATH:+:$NODE_PATH}"
  export NODE_PATH
  node /opt/prisma-cli/node_modules/prisma/build/index.js migrate deploy
fi

if [ ! -f ./server.js ]; then
  echo "ERROR: server.js missing in /app (standalone output incomplete)" >&2
  ls -la >&2
  exit 1
fi

echo "Starting Next.js server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec node server.js
