#!/usr/bin/env bash
# Idempotently set KEY=VALUE in a .env file (create if missing).
set -euo pipefail

ENV_FILE="${1:?env file path required}"
KEY="${2:?key required}"
VALUE="${3-}"

if [[ -z "$VALUE" ]]; then
  echo "skip $KEY (empty value)"
  exit 0
fi

touch "$ENV_FILE"

# Escape for sed replacement
ESCAPED_VALUE=$(printf '%s' "$VALUE" | sed -e 's/[\/&]/\\&/g')

if grep -q "^${KEY}=" "$ENV_FILE"; then
  sed -i "s/^${KEY}=.*/${KEY}=${ESCAPED_VALUE}/" "$ENV_FILE"
else
  printf '%s=%s\n' "$KEY" "$VALUE" >> "$ENV_FILE"
fi

echo "set $KEY in $ENV_FILE"
