#!/usr/bin/env bash
# Build a distributable macOS disk image for Work Income Tracker.
# Output: dist/WorkPrice-<version>.dmg
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="${VERSION:-1.0.0}"
DERIVED_DATA="${DERIVED_DATA:-$ROOT/build/DerivedData}"
DIST="${DIST:-$ROOT/dist}"
APP_NAME="WorkPrice"
APP="$DERIVED_DATA/Build/Products/Release/${APP_NAME}.app"
DMG="$DIST/${APP_NAME}-${VERSION}.dmg"
VOLUME_NAME="WorkPrice"

echo "==> Release build (universal arm64 + x86_64)"
xcodebuild \
  -project WorkPrice.xcodeproj \
  -scheme WorkPrice \
  -configuration Release \
  -destination "generic/platform=macOS" \
  -derivedDataPath "$DERIVED_DATA" \
  ARCHS="arm64 x86_64" \
  ONLY_ACTIVE_ARCH=NO \
  CODE_SIGN_IDENTITY="-" \
  CODE_SIGN_STYLE=Manual \
  DEVELOPMENT_TEAM="" \
  CODE_SIGNING_ALLOWED=NO \
  PRODUCT_BUNDLE_IDENTIFIER="com.foreverpx.workprice" \
  build

if [[ ! -d "$APP" ]]; then
  echo "Build did not produce $APP" >&2
  exit 1
fi

mkdir -p "$DIST"
SIGNED_APP="$DIST/${APP_NAME}.app"
rm -rf "$SIGNED_APP"
ditto "$APP" "$SIGNED_APP"

echo "==> Ad-hoc signing (codesign -s -). No Developer ID certificate is used."
codesign --force --sign - "$SIGNED_APP"
SIGNING_METHOD="ad-hoc"

SIGN_INFO="$(codesign -dv --verbose=4 "$SIGNED_APP" 2>&1 || true)"
printf '%s\n' "$SIGN_INFO"
if ! printf '%s\n' "$SIGN_INFO" | grep -q 'Signature=adhoc'; then
  echo "Expected an ad-hoc signature." >&2
  exit 1
fi
if printf '%s\n' "$SIGN_INFO" | grep -q '^Authority='; then
  echo "Refusing to package an app that has a signing authority." >&2
  exit 1
fi

codesign --verify --deep --strict --verbose=2 "$SIGNED_APP"
echo "Architectures: $(lipo -info "$SIGNED_APP/Contents/MacOS/$APP_NAME")"
echo "Bundle ID: $(defaults read "$SIGNED_APP/Contents/Info" CFBundleIdentifier)"

STAGE="$(mktemp -d "${TMPDIR:-/tmp}/workprice-dmg.XXXXXX")"
RW_DMG="$STAGE/rw.dmg"
cleanup() {
  if mount | grep -q "/Volumes/${VOLUME_NAME}"; then
    hdiutil detach "/Volumes/${VOLUME_NAME}" >/dev/null 2>&1 || true
  fi
  rm -rf "$STAGE"
}
trap cleanup EXIT

echo "==> Creating drag-to-Applications disk image"
hdiutil create -size 64m -fs HFS+ -volname "$VOLUME_NAME" -ov "$RW_DMG" >/dev/null
ATTACH_OUT="$(hdiutil attach -readwrite -noverify -noautoopen "$RW_DMG")"
MOUNT_POINT="$(printf '%s\n' "$ATTACH_OUT" | awk '/\/Volumes\// {print substr($0, index($0, "/Volumes/"))}' | tail -1)"
if [[ -z "$MOUNT_POINT" || ! -d "$MOUNT_POINT" ]]; then
  echo "Failed to mount disk image" >&2
  printf '%s\n' "$ATTACH_OUT" >&2
  exit 1
fi

ditto "$SIGNED_APP" "$MOUNT_POINT/${APP_NAME}.app"
ln -s /Applications "$MOUNT_POINT/Applications"

# Best-effort Finder layout. CI and headless sessions skip it; the image
# still contains the app and the Applications shortcut.
if [[ -z "${CI:-}" ]]; then
  python3 - <<'PY' || echo "Finder layout skipped; DMG still contains the app and Applications."
import subprocess
script = r'''
tell application "Finder"
  tell disk "WorkPrice"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set the bounds of container window to {120, 120, 720, 460}
    set viewOptions to the icon view options of container window
    set arrangement of viewOptions to not arranged
    set icon size of viewOptions to 112
    set position of item "WorkPrice.app" of container window to {160, 180}
    set position of item "Applications" of container window to {440, 180}
    update without registering applications
    delay 1
    close
  end tell
end tell
'''
subprocess.run(["osascript", "-e", script], check=False, timeout=20)
PY
fi

sync
hdiutil detach "$MOUNT_POINT" >/dev/null
rm -f "$DMG"
hdiutil convert "$RW_DMG" -format UDZO -imagekey zlib-level=9 -o "$DMG" >/dev/null

echo "==> Done"
echo "DMG: $DMG"
echo "Size: $(du -h "$DMG" | awk '{print $1}')"
echo "Signing: $SIGNING_METHOD"
echo "The disk image is unsigned. The app inside is ad-hoc signed."
echo "On first launch, right-click WorkPrice and choose Open, or allow it in System Settings → Privacy & Security."
