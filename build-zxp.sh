#!/usr/bin/env bash
# Build & sign PlatziComposerPro.zxp desde el estado actual del repo.
# Requiere: .tools/ZXPSignCmd y .tools/cert.p12 (no versionados).
# Uso:  ./build-zxp.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
Z="$ROOT/.tools/ZXPSignCmd"
CERT="$ROOT/.tools/cert.p12"
PASS="${ZXP_CERT_PASS:-platzi2026}"
OUT="$ROOT/PlatziComposerPro.zxp"
STAGE="$(mktemp -d)"

[ -x "$Z" ] || { echo "❌ Falta .tools/ZXPSignCmd (ver README de build)"; exit 1; }
[ -f "$CERT" ] || { echo "❌ Falta .tools/cert.p12"; exit 1; }

VER="$(tr -d '[:space:]' < "$ROOT/VERSION")"
echo "▸ Empaquetando v$VER"

# Solo los archivos que van dentro de la extensión
cp -R "$ROOT/CSXS" "$ROOT/client" "$ROOT/host" "$ROOT/VERSION" "$STAGE/"
[ -f "$ROOT/README.md" ] && cp "$ROOT/README.md" "$STAGE/"

rm -f "$OUT"
"$Z" -sign "$STAGE" "$OUT" "$CERT" "$PASS" -tsa http://timestamp.digicert.com
"$Z" -verify "$OUT"
rm -rf "$STAGE"

echo "✅ $OUT (v$VER)"
