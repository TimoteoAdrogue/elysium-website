# Elysium hero film: Switzerland as scan lines (real elevation), Zürich -> Alps -> a low approach over Lake Geneva
# to the Jet d'eau and the city (OpenStreetMap buildings as a scan point cloud), then top-down: relief flattens
# and the lines settle onto the site's 12-column grid.
import numpy as np, math, json, os, sys, re
from multiprocessing import Pool
from PIL import Image, ImageFilter, ImageDraw
from skimage.measure import approximate_polygon
D = os.path.dirname(os.path.abspath(__file__))
z = np.load(f'{D}/dem.npz'); HG, WAT, GE, GN = z['h'], z['water'], z['E'], z['N']
STEP = GE[1]-GE[0]
LON0, LAT0 = 7.4, 46.6
KX, KY = 111320*math.cos(math.radians(LAT0)), 110574.0
def en(lon, lat): return np.array([(lon-LON0)*KX, (lat-LAT0)*KY])
def ll(e, n): return LON0+e/KX, LAT0+n/KY

W, H, SS = int(os.environ.get('FW', 2880)), int(os.environ.get('FH', 1800)), 2   # 2x a 1440 x 900 screen: sharp on Retina
WS, HS = W*SS, H*SS
HFOV = math.radians(float(os.environ.get('HFOV', 55))); FPX = (WS/2)/math.tan(HFOV/2)
F = int(sys.argv[1]) if len(sys.argv) > 1 else 300
NAME = os.environ.get('NAME', 'frames'); OUT = f'{D}/{NAME}'; os.makedirs(OUT, exist_ok=True)

# ---- scan lines: perpendicular to the mean flight heading -------------------------
PSI_M = math.radians(235)
hv = np.array([math.sin(PSI_M), math.cos(PSI_M)])        # along flight
av = np.array([math.cos(PSI_M), -math.sin(PSI_M)])       # across flight (line direction)
DV, DU = 350.0, 120.0
VS = np.arange(-220e3, 220e3, DV); US = np.arange(-260e3, 260e3, DU)
PE = VS[:, None]*hv[0] + US[None, :]*av[0]
PN = VS[:, None]*hv[1] + US[None, :]*av[1]
ix = (PE-GE[0])/STEP; iy = (PN-GN[0])/STEP
inside = (ix >= 0) & (ix < len(GE)-1) & (iy >= 0) & (iy < len(GN)-1)
ixc, iyc = np.clip(ix, 0, len(GE)-1.001), np.clip(iy, 0, len(GN)-1.001)
x0, y0 = ixc.astype(int), iyc.astype(int); fx, fy = ixc-x0, iyc-y0
PH = (HG[y0, x0]*(1-fx)*(1-fy) + HG[y0, x0+1]*fx*(1-fy) + HG[y0+1, x0]*(1-fx)*fy + HG[y0+1, x0+1]*fx*fy).astype(np.float32)
PW = WAT[np.round(iyc).astype(int), np.round(ixc).astype(int)]
PE, PN = PE.astype(np.float32), PN.astype(np.float32)

def hgt(e, n):
    i, j = int(round((n-GN[0])/STEP)), int(round((e-GE[0])/STEP))
    return float(HG[min(max(i, 0), len(GN)-1), min(max(j, 0), len(GE)-1)])

# ---- camera path -------------------------------------------------------------------
WP = np.array([en(*p) for p in [(8.80, 47.50), (8.48, 47.16), (8.12, 46.80), (7.62, 46.47),
                                 (7.10, 46.33), (6.66, 46.37), (6.40, 46.30), (6.25, 46.255), (6.174, 46.2185),
                                 (6.1495, 46.2062), (6.1470, 46.2003), (6.1452, 46.1952)]])
