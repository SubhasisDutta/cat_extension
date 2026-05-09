#!/usr/bin/env bash
# Build a Chrome Web Store-ready ZIP from the current working tree.
#
# Manual, on-demand release. No CI, no tags pushed, no version bumping —
# you decide when to run this. The ONLY input is the `version` field in
# manifest.json: bump it before running, or pass --skip-version-check to
# build with the existing version (e.g. for a self-test).
#
# Usage:
#   scripts/build-release.sh
#   scripts/build-release.sh --skip-tests        # not recommended
#   scripts/build-release.sh --skip-icons        # don't rebuild PNGs first
#
# Output:
#   dist/fat-orange-cat-vX.Y.Z.zip
#
# Exits non-zero on any failure. The zip contains ONLY runtime files —
# no tests, no scripts, no docs, no .git. Verify with:
#   unzip -l dist/fat-orange-cat-vX.Y.Z.zip

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SKIP_TESTS=0
SKIP_ICONS=0
for arg in "$@"; do
  case "$arg" in
    --skip-tests) SKIP_TESTS=1 ;;
    --skip-icons) SKIP_ICONS=1 ;;
    *)
      echo "unknown flag: $arg" >&2
      exit 2
      ;;
  esac
done

# ---------- preflight ----------

command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 1; }
command -v zip  >/dev/null 2>&1 || { echo "zip is required" >&2; exit 1; }

VERSION="$(node -p 'require("./manifest.json").version')"
if [[ -z "$VERSION" || "$VERSION" == "undefined" ]]; then
  echo "could not read version from manifest.json" >&2
  exit 1
fi
NAME="fat-orange-cat-v${VERSION}"
OUT_DIR="$ROOT/dist"
OUT_ZIP="$OUT_DIR/$NAME.zip"
STAGE="$OUT_DIR/.stage-$NAME"

echo "==> packaging Fat Orange Cat v$VERSION"

# ---------- run tests ----------

if [[ $SKIP_TESTS -eq 0 ]]; then
  echo "==> running tests"
  node tests/run-tests.js
else
  echo "==> SKIPPING tests (--skip-tests)"
fi

# ---------- regenerate icons ----------

if [[ $SKIP_ICONS -eq 0 ]]; then
  echo "==> rebuilding icons from scripts/build-icons.js"
  node scripts/build-icons.js >/dev/null
else
  echo "==> SKIPPING icon rebuild (--skip-icons)"
fi

# ---------- stage runtime files ----------

# Explicit allowlist. Anything not in this list does NOT ship to the store.
# Mirror manifest.json's references plus the popup HTML/CSS/JS triplet.
FILES=(
  manifest.json
  background.js
  content.js
  cat.js
  overlay.css
  popup.html
  popup.js
  popup.css
  lib/timer-logic.js
  icons/icon-16.png
  icons/icon-32.png
  icons/icon-48.png
  icons/icon-128.png
)

rm -rf "$STAGE"
mkdir -p "$STAGE"

for f in "${FILES[@]}"; do
  if [[ ! -f "$ROOT/$f" ]]; then
    echo "missing file referenced by allowlist: $f" >&2
    exit 1
  fi
  mkdir -p "$STAGE/$(dirname "$f")"
  cp "$ROOT/$f" "$STAGE/$f"
done

# Strip macOS metadata that `zip` may otherwise pull in.
find "$STAGE" -name ".DS_Store" -delete
find "$STAGE" -name "._*" -delete

# ---------- sanity check the staged manifest ----------

# Manifest version must match the version the zip is named after.
STAGED_VERSION="$(node -p 'require("'$STAGE'/manifest.json").version')"
if [[ "$STAGED_VERSION" != "$VERSION" ]]; then
  echo "staged manifest version $STAGED_VERSION != $VERSION" >&2
  exit 1
fi

# Make sure no test/scripts/dot-files leaked into the stage.
LEAKS="$(find "$STAGE" \( -name "*.test.js" -o -name "tests" -o -name "scripts" -o -name ".git" -o -name ".DS_Store" -o -name "README.md" -o -name "CLAUDE.md" -o -name "AGENTS.md" \) -print || true)"
if [[ -n "$LEAKS" ]]; then
  echo "stage has unexpected files:" >&2
  echo "$LEAKS" >&2
  exit 1
fi

# ---------- build the zip ----------

mkdir -p "$OUT_DIR"
rm -f "$OUT_ZIP"

# -X strips extra file attributes; -r recurses; --no-dir-entries omits
# directory entries so the archive is the smallest valid form.
( cd "$STAGE" && zip -X -r --no-dir-entries -q "$OUT_ZIP" . )

# Clean up the stage dir (keep the zip).
rm -rf "$STAGE"

# ---------- report ----------

SIZE="$(du -h "$OUT_ZIP" | cut -f1)"
echo
echo "wrote $OUT_ZIP ($SIZE)"
echo
echo "contents:"
unzip -l "$OUT_ZIP" | sed 's/^/    /'
echo
echo "next steps:"
echo "  1. open https://chrome.google.com/webstore/devconsole/"
echo "  2. select the Fat Orange Cat item, 'Package' tab, 'Upload new package'"
echo "  3. drag $OUT_ZIP onto the upload area"
echo "  4. fill in any 'what's new' notes, hit 'Submit for review'"
echo "  5. tag the release locally:  git tag v$VERSION && git push origin v$VERSION"
