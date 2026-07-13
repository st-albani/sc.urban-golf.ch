#!/bin/sh
set -e

# Bringt das DB-Schema beim Container-Start auf den aktuellen Stand und
# startet erst danach die App. baseline-migrations.js stempelt Altbestände
# (Schema kam via init-schema.sql, nicht via node-pg-migrate) idempotent als
# applied, damit 001/002 nicht auf bestehende Objekte neu laufen.
echo "urban-golf backend — applying database migrations..."
node scripts/baseline-migrations.js
node node_modules/node-pg-migrate/bin/node-pg-migrate.js up \
  --migration-file-language sql -m db/migrations

echo "Migrations OK — starting Fastify"
exec node app.js
