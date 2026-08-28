#!/usr/bin/env bash
set -euo pipefail

PLUGIN_SLUG="stepwise"
PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$(dirname "$PLUGIN_DIR")/dist"
ZIP_NAME="${PLUGIN_SLUG}.zip"
OUT="$DIST_DIR/$ZIP_NAME"
PROD_SAAS_URL="https://app.wpstepwise.com"

# Excluded paths (relative to plugin root)
EXCLUDES=(
  "_doc"
  "src"
  "node_modules"
  ".DS_Store"
  "*.map"
  "package.json"
  "package-lock.json"
  "webpack.config.js"
  "build-zip.sh"
  ".git"
  ".gitignore"
  ".distignore"
)

echo "→ Building JS assets…"
npm --prefix "$PLUGIN_DIR" run build

mkdir -p "$DIST_DIR"
rm -f "$OUT"

# --- Build from a temp copy so the source directory is never modified ---
TMP_DIR="$(mktemp -d)"
TMP_PLUGIN="$TMP_DIR/$PLUGIN_SLUG"
trap 'rm -rf "$TMP_DIR"' EXIT

rsync -a --exclude='node_modules' --exclude='.git' --exclude='src' --exclude='_doc' "$PLUGIN_DIR/" "$TMP_PLUGIN/"

# Swap the local dev SaaS URL for the production URL in the temp copy
CONSTANTS_FILE="$TMP_PLUGIN/includes/helpers/constants.php"
sed -i '' \
  "s|define( 'STEPWISE_SAAS_DEFAULT_URL',.*);|define( 'STEPWISE_SAAS_DEFAULT_URL', '${PROD_SAAS_URL}' );|" \
  "$CONSTANTS_FILE"

# Verify the replacement landed
if ! grep -q "$PROD_SAAS_URL" "$CONSTANTS_FILE"; then
  echo "✗ SaaS URL replacement failed — aborting" >&2
  exit 1
fi

# Build exclude flags for zip
EXCLUDE_FLAGS=()
for ex in "${EXCLUDES[@]}"; do
  EXCLUDE_FLAGS+=("--exclude=${PLUGIN_SLUG}/${ex}/*" "--exclude=${PLUGIN_SLUG}/${ex}")
done
# Also exclude root-level files/globs
EXCLUDE_FLAGS+=("--exclude=${PLUGIN_SLUG}/.DS_Store")
EXCLUDE_FLAGS+=("--exclude=${PLUGIN_SLUG}/.distignore")
EXCLUDE_FLAGS+=("--exclude=${PLUGIN_SLUG}/package.json")
EXCLUDE_FLAGS+=("--exclude=${PLUGIN_SLUG}/package-lock.json")
EXCLUDE_FLAGS+=("--exclude=${PLUGIN_SLUG}/webpack.config.js")
EXCLUDE_FLAGS+=("--exclude=${PLUGIN_SLUG}/build-zip.sh")
EXCLUDE_FLAGS+=("--exclude=*.map")

cd "$TMP_DIR"

zip -r "$OUT" "$PLUGIN_SLUG" \
  "${EXCLUDE_FLAGS[@]}" \
  -x "*.DS_Store" \
  -x "*/.git/*" \
  -x "*/.gitignore"

echo "✓ Built: $OUT"
echo "  SaaS URL → ${PROD_SAAS_URL}"
echo "  Size: $(du -sh "$OUT" | cut -f1)"
