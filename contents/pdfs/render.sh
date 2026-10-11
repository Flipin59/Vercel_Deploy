#!/usr/bin/env bash
# Renders every contents/pdfs/<slug>.<lang>.pdf into contents/pdfs/pages/<slug>.<lang>/<n>.jpg,
# the page images the Learn reader serves (lighter than shipping a PDF viewer to cheap phones).
# Re-run after adding or changing a PDF, and commit the pages. Needs pdftoppm (poppler-utils).
# 720 px wide = sharp on a 360 px-wide phone screen at 2x.
set -euo pipefail
cd "$(dirname "$0")"
for pdf in *.pdf; do
  out="pages/${pdf%.pdf}"
  rm -rf "$out"
  mkdir -p "$out"
  pdftoppm -jpeg -jpegopt quality=70 -scale-to-x 720 -scale-to-y -1 "$pdf" "$out/p"
  for f in "$out"/p-*.jpg; do
    n=${f##*-}
    mv "$f" "$out/$((10#${n%.jpg})).jpg"
  done
done
