# Data for the real-time hero (assets/hero3d/): the same elevation and buildings the offline film used, packed small.
#   terrain.png   200 m grid; R,G = height in decimetres (high, low byte), B = water (255)
#   city.bin      OpenStreetMap buildings within 6 km of Geneva: per building n, height dm, ground dm, flags, fade,
#                 then n vertices as int16 metres east/north of Geneva's centre
#   python3 webdata.py      (after dem.py and the OSM download, see README)
import numpy as np, json, os, struct, math
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(D, '..', '..', 'assets', 'hero3d'); os.makedirs(OUT, exist_ok=True)
os.environ.setdefault('FW', '64'); os.environ.setdefault('FH', '40')
import render as R                                     # reuses the DEM, the building parse and the anchors

# ---- terrain: the corridor the flight can see (E -150..140 km, N -130..130 km), resampled to a 250 m grid
from scipy.ndimage import zoom
E0, E1, N0, N1, STEP = -150000.0, 140000.0, -130000.0, 130000.0, 250.0
i0, i1 = int((N0 - R.GN[0]) / R.STEP), int((N1 - R.GN[0]) / R.STEP)
j0, j1 = int((E0 - R.GE[0]) / R.STEP), int((E1 - R.GE[0]) / R.STEP)
k = R.STEP / STEP
H2 = zoom(R.HG[i0:i1, j0:j1].astype(np.float32), k, order=1)
W2 = zoom(R.WAT[i0:i1, j0:j1].astype(np.float32), k, order=0) > .5
dm = np.clip(np.round(H2*10), 0, 65535).astype(np.uint16)
rgb = np.stack([(dm >> 8).astype(np.uint8), (dm & 255).astype(np.uint8), np.where(W2, 255, 0).astype(np.uint8)], -1)
Image.fromarray(rgb[::-1]).save(f'{OUT}/terrain.png', optimize=True)   # row 0 = north, as images go
print('terrain', rgb.shape, os.path.getsize(f'{OUT}/terrain.png')//1024, 'KB')

# ---- buildings
G = R.GENEVA
recs, n_out = [], 0
for i, (P, hgt, hot) in enumerate(R.BLD):
    if R.BF[i] <= .04 or np.hypot(*(P.max(0) - P.min(0))) < 9: continue      # far edge and sheds out
    q = np.round(P - G).astype(int)
    if np.abs(q).max() > 32000 or len(q) > 255: continue
    recs.append(struct.pack('<BHHBB', len(q), int(min(hgt*10, 65535)), int(min(R.BG[i]*10, 65535)), 1 if hot else 0, int(R.BF[i]*255))
                + np.asarray(q, '<i2').tobytes())
    n_out += 1
blob = struct.pack('<I', n_out) + b''.join(recs)
open(f'{OUT}/city.bin', 'wb').write(blob)
print('buildings', n_out, len(blob)//1024, 'KB')

# ---- constants the page needs: grid placement, centre, pin anchors with their ground height
pins = {k: [round(float(R.en(lo, la)[0]), 1), round(float(R.en(lo, la)[1]), 1), round(R.hgt(*R.en(lo, la)), 1), hh] for k, (lo, la, hh) in R.ANCH.items()}
meta = {'lon0': R.LON0, 'lat0': R.LAT0, 'kx': R.KX, 'ky': R.KY, 'e0': E0, 'n0': N0, 'step': STEP,
        'cols': int(rgb.shape[1]), 'rows': int(rgb.shape[0]), 'geneva': [float(G[0]), float(G[1])], 'pins': pins,
        'wp': [[float(a), float(b)] for a, b in R.WP]}
json.dump(meta, open(f'{OUT}/meta.json', 'w'), separators=(',', ':'))
print(json.dumps(meta)[:400])
