# Hero film data

The hero is drawn live in the browser by `film3d.js` (WebGL2) from `assets/hero3d/`: `terrain.png` (the corridor the
flight can see, 250 m grid, height in decimetres in R/G, water in B), `city.bin` (OpenStreetMap buildings within 6 km
of Geneva) and `meta.json` (grid placement, route waypoints, pin anchors). `webdata.py` writes all three. The offline
renderer below made the earlier video version and still renders stills; `render.py`'s route and timing match
`film3d.js`. Nothing here ships with the site.
Needs Python 3 with numpy, scipy, scikit-image and Pillow, plus ffmpeg and cwebp.

```bash
# 1. elevation tiles (Mapzen Terrain Tiles, z10, about 24 MB)
mkdir -p tiles && for x in $(seq 527 541); do for y in $(seq 355 366); do curl -s --fail -o tiles/10_${x}_${y}.png https://s3.amazonaws.com/elevation-tiles-prod/terrarium/10/$x/$y.png; done; done
# 2. local 100 m elevation grid -> dem.npz
python3 dem.py
# 3. Geneva's buildings from OpenStreetMap -> osm/geneva-buildings.json (Overpass; split the box if it times out)
mkdir -p osm && curl -s -A "elysium-site-build" -H "Accept: application/json" -o osm/geneva-buildings.json \
  --data-urlencode 'data=[out:json][timeout:240];(way["building"](46.140,6.040,46.265,6.235);relation["building"](46.140,6.040,46.265,6.235););out tags geom;' \
  https://overpass-api.de/api/interpreter
# 4. frames + per-frame data: desktop 2880x1800 (2x a 1440 x 900 screen), then phone 1170x2532 (3x a 390 x 844 screen)
NAME=png-d PROCS=3 python3 render.py 300
FW=1170 FH=2532 HFOV=42 PITCH=-8 GRID=m NAME=png-m PROCS=3 python3 render.py 300
# 5. the live hero's data -> assets/hero3d/ (about 3.4 MB)
python3 webdata.py
# 6. optional: offline frames for stills, and the opening poster the page shows while the live scene loads
sh encode.sh   # also writes assets/hero/poster-*.webp
```

The route: Zürich, the Alps and Lake Geneva as scan lines from real elevation data; a low pass over the lake past
the Jet d'eau; the Old Town and Carouge (the HQ) as a hidden-line 3D city from OpenStreetMap footprints and heights;
then a crane up to a top-down map whose scan lines settle onto the site's grid columns (`GRID_X`), so the film ends
on the page. `ROUTE`, `ALT` and `PIT` at the top of `render.py` set the timing, height and pitch along the route.

`assets/hero/film-*.json` holds, per frame, `[lat, lon, alt, hdg]` and the screen position of each pin, in the order
the page lists them. Credit for the terrain data and © OpenStreetMap contributors are in the site footer and must stay
while the film does. Both renders take about 12 minutes on a 6-core, 8 GB Mac with `PROCS=3` (more processes run out of memory).
