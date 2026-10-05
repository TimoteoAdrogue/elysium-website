# Alpine contour lines for the page background, from the same open elevation data as the film
# (Mapzen Terrain Tiles, terrarium encoding). Writes static SVGs: assets/topo-<name>.svg
#   python topo.py            (downloads the z11 tiles it needs into tiles11/, about 2 MB)
import numpy as np, os, math, urllib.request
from PIL import Image
from scipy.ndimage import gaussian_filter
from skimage.measure import find_contours, approximate_polygon

D = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(D, '..', '..', 'assets')
Z = 11
# name: (lat, lon of the centre, contour interval in metres)
AREAS = {
    'a': (46.56, 7.98, 200),     # Eiger, Mönch, Jungfrau and the Aletsch glacier
    'b': (45.98, 7.66, 200),     # Matterhorn and Monte Rosa
}
SIZE = 1000                      # SVG viewBox, square
SPAN_KM = 30                     # ground covered by one SVG

def tile(x, y):
    p = os.path.join(D, 'tiles11', f'{Z}_{x}_{y}.png')
    if not os.path.exists(p):
        os.makedirs(os.path.dirname(p), exist_ok=True)
        urllib.request.urlretrieve(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png', p)
    a = np.asarray(Image.open(p).convert('RGB'), np.float32)
    return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768

def world(lat, lon):
    W = 2 ** Z * 256
    x = (lon + 180) / 360 * W
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * W
    return x, y

for name, (lat, lon, step) in AREAS.items():
    cx, cy = world(lat, lon)
    mpp = 156543.03 * math.cos(math.radians(lat)) / 2 ** Z          # metres per pixel at z11
    half = SPAN_KM * 500 / mpp
    x0, y0, x1, y1 = int((cx - half) // 256), int((cy - half) // 256), int((cx + half) // 256), int((cy + half) // 256)
    mos = np.block([[tile(x, y) for x in range(x0, x1 + 1)] for y in range(y0, y1 + 1)])
    ox, oy = int(cx - half - x0 * 256), int(cy - half - y0 * 256)
    n = int(2 * half)
    h = gaussian_filter(mos[oy:oy + n, ox:ox + n], 3.2)                 # soften tile seams and 1-pixel noise
    k = SIZE / n
    paths = []
    for level in np.arange(math.ceil(h.min() / step) * step, h.max(), step):
        major = round(level) % (step * 5) == 0
        for c in find_contours(h, level):
            if len(c) < 60: continue                                        # drop specks
            c = approximate_polygon(c, .9)
            d = 'M' + 'L'.join(f'{p[1] * k:.0f} {p[0] * k:.0f}' for p in c)
            paths.append((major, d))
    minor = ''.join(d for m, d in paths if not m)
    majorp = ''.join(d for m, d in paths if m)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" preserveAspectRatio="xMidYMid slice">'
           f'<g fill="none" stroke="#FFF" stroke-linejoin="round" vector-effect="non-scaling-stroke">'
           f'<path stroke-opacity=".03" stroke-width="1" vector-effect="non-scaling-stroke" d="{minor}"/>'
           f'<path stroke-opacity=".045" stroke-width="1" vector-effect="non-scaling-stroke" d="{majorp}"/></g></svg>')
    open(os.path.join(OUT, f'topo-{name}.svg'), 'w').write(svg)
    print(name, f'{h.min():.0f}–{h.max():.0f} m', len(paths), 'lines', f'{len(svg) / 1024:.0f} KB')
