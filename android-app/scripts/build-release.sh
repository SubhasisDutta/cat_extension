#!/usr/bin/env bash
# Build a Play-Store-ready AAB from the current working tree.
#
# Manual, on-demand release. No CI, no tags pushed, no version bumping —
# you decide when to run this. The version is read from
# app/build.gradle.kts (`versionCode` and `versionName`); bump both before
# running unless the build is a self-test.
#
# Prereqs:
#   - JDK 17+ on PATH
#   - keystore.properties present (see SIGNING.md)
#   - ./gradlew or system gradle available
#
# Usage:
#   scripts/build-release.sh
#   scripts/build-release.sh --skip-tests        # not recommended
#   scripts/build-release.sh --apk               # also build a signed APK
#                                                # (Play Store wants AAB,
#                                                # but APK is useful for
#                                                # local install / debug)
#
# Output:
#   dist/fat-orange-cat-vX.Y.Z-N.aab
#   dist/fat-orange-cat-vX.Y.Z-N.apk    (only with --apk)
#
# Exits non-zero on any failure.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SKIP_TESTS=0
ALSO_APK=0
for arg in "$@"; do
  case "$arg" in
    --skip-tests) SKIP_TESTS=1 ;;
    --apk)        ALSO_APK=1  ;;
    *)
      echo "unknown flag: $arg" >&2
      exit 2
      ;;
  esac
done

# ---------- preflight ----------

command -v java >/dev/null 2>&1 || { echo "java is required (JDK 17+)" >&2; exit 1; }

GRADLE=""
if [[ -x "./gradlew" ]]; then
  GRADLE="./gradlew"
elif command -v gradle >/dev/null 2>&1; then
  GRADLE="gradle"
else
  echo "gradle not found. Run \`gradle wrapper\` once or open the project in Android Studio." >&2
  exit 1
fi

if [[ ! -f "keystore.properties" ]]; then
  cat >&2 <<EOF
keystore.properties is missing — release builds will be unsigned and Play
Store will reject the upload.

  1. Copy the template:    cp keystore.properties.template keystore.properties
  2. Fill it in (see SIGNING.md for keystore generation).
  3. Re-run this script.

If you really want an unsigned debug-style build for local testing, run
\`./gradlew assembleDebug\` instead — that path is signed with the debug key.
EOF
  exit 1
fi

VERSION_NAME="$(grep -oE 'versionName *= *"[^"]+"' app/build.gradle.kts | head -1 | sed -E 's/.*"([^"]+)".*/\1/')"
VERSION_CODE="$(grep -oE 'versionCode *= *[0-9]+' app/build.gradle.kts | head -1 | awk '{print $NF}')"
if [[ -z "$VERSION_NAME" || -z "$VERSION_CODE" ]]; then
  echo "could not parse versionName / versionCode from app/build.gradle.kts" >&2
  exit 1
fi
NAME="fat-orange-cat-v${VERSION_NAME}-${VERSION_CODE}"

echo "==> packaging Fat Orange Cat v${VERSION_NAME} (build ${VERSION_CODE})"

# ---------- run tests ----------

if [[ $SKIP_TESTS -eq 0 ]]; then
  echo "==> running unit tests"
  "$GRADLE" :app:test
else
  echo "==> SKIPPING tests (--skip-tests)"
fi

# ---------- build the AAB ----------

echo "==> building release AAB"
"$GRADLE" :app:bundleRelease

SRC_AAB="app/build/outputs/bundle/release/app-release.aab"
if [[ ! -f "$SRC_AAB" ]]; then
  echo "expected $SRC_AAB to exist but it doesn't — bundleRelease may have failed silently" >&2
  exit 1
fi

mkdir -p dist
OUT_AAB="dist/${NAME}.aab"
cp "$SRC_AAB" "$OUT_AAB"

SIZE_AAB="$(du -h "$OUT_AAB" | cut -f1)"
echo "wrote $OUT_AAB ($SIZE_AAB)"

# ---------- optional APK for local install ----------

if [[ $ALSO_APK -eq 1 ]]; then
  echo "==> building release APK (for local install)"
  "$GRADLE" :app:assembleRelease

  SRC_APK="app/build/outputs/apk/release/app-release.apk"
  if [[ ! -f "$SRC_APK" ]]; then
    echo "expected $SRC_APK to exist but it doesn't" >&2
    exit 1
  fi
  OUT_APK="dist/${NAME}.apk"
  cp "$SRC_APK" "$OUT_APK"
  SIZE_APK="$(du -h "$OUT_APK" | cut -f1)"
  echo "wrote $OUT_APK ($SIZE_APK)"
fi

# ---------- next steps ----------

cat <<EOF

next steps:
  1. open https://play.google.com/console/
  2. select Fat Orange Cat -> Production -> Create new release
  3. upload: $OUT_AAB
  4. fill in release notes ("what's new in this version")
  5. submit for review
  6. tag the release locally:  git tag v${VERSION_NAME} && git push origin v${VERSION_NAME}
EOF

if [[ $ALSO_APK -eq 1 ]]; then
  echo "  optional: adb install $OUT_APK   # local install for smoke testing"
fi
