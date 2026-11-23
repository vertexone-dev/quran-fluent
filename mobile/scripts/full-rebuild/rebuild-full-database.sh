#!/usr/bin/env bash
# Rebuild the full Quran content database in a DISPOSABLE local Postgres (QR-DESIGN-007E).
#
#   mobile/scripts/full-rebuild/rebuild-full-database.sh <output directory outside the repo>
#
# 1. starts a throwaway Supabase-image Postgres and a throwaway PostgREST on a private
#    Docker network, on free loopback ports (never 54320-54329, the owner's local stack);
# 2. applies every repository migration, each in one transaction (as the Supabase CLI does);
# 3. loads the Kazimirski segments and mappings from the committed manifest and review
#    decisions (load-kazimirski-disposable.py);
# 4. exports with `export-content-db.mjs --target disposable` (anon key, read-only);
# 5. verifies: the content fingerprint and counts (verify-content-db.mjs) AND the full-content
#    fingerprint of every table (content-db.full.expected.json). Any mismatch fails.
# It needs Docker, psql, python3 and Node 22. It uses NO production access, NO .env, NO
# repository secret; the only secret is a random JWT secret generated for this run. Everything
# it starts is removed on exit. The result is written only to the output directory.
set -euo pipefail

OUT="${1:?usage: rebuild-full-database.sh <output directory outside the repository>}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MOBILE="$ROOT/mobile"
PG_IMAGE="${QR_PG_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.155}"
REST_IMAGE="${QR_REST_IMAGE:-public.ecr.aws/supabase/postgrest:v14.15}"
RUN_ID="qr-rebuild-$$-$(date +%s)"
PG_NAME="$RUN_ID-pg"; REST_NAME="$RUN_ID-rest"; NET="$RUN_ID-net"
TMP="$(mktemp -d)"
PROXY_PID=""

