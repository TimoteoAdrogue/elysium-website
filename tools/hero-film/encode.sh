#!/bin/sh
# frames -> scrub-ready MP4s (every frame a keyframe, or Firefox stalls when seeking), posters and the trimmed pin data
# usage: sh encode.sh        (after rendering png-d at 2880x1800 and png-m at 1170x2532)
# the page picks film-landscape-2x.mp4 on screens wider than 2200 device px, film-landscape.mp4 (1920 px) elsewhere
set -e
cd "$(dirname "$0")"
OUT=../../assets/hero
e() { ffmpeg -v error -y -framerate 30 -i "$1/f%03d.png" $2 -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -tune film \
      -crf "$3" -g 1 -keyint_min 1 -sc_threshold 0 -movflags +faststart -an "$OUT/$4"; }
e png-d "" 29 film-landscape-2x.mp4
e png-d "-vf scale=1920:1200:flags=lanczos" 27 film-landscape.mp4
e png-m "" 29 film-portrait.mp4
sips -s format png --resampleWidth 1920 png-d/f000.png --out /tmp/poster-l.png >/dev/null && cwebp -quiet -q 72 /tmp/poster-l.png -o "$OUT/poster-landscape.webp"
sips -s format png --resampleWidth 780 png-m/f000.png --out /tmp/poster-p.png >/dev/null && cwebp -quiet -q 72 /tmp/poster-p.png -o "$OUT/poster-portrait.webp"
python3 - <<'PY'
import json
from PIL import Image
pins = ['zurich', 'pilatus', 'lake', 'jet', 'nations', 'cathedral', 'cern', 'hq']   # the order the page lists them
for src, name in (('png-d', 'landscape'), ('png-m', 'portrait')):
    meta = sorted(json.load(open(f'{src}.json')), key=lambda m: m['i'])
    w, h = Image.open(f'{src}/f000.png').size
    f = [[m['lat'], m['lon'], m['alt'], m['hdg']] + [m['lights'][k][:2] if k in m['lights'] else None for k in pins] for m in meta]
    json.dump({'w': w, 'h': h, 'fps': 30, 'pins': pins, 'f': f}, open(f'../../assets/hero/film-{name}.json', 'w'), separators=(',', ':'))
PY
ls -la "$OUT"
