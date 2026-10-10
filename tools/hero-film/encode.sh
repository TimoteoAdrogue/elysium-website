#!/bin/sh
# frames -> scrub-ready MP4 (every frame a keyframe, or Firefox stalls when seeking), poster, and the trimmed per-frame data
# usage: sh encode.sh png-d landscape [crf]   |   sh encode.sh png-m portrait [crf]
set -e
cd "$(dirname "$0")"
SRC=$1; NAME=$2; CRF=${3:-27}; OUT=../../assets/hero
ffmpeg -v error -y -framerate 30 -i "$SRC/f%03d.png" -c:v libx264 -profile:v high -pix_fmt yuv420p -crf "$CRF" -tune film \
  -g 1 -keyint_min 1 -sc_threshold 0 -movflags +faststart -an "$OUT/film-$NAME.mp4"
cwebp -quiet -q 82 "$SRC/f000.png" -o "$OUT/poster-$NAME.webp"
python3 - "$SRC" "$NAME" <<'PY'
import json, sys
from PIL import Image
src, name = sys.argv[1], sys.argv[2]
meta = sorted(json.load(open(f'{src}.json')), key=lambda m: m['i'])
w, h = Image.open(f'{src}/f000.png').size
pins = ['zurich', 'pilatus', 'lake', 'jet', 'nations', 'cathedral', 'cern', 'hq']
f = [[m['lat'], m['lon'], m['alt'], m['hdg']] + [m['lights'][k][:2] if k in m['lights'] else None for k in pins] for m in meta]
json.dump({'w': w, 'h': h, 'fps': 30, 'pins': pins, 'f': f}, open(f'../../assets/hero/film-{name}.json', 'w'), separators=(',', ':'))
PY
ls -la "$OUT/film-$NAME.mp4" "$OUT/poster-$NAME.webp" "$OUT/film-$NAME.json"
