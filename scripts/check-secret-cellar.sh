#!/usr/bin/env bash
# Automates Secret-Cellar post-deploy checks. Safe to run in CI or locally.
set -euo pipefail

BASE="${1:-https://dollvovcinte.com}"

echo "== Health: $BASE/Secret-Cellar =="
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/Secret-Cellar")
test "$code" = "200" || { echo "FAIL: Secret-Cellar HTTP $code"; exit 1; }
echo "OK HTML $code"

echo "== Auth API =="
for pair in 'Boss-Girl:12345678' 'R:heya!'; do
  user="${pair%%:*}"
  pass="${pair#*:}"
  resp=$(curl -s -X POST "$BASE/api/auth" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$user\",\"password\":\"$pass\"}")
  echo "$resp" | grep -q '"ok":true' || { echo "FAIL: auth $user → $resp"; exit 1; }
  echo "OK auth $user"
done

echo "== Homepage still up =="
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/")
test "$code" = "200" || { echo "FAIL: / HTTP $code"; exit 1; }
echo "OK homepage"

echo "== Glitch lab still up =="
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/glitch-test")
test "$code" = "200" || { echo "FAIL: glitch-test HTTP $code"; exit 1; }
echo "OK glitch-test"

echo "All Secret-Cellar automated checks passed."
