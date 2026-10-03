#!/bin/sh
# Container entrypoint: resolve the database URL, sync the schema, start the bot.
set -e

# Railway/Heroku-style fallbacks when DATABASE_URL itself is missing or empty.
if [ -z "$DATABASE_URL" ]; then
  for v in DATABASE_PRIVATE_URL DATABASE_PUBLIC_URL POSTGRES_URL POSTGRESQL_URL; do
    eval "val=\${$v:-}"
    if [ -n "$val" ]; then export DATABASE_URL="$val"; echo "[start] DATABASE_URL taken from $v"; break; fi
  done
fi
if [ -z "$DATABASE_URL" ] && [ -n "$PGHOST" ] && [ -n "$PGUSER" ]; then
  export DATABASE_URL="postgresql://$PGUSER:$PGPASSWORD@$PGHOST:${PGPORT:-5432}/${PGDATABASE:-postgres}"
  echo "[start] DATABASE_URL built from PG* variables"
fi

if [ -z "$DATABASE_URL" ]; then
  echo "[start] ERROR: DATABASE_URL is not set in this service."
  echo "[start] Variables this container received (names only):"
  env | cut -d= -f1 | grep -v -E '^(PATH|HOME|HOSTNAME|PWD|SHLVL|NODE_VERSION|YARN_VERSION|_)$' | sort | sed 's/^/  - /'
  echo "[start] Fix: Railway -> bot service -> Variables -> DATABASE_URL = \${{Postgres.DATABASE_URL}} -> Deploy"
  sleep 60
  exit 1
fi
case "$DATABASE_URL" in
  *localhost*|*127.0.0.1*) echo "[start] WARNING: DATABASE_URL points to localhost; on Railway use the Postgres service URL." ;;
esac
for v in BOT_TOKEN ANTHROPIC_API_KEY; do
  eval "val=\${$v:-}"
  if [ -n "$val" ]; then echo "[start] $v: set"; else echo "[start] $v: MISSING"; fi
done

npx prisma db push --skip-generate
exec node dist/index.js
