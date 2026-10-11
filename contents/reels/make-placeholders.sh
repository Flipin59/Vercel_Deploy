#!/usr/bin/env bash
# Writes one placeholder clip per manifest row to public/media/reels/<file>, for running
# without Supabase (real clips are in the `reels` Storage bucket):
# 480x854, 7 s, H.264 baseline, no audio, title + first hashtag on a pillar colour.
# Real clips replace these under the same name. Needs ffmpeg (with drawtext) and jq.
# Usage: contents/reels/make-placeholders.sh [--force]   (existing files are kept)
set -euo pipefail
cd "$(dirname "$0")/../.."
out=public/media/reels
mkdir -p "$out"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

jq -r '.[] | [.file, .pillar, .title, .hashtags[0]] | @tsv' src/features/reels/data/reels.json |
while IFS=$'\t' read -r file pillar title tag; do
  [[ -e "$out/$file" && "${1:-}" != "--force" ]] && continue
  mkdir -p "$(dirname "$out/$file")"
  case "$pillar" in
    budget) color=0x1e6091 ;; save) color=0x2a9d8f ;; invest) color=0x7b2cbf ;; *) color=0xc1121f ;;
  esac
  # textfile= sidesteps drawtext escaping of quotes, colons and '&' in titles.
  printf '%s' "$title" | fold -s -w 20 >"$tmp/title"
  printf '#%s' "$tag" >"$tmp/tag"
  text="font=DejaVu Sans:fontcolor=white:x=(w-text_w)/2"
  ffmpeg -nostdin -loglevel error -y -f lavfi -i "color=c=$color:s=480x854:r=24:d=7" \
    -vf "drawtext=$text:fontsize=36:textfile=$tmp/title:text_align=center:line_spacing=10:y=(h-text_h)/2-60,\
drawtext=$text:fontsize=26:textfile=$tmp/tag:y=h/2+120,\
drawtext=$text:fontsize=20:text='placeholder  %{eif\:t\:d}s':y=h-90" \
    -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -crf 30 -an -movflags +faststart \
    "$out/$file" </dev/null
  echo "$out/$file"
done
