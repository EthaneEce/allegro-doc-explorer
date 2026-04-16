#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/downloads"
OUT_FILE="$OUT_DIR/allegro-doc-offline.zip"

mkdir -p "$OUT_DIR"
rm -f "$OUT_FILE"

cd "$ROOT_DIR"
zip -q -r "$OUT_FILE" \
  index.html \
  styles.css \
  app.js \
  README.md \
  allegro.css \
  allegro.html \
  changes.html \
  license.html \
  readme.html \
  thanks.html \
  upstream-index.html \
  data \
  alleg0*.html

echo "Created $OUT_FILE"
