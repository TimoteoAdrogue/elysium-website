# Hero film renderer

Offline tools that made `assets/hero/film-*.mp4`. Nothing here ships with the site.
Needs Python 3 with numpy, scipy and Pillow, and ffmpeg.

```bash
# 1. elevation tiles (Mapzen Terrain Tiles, z10, about 24 MB)
mkdir -p tiles && for x in $(seq 527 541); do for y in $(seq 355 366); do curl -s --fail -o tiles/10_${x}_${y}.png https://s3.amazonaws.com/elevation-tiles-prod/terrarium/10/$x/$y.png; done; done
# 2. local 100 m elevation grid -> dem.npz
python dem.py
# 3. frames + HUD data (landscape, then portrait)
NAME=png-d python render.py 240
FW=720 FH=1560 HFOV=42 PITCH=-8 GRID=m NAME=png-m python render.py 240
# 4. scrub encodes: one keyframe per frame, or Firefox seeks stall
ffmpeg -framerate 30 -i png-d/f%03d.png -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 27 -tune film -g 1 -keyint_min 1 -sc_threshold 0 -movflags +faststart -an film-landscape.mp4
```

`render.py` writes `<NAME>.json` beside the frames: per frame, the camera's lat/lon/alt/heading and the
screen position of each pin. `assets/hero/film-*.json` is that file trimmed (see the trim step in the
session that built it: `[lat, lon, alt, hdg, zurich, pilatus, lake, geneva]` per frame).

The camera path, timing, grid hand-off and pins are all at the top of `render.py`. The last frames
morph the scan lines onto the site's grid columns (`GRID_X`), so the film ends on the page.
Credit for the terrain data is in the site footer and must stay while the film does.