def catmull(t):
    n = len(WP)-1; s = min(t*n, n-1e-6); i = int(s); u = s-i
    p0, p1, p2, p3 = WP[max(i-1, 0)], WP[i], WP[i+1], WP[min(i+2, n)]
    return 0.5*((2*p1) + (-p0+p2)*u + (2*p0-5*p1+4*p2-p3)*u*u + (-p0+3*p1-3*p2+p3)*u**3)
def heading(t):
    a, b = catmull(max(t-0.03, 0)), catmull(min(t+0.03, 1))
    d = b-a; return math.atan2(d[0], d[1])
GENEVA = en(6.143, 46.204); ZURICH = en(8.541, 47.377)
# pins, in the order the page lists them: lon, lat, height above the ground (m)
ANCH = {'zurich': (8.541, 47.377, 0), 'pilatus': (8.2525, 46.9791, 0), 'lake': (6.60, 46.43, 0),
        'jet': (6.15589, 46.20738, 140), 'nations': (6.14081, 46.22571, 30), 'cathedral': (6.14850, 46.20109, 64),
        'cern': (6.0557, 46.2337, 27), 'hq': (6.14344, 46.18556, 18)}

# ---- Geneva in 3D: OpenStreetMap buildings sampled as a scan point cloud, and the Jet d'eau --------------------
def _buildings():
    src = f'{D}/osm/geneva-buildings.json'
    if not os.path.exists(src): return []
    LANDMARK = ('Palais des Nations', 'Cathédrale Saint-Pierre', 'CERN', 'Globe')
    num = lambda v: float(re.match(r'[\d.]+', str(v).replace(',', '.')).group()) if re.match(r'[\d.]+', str(v).replace(',', '.')) else 0.0
    out = []
    for el in json.load(open(src))['elements']:
        tg = el.get('tags', {})
        rings = [el['geometry']] if el['type'] == 'way' else [m['geometry'] for m in el.get('members', []) if m.get('role') == 'outer' and 'geometry' in m]
        h = num(tg.get('height', '')) or 3.2 * num(tg.get('building:levels', '')) or 9.0
        h = min(max(h, 4.0), 160.0)
        hot = any(k in tg.get('name', '') for k in LANDMARK)
        for g in rings:
            P = np.array([en(q['lon'], q['lat']) for q in g])
            if len(P) < 4: continue
            P = approximate_polygon(P, 1.0)                                       # 1 m: corners kept, OSM jitter gone
            if len(P) < 4: continue
            if np.hypot(*(P.max(0) - P.min(0))) < 6: continue                    # sheds and kiosks
            A = 0.5*np.sum(P[:-1, 0]*P[1:, 1] - P[1:, 0]*P[:-1, 1])
            if A < 0: P = P[::-1]                                                 # counter-clockwise: outward normals on the right
            out.append((P[:-1].astype(np.float32), float(h), hot))
    return out
BLD = _buildings()
if BLD:
    BC = np.array([b[0].mean(0) for b in BLD], np.float32)                       # centroids
    _ix = np.clip(np.round((BC[:, 1] - GN[0]) / STEP).astype(int), 0, len(GN) - 1); _jx = np.clip(np.round((BC[:, 0] - GE[0]) / STEP).astype(int), 0, len(GE) - 1)
    BG = HG[_ix, _jx].astype(np.float32)                                          # ground under each building
    _rc = np.hypot(BC[:, 0] - GENEVA[0], BC[:, 1] - GENEVA[1])
    BF = (1 - np.clip((_rc - 4200) / 1800, 0, 1) ** 2).astype(np.float32)        # the city fades out in a circle, never at the data's edge
