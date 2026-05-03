#!/bin/bash
set -euo pipefail

# Only run in remote (web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Install npm dependencies (uses cache on subsequent runs)
if [ -f package.json ]; then
  npm install --prefer-offline --no-audit --no-fund 2>&1
fi

# Generate Prisma client if schema exists
if [ -f prisma/schema.prisma ]; then
  npx prisma generate 2>&1
fi
