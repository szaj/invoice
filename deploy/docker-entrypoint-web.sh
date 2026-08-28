#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS_ON_START:-true}" = "true" ]; then
  echo "Running prisma migrate deploy..."
  node ./node_modules/prisma/build/index.js migrate deploy
fi

exec node server.js
