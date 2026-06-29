#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENWA_DIR="$ROOT/.openwa/OpenWA"
ENV_FILE="$ROOT/.env"
OPENWA_REPO="https://github.com/rmyndharis/OpenWA.git"
OPENWA_BASE_URL="http://localhost:2785"
OPENWA_SESSION_NAME="${OPENWA_SESSION_NAME:-cloud-core-studio}"
OPENWA_ENGINE_TYPE="${OPENWA_ENGINE_TYPE:-baileys}"
OPENWA_API_KEY_FILE="$OPENWA_DIR/data/.api-key"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run OpenWA locally."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose is required. Install Docker Desktop, then try again."
  exit 1
fi

mkdir -p "$ROOT/.openwa"

if [ ! -d "$OPENWA_DIR/.git" ]; then
  git clone "$OPENWA_REPO" "$OPENWA_DIR"
else
  git -C "$OPENWA_DIR" pull --ff-only
fi

perl -0pi -e "s/- ENGINE_TYPE=.*/- ENGINE_TYPE=$OPENWA_ENGINE_TYPE/" "$OPENWA_DIR/docker-compose.dev.yml"
if ! grep -q "BAILEYS_AUTH_DIR" "$OPENWA_DIR/docker-compose.dev.yml"; then
  perl -0pi -e 's/(- ENGINE_TYPE=.*\n)/$1      - BAILEYS_AUTH_DIR=\/app\/data\/baileys\n      - BAILEYS_SYNC_FULL_HISTORY=false\n/' "$OPENWA_DIR/docker-compose.dev.yml"
fi

cat > "$OPENWA_DIR/.env" <<EOF
NODE_ENV=development
BIND_HOST=127.0.0.1
ENGINE_TYPE=$OPENWA_ENGINE_TYPE
DATABASE_TYPE=sqlite
DATABASE_SYNCHRONIZE=true
STORAGE_TYPE=local
QUEUE_ENABLED=false
ALLOW_DEV_API_KEY=true
ENABLE_SWAGGER=true
BAILEYS_AUTH_DIR=./data/baileys
BAILEYS_SYNC_FULL_HISTORY=false
WWEBJS_WEB_VERSION=${WWEBJS_WEB_VERSION:-2.3000.1040641150-alpha}
WWEBJS_AUTH_TIMEOUT_MS=${WWEBJS_AUTH_TIMEOUT_MS:-120000}
EOF

OPENWA_MEM_LIMIT="${OPENWA_MEM_LIMIT:-2147483648}" \
  docker compose -f "$OPENWA_DIR/docker-compose.dev.yml" --env-file "$OPENWA_DIR/.env" up -d

OPENWA_API_KEY="${OPENWA_API_KEY:-}"
for _ in {1..30}; do
  if [ -n "$OPENWA_API_KEY" ]; then
    break
  fi

  if [ -s "$OPENWA_API_KEY_FILE" ]; then
    OPENWA_API_KEY="$(tr -d '\r\n' < "$OPENWA_API_KEY_FILE")"
    break
  fi

  sleep 1
done

if [ -z "$OPENWA_API_KEY" ]; then
  echo "OpenWA started, but no API key was found at $OPENWA_API_KEY_FILE."
  echo "Open $OPENWA_BASE_URL, create an API key, then set OPENWA_API_KEY in $ENV_FILE."
  exit 1
fi

OPENWA_READY=false
for _ in {1..60}; do
  if curl -fsS "$OPENWA_BASE_URL/api/health/ready" >/dev/null 2>&1; then
    OPENWA_READY=true
    break
  fi

  sleep 1
done

if [ "$OPENWA_READY" != true ]; then
  echo "OpenWA container started, but the API did not become ready at $OPENWA_BASE_URL."
  echo "Run: bun run openwa:logs"
  exit 1
fi

SESSION_JSON="$(
  OPENWA_BASE_URL="$OPENWA_BASE_URL" \
    OPENWA_API_KEY="$OPENWA_API_KEY" \
    OPENWA_SESSION_NAME="$OPENWA_SESSION_NAME" \
    node <<'NODE'
(async () => {
  const baseUrl = process.env.OPENWA_BASE_URL;
  const apiKey = process.env.OPENWA_API_KEY;
  const sessionName = process.env.OPENWA_SESSION_NAME;
  const headers = {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
  };

  const request = async (path, init = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers || {}) },
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(`${response.status} ${text}`);
    }
    return body;
  };

  const sessions = await request("/api/sessions");
  let session = sessions.find((item) => item.name === sessionName);

  if (!session) {
    session = await request("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        name: sessionName,
        config: { autoReconnect: true },
      }),
    });
  }

  if (["created", "disconnected", "failed"].includes(session.status)) {
    session = await request(`/api/sessions/${encodeURIComponent(session.id)}/start`, {
      method: "POST",
    });
  }

  process.stdout.write(JSON.stringify({
    id: session.id,
    name: session.name,
    status: session.status,
  }));
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
NODE
)"

OPENWA_SESSION_ID="$(node -e 'console.log(JSON.parse(process.argv[1]).id)' "$SESSION_JSON")"
OPENWA_SESSION_STATUS="$(node -e 'console.log(JSON.parse(process.argv[1]).status)' "$SESSION_JSON")"

upsert_env() {
  local key="$1"
  local value="$2"
  touch "$ENV_FILE"
  if grep -q "^${key}=" "$ENV_FILE"; then
    perl -0pi -e "s|^${key}=.*$|${key}=\"${value}\"|m" "$ENV_FILE"
  else
    printf '%s="%s"\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

upsert_env "OPENWA_BASE_URL" "$OPENWA_BASE_URL"
upsert_env "OPENWA_API_KEY" "$OPENWA_API_KEY"
upsert_env "OPENWA_SESSION_ID" "$OPENWA_SESSION_ID"

mask_key() {
  local key="$1"
  if [ "${#key}" -le 12 ]; then
    printf 'configured'
    return
  fi

  printf '%s...%s' "${key:0:8}" "${key: -4}"
}

echo
echo "OpenWA is starting."
echo "Dashboard: $OPENWA_BASE_URL"
echo "Swagger:   $OPENWA_BASE_URL/api/docs"
echo
echo "Your app .env now points to:"
echo "OPENWA_BASE_URL=$OPENWA_BASE_URL"
echo "OPENWA_API_KEY=$(mask_key "$OPENWA_API_KEY")"
echo "OPENWA_SESSION_ID=$OPENWA_SESSION_ID"
echo "OPENWA_SESSION_NAME=$OPENWA_SESSION_NAME"
echo "OPENWA_SESSION_STATUS=$OPENWA_SESSION_STATUS"
echo "OPENWA_ENGINE_TYPE=$OPENWA_ENGINE_TYPE"
if [ "$OPENWA_ENGINE_TYPE" = "whatsapp-web.js" ]; then
  echo "WWEBJS_WEB_VERSION=${WWEBJS_WEB_VERSION:-2.3000.1040641150-alpha}"
fi
echo
echo "Next steps:"
echo "1. Open $OPENWA_BASE_URL"
echo "2. Open Sessions and scan the QR code for: $OPENWA_SESSION_NAME"
echo "3. If the QR is not visible, use: $OPENWA_BASE_URL/api/sessions/$OPENWA_SESSION_ID/qr"
echo "4. Restart your app with: bun run dev"
