#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "=========================================="
echo "    eX EXTENSION VERIFICATION SUITE       "
echo "=========================================="
echo ""

echo ">>> 1. Checking dist/ bundle and models..."
MISSING=0
REQUIRED_FILES=(
  "dist/manifest.json"
  "dist/background.js"
  "dist/content.js"
  "dist/content.css"
  "dist/offscreen.js"
  "dist/offscreen.html"
  "dist/models/boss/facenet.onnx"
  "dist/models/boss/mean_embedding.json"
  "dist/ort-wasm/ort.all.min.mjs"
)

for f in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "  ✗ Missing required file: $f"
    MISSING=1
  else
    echo "  ✓ Found: $f"
  fi
done

if [ "$MISSING" -ne 0 ]; then
  echo "Dist bundle incomplete. Run 'npm run build' first."
  exit 1
fi

echo ""
echo ">>> 2. Running all Unit & Integration Tests..."
node tests/unit/json-extract.test.js
node tests/unit/redact.test.js
node tests/unit/schemas.test.js
node tests/unit/pin.test.js
node tests/unit/is-allowed-target.test.js
node tests/unit/tier0-url.test.js
node tests/unit/tier0-mail.test.js
node tests/vuln-app/run-scan-test.js

echo ""
echo ">>> 3. Pinging all NVIDIA NIM AI Models..."
node tools/ping-model.mjs all

echo ""
echo "=========================================="
echo "    ALL CHECKS PASSED: eX READY TO LOAD   "
echo "=========================================="