JET = en(6.15589, 46.20738)
def jet_points(t):
    # a 140 m column that blooms into spray and falls back downwind; the spray shifts a little every frame
    rng = np.random.default_rng(int(t * 1e4))
    s = rng.random(5000) ** .7; a = rng.random(5000) * 2 * math.pi
    z = 140 * (1 - (1 - s) ** 2.2); r = 1.2 + 9 * s ** 2.5
    fall = rng.random(1600); fz = 140 * (1 - fall ** 1.6); fr = 6 + 28 * fall ** .8; fa = rng.normal(.6, .5, 1600)
    E = np.concatenate([JET[0] + r * np.cos(a), JET[0] + fr * np.cos(fa)]); N = np.concatenate([JET[1] + r * np.sin(a), JET[1] + fr * np.sin(fa)])
    Z = np.concatenate([z, fz]); I = np.concatenate([np.full(5000, 1.1), np.full(1600, .55)])
    return E, N, Z, I

def sm(a, b, x):  # smoothstep
    x = min(max((x-a)/(b-a), 0), 1); return x*x*(3-2*x)
def lerp(a, b, x): return a+(b-a)*x
def angl(a, b, x):  # shortest-arc angle lerp
    d = (b-a+math.pi) % (2*math.pi)-math.pi; return a+d*x

# timing: scroll -> position along the route (one unit per leg). Fast over the Alps, slow past the jet and in the city
from scipy.interpolate import PchipInterpolator
_NL = len(WP) - 1
ROUTE = PchipInterpolator([0, .06, .40, .50, .60, .68, .74, .80], [0, .2, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0])
END = .80                                                     # the flight ends here; the crane and the grid follow
# height and pitch follow the route itself, so the descent lands on the city whatever the timing
# low from Versoix on, so the city and the Jet d'eau stand ahead of the camera for the whole approach down the lake
ALT = PchipInterpolator([0, 4.0, 6.0, 7.0, 8.0, 8.9, 9.6, 11.0], [12500, 9000, 4200, 1500, 850, 600, 650, 650])
PIT = PchipInterpolator([0, 4.4, 6.0, 7.0, 8.0, 8.9, 9.7, 10.4, 11.0], [-22, -29, -24, -12, -11, -15, -24, -20, -17])

def camera(t):
    leg = float(ROUTE(min(t, END)))
    sfrac = min(leg/_NL, 1)
    p = catmull(sfrac*0.999)
    psi = heading(sfrac*0.97)
    alt = float(ALT(leg))
    pit = math.radians(float(PIT(leg)) + float(os.environ.get('PITCH', 0))*(1 - .5*sm(7.0, 8.0, leg)))
    # crane up over the city, look straight down, yaw to the line direction
    # crane: turn back to face the city centre while rising over it, then look straight down and yaw to the lines
    d = sm(.80, .92, t)
    top = GENEVA + hv*600
    toc = GENEVA - p
    psi = angl(psi, math.atan2(toc[0], toc[1]), sm(.78, .85, t))
    p = p*(1-d) + top*d
    alt = lerp(alt, 15000, d**1.4)
    pit = lerp(pit, -math.pi/2+1e-4, sm(.82, .93, t))
    psi = angl(psi, PSI_M+math.pi/2, sm(.86, .95, t))
    return np.array([p[0], p[1], alt]), psi, pit

if os.environ.get('GRID') == 'm':  # phone grid: every third line, at a 390 px css width
    _k = W/390; GRID_X = [(16+358/4*k)*_k for k in range(4)] + [(16+358-1)*_k]
else:
    _k = W/1440; GRID_X = [(57.6+110.4*k)*_k for k in range(12)] + [1381.4*_k]

