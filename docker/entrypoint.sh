#!/bin/sh
set -e

echo "=== SmartLearn Docker Entrypoint ==="

# Run Prisma migrations (idempotent: creates tables if missing, no-ops if up-to-date)
echo "Running database migrations..."
npx prisma migrate deploy 2>&1 || {
  echo "migrate deploy failed, falling back to db push..."
  npx prisma db push --accept-data-loss 2>&1
}

echo "Database ready."

# Ensure data directory exists (for local disk storage)
mkdir -p /app/data

# Start the application
echo "Starting SmartLearn server..."
exec node server.js
