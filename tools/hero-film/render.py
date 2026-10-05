# Elysium hero film, first visual: Switzerland as scan lines (real elevation), Zürich -> Alps -> Geneva,
# then top-down: relief flattens and the lines settle onto the site's 12-column grid.
import numpy as np, math, json, os, sys
from multiprocessing import Pool
from PIL import Image, ImageFilter
D = os.path.dirname(os.path.abspath(__file__))
z = np.load(f'{D}/dem.npz'); HG, WAT, GE, GN = z['h'], z['water'], z['E'], z['N']
STEP = GE[1]-GE[0]
LON0, LAT0 = 7.4, 46.6
KX, KY = 111320*math.cos(math.radians(LAT0)), 110574.0
def en(lon, lat): return np.array([(lon-LON0)*KX, (lat-LAT0)*KY])
def ll(e, n): return LON0+e/KX, LAT0+n/KY

W, H, SS = int(os.environ.get('FW', 1440)), int(os.environ.get('FH', 900)), 2
WS, HS = W*SS, H*SS
HFOV = math.radians(float(os.environ.get('HFOV', 55))); FPX = (WS/2)/math.tan(HFOV/2)
F = int(sys.argv[1]) if len(sys.argv) > 1 else 240
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
                                 (7.10, 46.33), (6.66, 46.37), (6.36, 46.29), (6.20, 46.23)]])
def catmull(t):
    n = len(WP)-1; s = min(t*n, n-1e-6); i = int(s); u = s-i
    p0, p1, p2, p3 = WP[max(i-1, 0)], WP[i], WP[i+1], WP[min(i+2, n)]
    return 0.5*((2*p1) + (-p0+p2)*u + (2*p0-5*p1+4*p2-p3)*u*u + (-p0+3*p1-3*p2+p3)*u**3)
def heading(t):
    a, b = catmull(max(t-0.03, 0)), catmull(min(t+0.03, 1))
    d = b-a; return math.atan2(d[0], d[1])
GENEVA = en(6.143, 46.204); ZURICH = en(8.541, 47.377)
ANCH = {'zurich': (8.541, 47.377), 'pilatus': (8.2525, 46.9791), 'lake': (6.60, 46.43),
        'geneva': (6.143, 46.204)}

def sm(a, b, x):  # smoothstep
    x = min(max((x-a)/(b-a), 0), 1); return x*x*(3-2*x)
def lerp(a, b, x): return a+(b-a)*x
def angl(a, b, x):  # shortest-arc angle lerp
    d = (b-a+math.pi) % (2*math.pi)-math.pi; return a+d*x

def camera(t):
    fl = min(t/0.70, 1); s = 0.5-0.5*math.cos(math.pi*fl)*0.0 + 0.0  # placeholder
    s = fl - 0.06*math.sin(2*math.pi*fl)/(2*math.pi)*0  # constant speed (scroll is the clock)
    s = fl*fl*(1.6-0.6*fl) if fl < 1 else 1.0               # soft start, full speed at the end
    p = catmull(min(s, 1)*0.97)
    psi = heading(min(s, 1)*0.97)
    alt = lerp(12500, 9000, sm(0, .45, t)) ; alt = lerp(alt, 7200, sm(.4, .7, t))
    pit = math.radians(lerp(-22, -29, sm(0, .7, t)) + float(os.environ.get('PITCH', 0)))
    # descent: crane up over Geneva, look straight down, yaw to the line direction
    d = sm(.62, .86, t)
    top = GENEVA + hv*2500
    p = p*(1-d) + top*d
    alt = lerp(alt, 15000, d)
    pit = lerp(pit, -math.pi/2+1e-4, sm(.64, .86, t))
    psi = angl(psi, PSI_M+math.pi/2, sm(.66, .88, t))
    return np.array([p[0], p[1], alt]), psi, pit

if os.environ.get('GRID') == 'm':  # phone grid: every third line, at a 390 px css width
    _k = W/390; GRID_X = [(16+358/4*k)*_k for k in range(4)] + [(16+358-1)*_k]
else:
    GRID_X = [57.6+110.4*k for k in range(12)] + [1381.4]

def frame(fi):
    t = fi/(F-1)
    C, psi, pit = camera(t)
    exag = 1.75*(1-sm(.68, .86, t))
    occ = 1-sm(.60, .72, t)                  # floating-horizon occlusion on, then off
    morph = sm(.86, .98, t)
    f = np.array([math.sin(psi)*math.cos(pit), math.cos(psi)*math.cos(pit), math.sin(pit)])
    r = np.array([math.cos(psi), -math.sin(psi), 0.0]); u = np.cross(r, f)
    vc = C[0]*hv[0]+C[1]*hv[1]
    sel = np.where((VS > vc-30e3) & (VS < vc+95e3))[0]
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
        I = np.exp(-pz/52000.0) * np.minimum(1, pz/2500.0)
        I = I*(1 + 1.8*math.exp(-((VS[sel[i]]-vs)/1400)**2)*(1-sm(.6, .7, t)))
        I = np.where(pw, I*0.32, I)
        I = I*0.85
        if morph > 0:
            if i in claim:
                px = px + claim[i]*morph
                I = I*(1-morph) + 0.08*morph
            else:
                I = I*(1-morph)**1.6
        BX.append(px[vis]); BY.append(py[vis]); BV.append(I[vis])
    buf = np.zeros(WS*HS, np.float32)
    if BX:
        px = np.concatenate(BX); py = np.concatenate(BY); v = np.concatenate(BV)*2.0
        xi, yi = px.astype(np.int64), py.astype(np.int64); fx_, fy_ = px-xi, py-yi
        mx_ = (xi >= 0) & (xi < WS-1) & (yi >= 0) & (yi < HS-1)
        xi, yi, fx_, fy_, v = xi[mx_], yi[mx_], fx_[mx_], fy_[mx_], v[mx_]
        for ox, oy, w in ((0, 0, (1-fx_)*(1-fy_)), (1, 0, fx_*(1-fy_)), (0, 1, (1-fx_)*fy_), (1, 1, fx_*fy_)):
            buf += np.bincount((yi+oy)*WS+xi+ox, weights=v*w, minlength=WS*HS).astype(np.float32)
    L = buf.reshape(HS, WS).reshape(H, SS, W, SS).mean(axis=(1, 3))
    # city lights (Geneva becomes the guiding star)
    lights = {}
    for k, (lo, la) in ANCH.items():
        e, nn = en(lo, la); P = np.array([e, nn, hgt(e, nn)*exag]) - C
        zz = P@f
        if zz > 300:
            X = (W/2 + (FPX/SS)*(P@r)/zz); Y = (H/2 - (FPX/SS)*(P@u)/zz)
            lights[k] = [round(X, 1), round(Y, 1), round(zz)]
    yy, xx = np.mgrid[0:H, 0:W]
    for k, a in (('zurich', 0.9*(1-sm(.15, .3, t))), ('geneva', sm(.45, .62, t)*(1-morph))):
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
    with Pool(10) as p: meta = p.map(frame, idx)
    if not only: json.dump(meta, open(f'{D}/{NAME}.json', 'w'))
    print('done', len(meta))