case "$(cd "$(dirname "$OUT")" 2>/dev/null && pwd)/$(basename "$OUT")" in
  "$ROOT"/*|"$ROOT") echo "refusing: output directory must be outside the repository" >&2; exit 2;;
  *content-db*|*quran-content*) echo "refusing: output directory must not point at approved content" >&2; exit 2;;
esac

cleanup() {
  if [ -n "$PROXY_PID" ]; then kill "$PROXY_PID" 2>/dev/null || true; wait "$PROXY_PID" 2>/dev/null || true; fi
  docker rm -f "$REST_NAME" "$PG_NAME" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

free_port() { python3 - <<'PY'
import socket, random
while True:
    p = random.randint(55000, 59000)
    s = socket.socket()
    try:
        s.bind(("127.0.0.1", p)); s.close(); print(p); break
    except OSError:
        pass
PY
}
PG_PORT=$(free_port); REST_PORT=$(free_port); PROXY_PORT=$(free_port)
for p in "$PG_PORT" "$REST_PORT" "$PROXY_PORT"; do
  if [ "$p" -ge 54320 ] && [ "$p" -le 54329 ]; then echo "refusing port $p (owner's local Supabase range)" >&2; exit 2; fi
done
export PGPASSWORD=postgres
# Migrations print many NOTICEs (seed summaries); only warnings and errors matter here.
export PGOPTIONS="-c client_min_messages=warning"
psql_pg() { psql -h 127.0.0.1 -p "$PG_PORT" -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "[1/6] starting disposable Postgres ($PG_IMAGE) on 127.0.0.1:$PG_PORT"
docker network create "$NET" >/dev/null
docker run --rm -d --name "$PG_NAME" --network "$NET" -e POSTGRES_PASSWORD=postgres \
  -p "127.0.0.1:$PG_PORT:5432" "$PG_IMAGE" >/dev/null
for _ in $(seq 1 60); do docker exec "$PG_NAME" pg_isready -U postgres -q 2>/dev/null && break; sleep 2; done
sleep 5

echo "[2/6] applying migrations (one transaction per file)"
n=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  n=$((n + 1))
  psql_pg -U postgres --single-transaction -f "$f" >/dev/null || { echo "migration failed: $(basename "$f")" >&2; exit 1; }
done
echo "      applied $n migrations"

echo "[3/6] loading Kazimirski segments and mappings from the committed manifest"
python3 "$MOBILE/scripts/full-rebuild/load-kazimirski-disposable.py" --port "$PG_PORT"

echo "[4/6] starting disposable PostgREST"
psql_pg -U supabase_admin -c "ALTER ROLE authenticator WITH PASSWORD 'postgres'"
JWT_SECRET="$(python3 -c 'import secrets;print(secrets.token_urlsafe(48))')"
ANON_KEY="$(python3 - "$JWT_SECRET" <<'PY'
import sys, hmac, hashlib, base64, json, time
b = lambda x: base64.urlsafe_b64encode(x).rstrip(b"=").decode()
h = b(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
p = b(json.dumps({"role": "anon", "iss": "qr-rebuild", "iat": int(time.time()), "exp": int(time.time()) + 3600}).encode())
print(f"{h}.{p}." + b(hmac.new(sys.argv[1].encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()))
PY
)"
docker run --rm -d --name "$REST_NAME" --network "$NET" -p "127.0.0.1:$REST_PORT:3000" \
  -e PGRST_DB_URI="postgres://authenticator:postgres@$PG_NAME:5432/postgres" -e PGRST_DB_SCHEMAS=public \
  -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$JWT_SECRET" "$REST_IMAGE" >/dev/null
cat > "$TMP/proxy.mjs" <<'JS'
import http from "node:http";
const [listen, target] = [Number(process.argv[2]), Number(process.argv[3])];
http.createServer((req, res) => {
  if (!req.url.startsWith("/rest/v1/")) { res.writeHead(404); return res.end(); }
  const up = http.request({ host: "127.0.0.1", port: target, method: req.method, path: req.url.replace("/rest/v1", ""), headers: req.headers },
    (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  up.on("error", () => { res.writeHead(502); res.end(); });
  req.pipe(up);
}).listen(listen, "127.0.0.1");
JS
node "$TMP/proxy.mjs" "$PROXY_PORT" "$REST_PORT" & PROXY_PID=$!
for _ in $(seq 1 30); do curl -s -o /dev/null -H "apikey: $ANON_KEY" "http://127.0.0.1:$PROXY_PORT/rest/v1/surahs?limit=1" && break; sleep 1; done

echo "[5/6] exporting (disposable target)"
mkdir -p "$OUT"
QR_DISPOSABLE_SUPABASE_URL="http://127.0.0.1:$PROXY_PORT" QR_DISPOSABLE_ANON_KEY="$ANON_KEY" \
  node --no-warnings "$MOBILE/scripts/export-content-db.mjs" --target disposable --out "$OUT" >"$TMP/export.log" 2>&1 \
  || { tail -20 "$TMP/export.log" >&2; exit 1; }

echo "[6/6] verifying against the pinned fingerprints"
# Success needs positive evidence, not just a zero exit code: a verifier that never ran its
# main() (for example because of a path problem) must not read as "verified".
verify_out="$(node --no-warnings "$MOBILE/scripts/verify-content-db.mjs" "$OUT/quran-content.sqlite")"
echo "$verify_out"
case "$verify_out" in
  "verify-content-db: OK"*) ;;
  *) echo "verification did not report OK" >&2; exit 1;;
esac
node --no-warnings "$MOBILE/scripts/full-rebuild/full-content-fingerprint.mjs" "$OUT/quran-content.sqlite" \
  --expect "$MOBILE/content-db.full.expected.json" >"$OUT/full-content-fingerprint.json" 2>"$TMP/fp.err" \
  || { cat "$TMP/fp.err" >&2; exit 1; }
cat "$TMP/fp.err"
[ -s "$OUT/full-content-fingerprint.json" ] || { echo "full-content fingerprint report is empty" >&2; exit 1; }
grep -q "full-content-fingerprint: OK" "$TMP/fp.err" || { echo "full-content fingerprint did not report OK" >&2; exit 1; }
echo "full database rebuilt and verified: $OUT/quran-content.sqlite"