def frame(fi):
    t = fi/(F-1)
    C, psi, pit = camera(t)
    exag = lerp(1.75, 1.0, sm(.36, .50, t))*(1-sm(.82, .93, t))   # true scale in the city, flat at the end
    occ = 1-sm(.82, .88, t)                  # floating-horizon occlusion on, then off
    morph = sm(.93, .99, t)
    f = np.array([math.sin(psi)*math.cos(pit), math.cos(psi)*math.cos(pit), math.sin(pit)])
    r = np.array([math.cos(psi), -math.sin(psi), 0.0]); u = np.cross(r, f)
    FOG = 52000.0*min(max(C[2]/9000.0, .2), 1)
    vc = C[0]*hv[0]+C[1]*hv[1]
    far = 95e3*min(max(C[2]/9000.0, .36), 1)      # a low camera sees fewer far ridges, so they do not pile up at the horizon
    sel = np.where((VS > vc-30e3) & (VS < vc+far))[0]
    sel = sel[np.argsort(VS[sel])] if occ > 0 else sel
    dx, dy, dz = PE[sel]-C[0], PN[sel]-C[1], PH[sel]*exag-C[2]
    zc = dx*f[0]+dy*f[1]+dz*f[2]
    xc = dx*r[0]+dy*r[1]
    yc = dx*u[0]+dy*u[1]+dz*u[2]
    with np.errstate(divide='ignore', invalid='ignore'):
        sx = WS/2 + FPX*xc/zc; sy = HS/2 - FPX*yc/zc
    ok = inside[sel] & (zc > 300)
    # sweep pulse travelling ahead of the camera
    vs = vc + 3e3 + ((t*2.4) % 1)*70e3
    # morph targets: for top-down frames, each grid line claims the nearest scan line
    claim = {}
    if morph > 0:
        mx = np.array([np.nanmedian(np.where(ok[i], sx[i], np.nan)) if ok[i].any() else np.nan for i in range(len(sel))])
        for g in GRID_X:
            X = (g+0.5)*SS
            k = int(np.nanargmin(np.abs(mx-X))); claim[k] = X - mx[k]
    horizon = np.full(WS, 1e9, np.float32)
    slack = (1-occ)*1e6
    BX, BY, BV = [], [], []
    for i in range(len(sel)):
        m = ok[i]
        if m.sum() < 2: continue
        x, y, zz = sx[i], sy[i], zc[i]
        uu = US; wt = PW[sel[i]]
        a = m[:-1] & m[1:]
        j = np.where(a)[0]
        if not len(j): continue
        X0, X1, Y0, Y1 = x[j], x[j+1], y[j], y[j+1]
        off = ((X0 < 0) & (X1 < 0)) | ((X0 > WS) & (X1 > WS)) | ((Y0 < 0) & (Y1 < 0)) | ((Y0 > HS) & (Y1 > HS))
        L = np.hypot(X1-X0, Y1-Y0); keep = ~off & (L < 900)
        j, X0, X1, Y0, Y1, L = j[keep], X0[keep], X1[keep], Y0[keep], Y1[keep], L[keep]
        if not len(j): continue
        n = np.maximum(np.ceil(L).astype(int), 1)
        seg = np.repeat(np.arange(len(j)), n)
        st = np.repeat(np.cumsum(n)-n, n)
        q = (np.arange(n.sum())-st)/np.repeat(n, n)
        px = X0[seg]+(X1[seg]-X0[seg])*q; py = Y0[seg]+(Y1[seg]-Y0[seg])*q
        pz = zz[j][seg]+(zz[j+1][seg]-zz[j][seg])*q
        pu = uu[j][seg]+(uu[j+1][seg]-uu[j][seg])*q
        pw = np.where(q < .5, wt[j][seg], wt[j+1][seg])
        inb = (px >= 0) & (px < WS-1) & (py >= 0) & (py < HS-1)
        px, py, pz, pu, pw = px[inb], py[inb], pz[inb], pu[inb], pw[inb]
        if not len(px): continue
        col = px.astype(np.int32)
        vis = py < horizon[col] + 1.0 + slack
        if occ > 0: np.minimum.at(horizon, col, py)
        # intensity: fog, near fade, sweep, lakes dotted
        I = np.exp(-pz/FOG) * np.minimum(1, pz/2500.0)
        I = I*(1 + 1.8*math.exp(-((VS[sel[i]]-vs)/1400)**2)*(1-sm(.42, .52, t)))
        I = np.where(pw, I*0.32, I)
        I = I*0.85
        if morph > 0:
            if i in claim:
                px = px + claim[i]*morph
                I = I*(1-morph) + 0.08*morph
            else:
                I = I*(1-morph)**1.6
        BX.append(px[vis]); BY.append(py[vis]); BV.append(I[vis])
    city = sm(.34, .44, t)*(1-morph)
    JX, JY, JV = [], [], []
    if city > 0:
        je, jn, jz, ji = jet_points(t)
        dx, dy, dz = je-C[0], jn-C[1], 372.0*exag + jz*max(exag, .02) - C[2]
        zc = dx*f[0]+dy*f[1]+dz*f[2]; okp = zc > 30
        dx, dy, dz, zc, ji = dx[okp], dy[okp], dz[okp], zc[okp], ji[okp]
        JX.append(WS/2 + FPX*(dx*r[0]+dy*r[1])/zc); JY.append(HS/2 - FPX*(dx*u[0]+dy*u[1]+dz*u[2])/zc)
        JV.append(ji*np.exp(-zc/26000.0)*np.minimum(1, zc/300.0)*city)
    def splat(BX, BY, BV):
        buf = np.zeros(WS*HS, np.float32)
        if BX:
            px = np.concatenate(BX); py = np.concatenate(BY); v = np.concatenate(BV)*2.0
            xi, yi = px.astype(np.int64), py.astype(np.int64); fx_, fy_ = px-xi, py-yi
            mx_ = (xi >= 0) & (xi < WS-1) & (yi >= 0) & (yi < HS-1)
            xi, yi, fx_, fy_, v = xi[mx_], yi[mx_], fx_[mx_], fy_[mx_], v[mx_]
            for ox, oy, w in ((0, 0, (1-fx_)*(1-fy_)), (1, 0, fx_*(1-fy_)), (0, 1, (1-fx_)*fy_), (1, 1, fx_*fy_)):
                buf += np.bincount((yi+oy)*WS+xi+ox, weights=v*w, minlength=WS*HS).astype(np.float32)
        return buf.reshape(HS, WS)
    SUP = splat(BX, BY, BV)
    # Geneva in 3D: buildings drawn far to near, each one's walls and roof filled black (hiding the lines and buildings
    # behind it), then its edges in white: roof outline, and the vertical corners of the walls that face the camera
    if city > 0 and BLD:
        CI = Image.new('L', (WS, HS), 0); CM = Image.new('L', (WS, HS), 0)
        di, dm = ImageDraw.Draw(CI), ImageDraw.Draw(CM)
        rel = BC - C[:2]; dist = np.hypot(rel[:, 0], rel[:, 1])
        czc = rel[:, 0]*f[0] + rel[:, 1]*f[1] + (BG*exag - C[2])*f[2]
        reach = lerp(lerp(13000, 7000, sm(.56, .64, t)), 16000, sm(.81, .90, t))   # far on the lake, near in the streets, all from above
        cand = np.where((czc > 40) & (dist < reach) & (BF > 0))[0]
        for b in cand[np.argsort(-dist[cand])]:
            P, h, hot = BLD[b]
            g = BG[b]*exag; hh = h*max(exag, .02)*1.0
            dx, dy = P[:, 0]-C[0], P[:, 1]-C[1]
            zb = dx*f[0]+dy*f[1]+(g-C[2])*f[2]; zt = zb + hh*f[2]
            if zb.min() < 25 or zt.min() < 25: continue
            xb = dx*r[0]+dy*r[1]; yb = dx*u[0]+dy*u[1]+(g-C[2])*u[2]; yt = yb + hh*u[2]
            Xb, Yb = WS/2 + FPX*xb/zb, HS/2 - FPX*yb/zb
            Xt, Yt = WS/2 + FPX*xb/zt, HS/2 - FPX*yt/zt
            if Xb.max() < 0 or Xb.min() > WS or min(Yb.min(), Yt.min()) > HS or max(Yb.max(), Yt.max()) < 0: continue
            n = len(P); nx = np.roll(np.arange(n), -1)
            # a wall faces the camera when the camera is on the outward (right-hand) side of the edge
            ex, ey = P[nx, 0]-P[:, 0], P[nx, 1]-P[:, 1]
            face = (ey*(C[0]-P[:, 0]) - ex*(C[1]-P[:, 1])) > 0
            near = float(np.mean(zt))
            lum = city*BF[b]*math.exp(-near/(3200.0*max(1, C[2]/650)))*min(1, near/180.0)*(2.4 if hot else 1.0)*(1 + .8*sm(.82, .92, t))
            fm = int(255*BF[b])
            v_edge, v_roof = int(min(255, 150*lum)), int(min(255, 255*lum))
            for k in np.where(face)[0]:
                q = [(Xb[k], Yb[k]), (Xb[nx[k]], Yb[nx[k]]), (Xt[nx[k]], Yt[nx[k]]), (Xt[k], Yt[k])]
                di.polygon(q, fill=0); dm.polygon(q, fill=fm)
            roof = list(zip(Xt.tolist(), Yt.tolist()))
            di.polygon(roof, fill=0); dm.polygon(roof, fill=fm)
            if v_edge > 2:
                for k in np.where(face | face[np.roll(np.arange(n), 1)])[0]:   # corners of the walls that show
                    di.line([(Xb[k], Yb[k]), (Xt[k], Yt[k])], fill=v_edge)
            if v_roof > 2: di.line(roof + [roof[0]], fill=v_roof)
        M = np.asarray(CM, np.float32)/255.0
        SUP = SUP*(1 - M*min(1, city*1.4)) + np.asarray(CI, np.float32)/255.0*1.6
    if JX: SUP = SUP + splat(JX, JY, JV)
    L = SUP.reshape(H, SS, W, SS).mean(axis=(1, 3))

    # city lights (Geneva becomes the guiding star)
    lights = {}
    for k, (lo, la, hh) in ANCH.items():
        e, nn = en(lo, la); P = np.array([e, nn, hgt(e, nn)*exag + hh*max(exag, .02)]) - C
        zz = P@f
        if zz > 300:
            X = (W/2 + (FPX/SS)*(P@r)/zz); Y = (H/2 - (FPX/SS)*(P@u)/zz)
            lights[k] = [round(X, 1), round(Y, 1), round(zz)]
    yy, xx = np.mgrid[0:H, 0:W]
    for k, a in (('zurich', 0.9*(1-sm(.15, .3, t))),):
        if k in lights and a > 0:
            X, Y, _ = lights[k]
            L += a*(np.exp(-((xx-X)**2+(yy-Y)**2)/(2*1.6**2))*1.4)
    g = Image.fromarray(np.clip(L*255, 0, 255).astype(np.uint8))
    bloom = (np.asarray(g.filter(ImageFilter.GaussianBlur(3)), np.float32)/255*0.55 +
             np.asarray(g.filter(ImageFilter.GaussianBlur(16)), np.float32)/255*0.6)*(1-morph)
    A = np.clip(L+bloom, 0, 1)
    bg = np.array([5, 6, 7], np.float32)
    img = bg + A[..., None]*(np.array([255, 255, 255], np.float32)-bg)
    Image.fromarray(np.round(img).astype(np.uint8)).save(f'{OUT}/f{fi:03d}.png', compress_level=1)
    lo, la = ll(C[0], C[1])
    return {'i': fi, 'lat': round(la, 4), 'lon': round(lo, 4), 'alt': round(float(C[2])), 'hdg': round(math.degrees(psi) % 360),
            'lights': lights}

if __name__ == '__main__':
    only = [int(a) for a in sys.argv[2:]]
    idx = only or list(range(F))
    with Pool(int(os.environ.get('PROCS', 6))) as p: meta = p.map(frame, idx)
    if not only: json.dump(meta, open(f'{D}/{NAME}.json', 'w'))
    print('done', len(meta))
