#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-https://api.twobrothersfreight.com/api}"
ORIGIN="${ORIGIN:-https://db.twobrothersfreight.com}"

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

tmp_small=$(mktemp)
tmp_large=$(mktemp)
trap 'rm -f "$tmp_small" "$tmp_large"' EXIT

dd if=/dev/zero of="$tmp_small" bs=1 count=500000 status=none
dd if=/dev/zero of="$tmp_large" bs=1 count=2097152 status=none

echo "=== Health ==="
health_headers=$(curl -sSI "$API_BASE/health")
echo "$health_headers" | head -n 5
echo "$health_headers" | grep -qi "X-App-Layer: express" && pass "health includes X-App-Layer" || fail "health missing X-App-Layer"

echo "=== 500KB upload (should reach Express: 401) ==="
code_small=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_BASE/my-files/upload" \
  -H "Origin: $ORIGIN" -H "Content-Type: application/octet-stream" \
  --data-binary "@$tmp_small")
[[ "$code_small" == "401" || "$code_small" == "201" ]] && pass "500KB -> HTTP $code_small" || fail "500KB -> HTTP $code_small (expected 401/201)"

echo "=== 2MB upload (must NOT be nginx HTML 413) ==="
large_headers=$(curl -sS -D - -o /dev/null -X POST "$API_BASE/my-files/upload" \
  -H "Origin: $ORIGIN" -H "Content-Type: application/octet-stream" \
  --data-binary "@$tmp_large")
echo "$large_headers" | head -n 15
echo "$large_headers" | grep -q "413 Request Entity Too Large" && fail "2MB blocked by nginx (client_max_body_size still 1m)"
echo "$large_headers" | grep -qi "X-App-Layer: express" && pass "2MB reached Express layer" || fail "2MB did not reach Express"
code_large=$(echo "$large_headers" | head -n1 | awk '{print $2}')
[[ "$code_large" == "401" || "$code_large" == "201" ]] && pass "2MB -> HTTP $code_large" || fail "2MB -> HTTP $code_large"

echo "All upload limit checks passed."
