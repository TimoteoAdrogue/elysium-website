/* Elysium hero, drawn live. Switzerland as scan lines from real elevation data (Mapzen Terrain Tiles), Geneva in 3D
   from OpenStreetMap, the Jet d'eau as moving spray. One WebGL2 canvas: the camera follows the scroll, so the flight is
   as smooth and as sharp as the screen. Same route, timing and look as the offline film in tools/hero-film/render.py.
   createFilm(canvas, base, portrait) -> { draw(t, time), project(key, t), state(t), resize(cssW, cssH, gridXs), lost } */

const sm = (a, b, x) => { x = Math.min(Math.max((x - a) / (b - a), 0), 1); return x * x * (3 - 2 * x); };
const lerp = (a, b, x) => a + (b - a) * x;
const TAU = Math.PI * 2;
const angl = (a, b, x) => a + ((((b - a + Math.PI) % TAU) + TAU) % TAU - Math.PI) * x;
const rad = d => d * Math.PI / 180;

// monotone cubic through the points, as scipy's PchipInterpolator
function pchip(xs, ys) {
  const n = xs.length, h = [], m = [], d = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; m[i] = (ys[i + 1] - ys[i]) / h[i]; }
  for (let k = 1; k < n - 1; k++) {
    if (m[k - 1] * m[k] <= 0) continue;
    const w1 = 2 * h[k] + h[k - 1], w2 = h[k] + 2 * h[k - 1];
    d[k] = (w1 + w2) / (w1 / m[k - 1] + w2 / m[k]);
  }
  const edge = (h0, h1, m0, m1) => {
    let e = ((2 * h0 + h1) * m0 - h0 * m1) / (h0 + h1);
    if (Math.sign(e) !== Math.sign(m0)) e = 0;
    else if (Math.sign(m0) !== Math.sign(m1) && Math.abs(e) > 3 * Math.abs(m0)) e = 3 * m0;
    return e;
  };
  d[0] = edge(h[0], h[1], m[0], m[1]); d[n - 1] = edge(h[n - 2], h[n - 3], m[n - 2], m[n - 3]);
  return x => {
    let k = 0;
    if (x >= xs[n - 1]) k = n - 2; else while (k < n - 2 && x > xs[k + 1]) k++;
    const t = (x - xs[k]) / h[k], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * h[k] * d[k] + (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * h[k] * d[k + 1];
  };
}

// timing: scroll -> leg of the route (fast over the Alps, slow past the jet and in the city); height and pitch by leg
// the flight ends over the Old Town at .66; then a slow spiral in to Elysium's HQ, looking at it, and the rise above it
const ROUTE = pchip([0, .06, .36, .45, .54, .61, .66], [0, .2, 6, 7, 8, 9, 10]);
const ALT = pchip([0, 4, 6, 7, 8, 8.9, 9.6, 10], [12500, 9000, 4200, 1500, 850, 600, 650, 650]);
const PIT = pchip([0, 4.4, 6, 7, 8, 8.9, 9.7, 10], [-22, -29, -24, -12, -11, -15, -24, -22]);
const END = .66, ORBIT = .84, PSI_M = rad(235), DV = 350, DU = 200, HALF_U = 75000, VS_MIN = -220000, VS_N = 1257;
const HV = [Math.sin(PSI_M), Math.cos(PSI_M)], AV = [Math.cos(PSI_M), -Math.sin(PSI_M)];   // along / across the scan lines

const LINE_VS = `#version 300 es
precision highp float; precision highp int;
uniform highp sampler2D u_hm; uniform vec3 u_grid; uniform ivec2 u_size;
uniform vec2 u_hv, u_av; uniform float u_vs0, u_u0, u_mode;
uniform vec3 u_cam, u_f, u_r, u_u; uniform vec4 u_proj; uniform vec2 u_px;
uniform float u_exag, u_fog, u_sweepV, u_sweepA, u_morph, u_spacing; uniform float u_gx[13]; uniform int u_ng;
out float v_i;
float hOf(ivec2 c) { vec3 t = texelFetch(u_hm, c, 0).rgb; return t.r * 6528.0 + t.g * 25.5; }
void main() {
  int line = gl_InstanceID, i = gl_VertexID;
  if (u_mode > .5) { line += i & 1; i >>= 1; }                       // occluder strip: this line and the next
  float VS = u_vs0 + float(line) * ${DV}.0, US = u_u0 + float(i) * ${DU}.0;
  vec2 P = VS * u_hv + US * u_av;
  vec2 g = (P - u_grid.xy) / u_grid.z;
  float inside = step(0.0, g.x) * step(0.0, g.y) * step(g.x, float(u_size.x - 2)) * step(g.y, float(u_size.y - 2));
  g = clamp(g, vec2(0.0), vec2(u_size - 2));
  ivec2 c = ivec2(floor(g)); vec2 fr = g - floor(g);
  int row = u_size.y - 1 - c.y;                                     // image row 0 is the north edge
  float h = mix(mix(hOf(ivec2(c.x, row)), hOf(ivec2(c.x + 1, row)), fr.x), mix(hOf(ivec2(c.x, row - 1)), hOf(ivec2(c.x + 1, row - 1)), fr.x), fr.y);
  float water = texelFetch(u_hm, ivec2(int(round(g.x)), u_size.y - 1 - int(round(g.y))), 0).b;
  vec3 d = vec3(P, h * u_exag) - u_cam;
  float zc = dot(d, u_f);
  if (u_mode > .5) { d.z -= 2.0 + max(zc, 0.0) * 0.0018; zc = dot(d, u_f); }   // the occluder sits a hair under the lines
  gl_Position = vec4(dot(d, u_r) * u_proj.x, dot(d, u_u) * u_proj.y, zc * u_proj.z + u_proj.w, zc);
  float I = exp(-zc / u_fog) * min(1.0, zc / 2500.0) * step(300.0, zc) * inside;
  I *= 1.0 + 1.8 * exp(-pow((VS - u_sweepV) / 1400.0, 2.0)) * u_sweepA;
  I *= (water > .5 ? .32 : 1.0) * .85;
  if (u_morph > 0.0 && u_mode < .5) {                               // top-down: each grid column claims its nearest line
    float x = (gl_Position.x / gl_Position.w * .5 + .5) * u_px.x, best = 1e9;
    for (int k = 0; k < 13; k++) { if (k >= u_ng) break; float dd = u_gx[k] - x; if (abs(dd) < abs(best)) best = dd; }
    if (abs(best) < u_spacing * .5) { x += best * u_morph; gl_Position.x = (x / u_px.x * 2.0 - 1.0) * gl_Position.w; I = mix(I, .08, u_morph); }
    else I *= pow(1.0 - u_morph, 1.6);
  }
  v_i = I;
}`;
const CITY_VS = `#version 300 es
precision highp float;
in vec2 a_xy; in vec2 a_hg; in vec4 a_f;
uniform vec2 u_g; uniform vec3 u_cam, u_f, u_r, u_u; uniform vec4 u_proj;
uniform float u_exag, u_city, u_cfog, u_top, u_faces;
out float v_i;
void main() {
  float h = a_hg.x * .1, g = a_hg.y * .1, fade = a_f.z / 255.0;
  vec3 d = vec3(a_xy + u_g, g * u_exag + a_f.x * h * max(u_exag, .02)) - u_cam;
  float zc = dot(d, u_f);
  gl_Position = vec4(dot(d, u_r) * u_proj.x, dot(d, u_u) * u_proj.y, zc * u_proj.z + u_proj.w, zc);
  if (u_faces > .5 && fade < .35) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // faint edge buildings do not hide anything
  v_i = u_city * fade * exp(-zc / u_cfog) * min(1.0, zc / 180.0) * (a_f.y > .5 ? 2.4 : 1.0) * u_top * mix(.6, 1.0, a_f.x);
}`;
const JET_SCALE = 1.6;                                   // drawn larger than life so it reads from the approach
const JET_VS = `#version 300 es
precision highp float;
uniform vec3 u_jet; uniform vec2 u_wind; uniform float u_time, u_exag, u_amp, u_dpr, u_halo, u_fpx;
uniform vec3 u_cam, u_f, u_r, u_u; uniform vec4 u_proj;
out float v_i;
float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
void main() {
  // the real thing: 500 l/s leave the nozzle at about 200 km/h and climb 140 m as one thin white column, leaning a
  // little with the wind; there is no crown: from the top down the spray hangs downwind as a veil that widens all the
  // way to the lake, lands about a third of the height away from the jetty and boils up there as foam
  float id = float(gl_VertexID), r0 = hash(id + 1.0), r1 = hash(id + 7.3), r2 = hash(id + 19.1), r3 = hash(id + 41.7);
  vec2 w = u_wind, n = vec2(-w.y, w.x);                  // downwind, crosswind
  const float H = 140.0, D = 58.0;
  vec3 P; float I, soft = 1.0;                           // spray and foam glow wide and soft, the column stays a crisp line
  if (id < 2600.0) {
    if (id < 500.0) {                                    // the boil at the nozzle
      float a = r1 * 6.2832, rr = 3.5 * sqrt(r2);
      P = vec3(vec2(cos(a), sin(a)) * rr, 7.0 * r3 * r3); I = .3;
    } else {                                             // foam and mist where the veil lands
      float al = D * (.05 + 1.0 * pow(r1, .8)) + 3.0 * fract(r0 + u_time / 12.0);
      P = vec3(w * al + n * (r2 - .5) * (5.0 + 16.0 * al / D), 1.0 + 9.0 * r3 * r3); I = .08;
    }
  } else if (id < 6600.0) {                              // the column: ballistic, slowing towards the top
    float v = 52.4 * mix(.93, 1.0, r1), tA = v / 9.81, tau = fract(r0 + u_time / tA) * tA;
    float z = v * tau - 4.905 * tau * tau, h = z / H, a = r2 * 6.2832;
    P = vec3(vec2(cos(a), sin(a)) * (.3 + .8 * pow(h, 3.0)) * mix(.5, 1.0, r3) + w * 4.0 * h * h, z); I = .85; soft = 0.0;
  } else {                                               // the veil: drops leave the column, mostly at the top, and drift as they fall
    float z0 = H * mix(.5, 1.0, pow(r1, .3)), s = fract(r0 + u_time / 10.0), fell = s * z0 / H, k = pow(r2, 1.4);    // dense against the column, thinning out downwind
    float dn = D * k * pow(fell, .8) + 1.5 * sin(u_time * .8 + r3 * 40.0) * s;
    P = vec3(w * (4.0 * pow(z0 / H, 2.0) + dn) + n * (r3 - .5) * (2.0 + 9.0 * s), z0 * (1.0 - s));
    I = .18 * mix(.6, 1.0, s) * (1.0 - .5 * k);
  }
  P *= ${JET_SCALE.toFixed(2)};
  vec3 d = vec3(u_jet.xy + P.xy, u_jet.z * u_exag + P.z * max(u_exag, .02)) - u_cam;
  float zc = dot(d, u_f);
  gl_Position = vec4(dot(d, u_r) * u_proj.x, dot(d, u_u) * u_proj.y, zc * u_proj.z + u_proj.w, zc);
  float px = clamp(3000.0 / max(zc, 1.0), 1.0, 3.5), ppm = u_fpx / max(zc, 1.0);   // css px per point, per metre
  // the spray keeps the same density on screen however small the jet is drawn (far away, or on a phone)
  float dens = mix(1.0, clamp(ppm * ppm / (px * px) / .21, .06, 1.0), soft);
  gl_PointSize = px * u_dpr * (u_halo > .5 ? mix(3.5, 5.0, soft) : 1.0);
  v_i = I * dens * u_amp * exp(-zc / 26000.0) * min(1.0, zc / 300.0) * (u_halo > .5 ? mix(.06, .1, soft) : 1.0);
}`;
const FS = `#version 300 es
precision mediump float; in float v_i; uniform float u_gain, u_round; out vec4 o;
void main() {
  float a = u_round > .5 ? 1.0 - smoothstep(.15, .5, length(gl_PointCoord - .5)) : 1.0;
  o = vec4(vec3(v_i * u_gain * a), 1.0);
}`;

export async function createFilm(canvas, base, portrait, v = '') {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!gl) throw new Error('no webgl2');
  const [meta, img, cityBuf] = await Promise.all([
    fetch(base + 'meta.json' + v).then(r => r.json()),
    fetch(base + 'terrain.png' + v).then(r => r.blob()).then(b => createImageBitmap(b, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })),
    fetch(base + 'city.bin' + v).then(r => r.arrayBuffer()),
  ]);
  const WP = meta.wp.slice(0, 11), NL = WP.length - 1, G = meta.geneva, HQ = meta.pins.hq;   // route: Zürich to the Old Town
  const catmull = t => {
    const s = Math.min(t * NL, NL - 1e-6), i = Math.floor(s), u = s - i;
    const p0 = WP[Math.max(i - 1, 0)], p1 = WP[i], p2 = WP[i + 1], p3 = WP[Math.min(i + 2, NL)];
    return [0, 1].map(c => .5 * (2 * p1[c] + (-p0[c] + p2[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u * u + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u * u * u));
  };
  // heading over a wide window, so turns are taken in long curves, never as a snap
  const heading = t => { const a = catmull(Math.max(t - .055, 0)), b = catmull(Math.min(t + .055, 1)); return Math.atan2(b[0] - a[0], b[1] - a[1]); };
  const pitchOff = portrait ? -8 : 0;

  // camera at scroll position t: position (E, N, alt), heading, pitch, and the scene parameters that go with it
  const routeEnd = (() => { const p = catmull(.999); return { p, psi: heading(.97), alt: ALT(NL), pit: rad(PIT(NL)) }; })();
  const lookAt = (p, alt) => {                            // heading and pitch that put the HQ in the middle of the frame
    const dx = HQ[0] - p[0], dy = HQ[1] - p[1], dz = HQ[2] + 25 - alt;
    return [Math.atan2(dx, dy), Math.atan2(dz, Math.hypot(dx, dy))];
  };
  function state(t) {
    let p, psi, alt, pit;
    if (t <= END) {
      const leg = ROUTE(t), sf = Math.min(leg / NL, 1);
      p = catmull(sf * .999); psi = heading(sf * .97); alt = ALT(leg);
      pit = rad(PIT(leg) + pitchOff * (1 - .5 * sm(7, 8, leg)));
      if (portrait) psi += rad(12) * (1 - sm(.04, .14, t));      // a phone's narrow frame turns toward Zürich to open on it
    } else {
      // spiral in to the HQ: closing from the Old Town to 650 m while circling 110 degrees, the office held in view
      // it keeps going straight in at the speed it arrived with, then bends into the circle; nothing turns at once
      const x = Math.min(Math.max((t - END) / (ORBIT - END), 0), 1), E = routeEnd;
      const v0 = [E.p[0] - HQ[0], E.p[1] - HQ[1]], r0 = Math.hypot(v0[0], v0[1]), th0 = Math.atan2(v0[0], v0[1]);
      const r = lerp(r0, 650, 1 - (1 - x) ** 2), th = th0 + rad(110) * sm(0, 1, x);
      p = [HQ[0] + r * Math.sin(th), HQ[1] + r * Math.cos(th)];
      alt = lerp(E.alt, 600, sm(0, 1, x));
      const [lpsi, lpit] = lookAt(p, alt), k = sm(END, END + .06, t);
      psi = angl(E.psi, lpsi, k); pit = lerp(E.pit + rad(pitchOff * .5), lpit, k);
      // then rise straight up over the office, looking down; the map turns slowly to the grid's direction
      const d = sm(ORBIT, .93, t);
      p = [lerp(p[0], HQ[0], d), lerp(p[1], HQ[1], d)];
      alt = lerp(alt, 15000, d ** 1.4);
      pit = lerp(pit, -Math.PI / 2 + 1e-4, sm(ORBIT + .005, .93, t));
      psi = angl(psi, PSI_M + Math.PI / 2, sm(.87, .955, t));
    }
    const f = [Math.sin(psi) * Math.cos(pit), Math.cos(psi) * Math.cos(pit), Math.sin(pit)], r = [Math.cos(psi), -Math.sin(psi), 0];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const morph = sm(.935, .99, t);
    return { C: [p[0], p[1], alt], psi, pit, f, r, u, morph, exag: lerp(1.75, 1, sm(.36, .50, t)) * (1 - sm(.85, .93, t)),
      lat: meta.lat0 + p[1] / meta.ky, lon: meta.lon0 + p[0] / meta.kx, t };
  }

  // ---- GL setup
  const compile = (vs, fs) => {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const U = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i), k = a.name.replace('[0]', ''); U[k] = gl.getUniformLocation(p, a.name); }
    return { p, U };
  };
  const PL = compile(LINE_VS, FS), PC = compile(CITY_VS, FS), PJ = compile(JET_VS, FS);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, gl.RGB, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const emptyVAO = gl.createVertexArray();

  // ---- city: each building is a bottom and a top ring; walls and roof fill the depth buffer, edges are drawn on top
  const dv = new DataView(cityBuf), nB = dv.getUint32(0, true);
  let V = 0, IF = 0, IE = 0;
  for (let b = 0, o = 4; b < nB; b++) { const k = dv.getUint8(o); V += 2 * k; IF += 6 * k + 3 * (k - 2); IE += 4 * k; o += 7 + 4 * k; }
  const xy = new Int16Array(2 * V), hg = new Uint16Array(2 * V), fl = new Uint8Array(4 * V), fi = new Uint32Array(IF), ei = new Uint32Array(IE);
  for (let b = 0, o = 4, v = 0, a = 0, e = 0; b < nB; b++) {
    const k = dv.getUint8(o), h = dv.getUint16(o + 1, true), g = dv.getUint16(o + 3, true), hot = dv.getUint8(o + 5), fade = dv.getUint8(o + 6);
    o += 7;
    for (let i = 0; i < k; i++, o += 4) {
      const x = dv.getInt16(o, true), y = dv.getInt16(o + 2, true);
      for (const top of [0, 1]) { const w = v + i + top * k; xy[2 * w] = x; xy[2 * w + 1] = y; hg[2 * w] = h; hg[2 * w + 1] = g; fl.set([top, hot, fade, 0], 4 * w); }
    }
    for (let i = 0; i < k; i++) {
      const j = (i + 1) % k, b0 = v + i, b1 = v + j, t0 = v + k + i, t1 = v + k + j;
      fi.set([b0, b1, t1, b0, t1, t0], a); a += 6;
      ei.set([t0, t1, b0, t0], e); e += 4;
    }
    for (let i = 1; i < k - 1; i++) { fi.set([v + k, v + k + i, v + k + i + 1], a); a += 3; }
    v += 2 * k;
  }
  const cityVAO = gl.createVertexArray(); gl.bindVertexArray(cityVAO);
  const attr = (name, data, size, type) => {
    const loc = gl.getAttribLocation(PC.p, name), buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, false, 0, 0);
  };
  attr('a_xy', xy, 2, gl.SHORT); attr('a_hg', hg, 2, gl.UNSIGNED_SHORT); attr('a_f', fl, 4, gl.UNSIGNED_BYTE);
  const fBuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, fi, gl.STATIC_DRAW);
  const eBuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ei, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  let W = 1, H = 1, cssW = 1, cssH = 1, scale = 1, grid = [], proj = [1, 1, 1, 0], tanH = 1, tanV = 1;
  const N = 30, F = 170000;
  function resize(w, h, gridXs) {
    cssW = w; cssH = h;
    // the screen's own pixels, capped so a large display stays fluid
    scale = Math.min(devicePixelRatio || 1, Math.sqrt(5.2e6 / (w * h)), 3);
    W = canvas.width = Math.round(w * scale); H = canvas.height = Math.round(h * scale);
    grid = gridXs.map(x => x * scale);
    const a = w / h, ref = portrait ? { th: Math.tan(rad(21)), a: 1170 / 2532 } : { th: Math.tan(rad(27.5)), a: 1.6 };   // the offline film's framing
    if (a >= ref.a) { tanH = ref.th; tanV = ref.th / a; } else { tanV = ref.th / ref.a; tanH = tanV * a; }
    proj = [1 / tanH, 1 / tanV, (F + N) / (F - N), -2 * F * N / (F - N)];
  }
  function project(key, t) {
    const S = state(t), P = meta.pins[key]; if (!P) return null;
    const top = key === 'jet' ? P[3] * JET_SCALE : P[3];
    const d = [P[0] - S.C[0], P[1] - S.C[1], P[2] * S.exag + top * Math.max(S.exag, .02) - S.C[2]];
    const zc = d[0] * S.f[0] + d[1] * S.f[1] + d[2] * S.f[2];
    if (zc < 300) return null;
    const xc = d[0] * S.r[0] + d[1] * S.r[1], yc = d[0] * S.u[0] + d[1] * S.u[1] + d[2] * S.u[2];
    return [(xc / zc / tanH * .5 + .5) * cssW, (.5 - yc / zc / tanV * .5) * cssH];
  }
  const camU = (P, S) => { gl.uniform3fv(P.U.u_cam, S.C); gl.uniform3fv(P.U.u_f, S.f); gl.uniform3fv(P.U.u_r, S.r); gl.uniform3fv(P.U.u_u, S.u); gl.uniform4fv(P.U.u_proj, proj); };

  function draw(t, time) {
    const S = state(t), alt = S.C[2];
    gl.viewport(0, 0, W, H);
    gl.clearColor(5 / 255, 6 / 255, 7 / 255, 1); gl.clearDepth(1);
    gl.depthMask(true); gl.colorMask(true, true, true, true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    // which scan lines: from 30 km behind to the haze ahead
    const vc = S.C[0] * HV[0] + S.C[1] * HV[1], far = 95000 * Math.min(Math.max(alt / 9000, .36), 1);
    const first = Math.max(0, Math.ceil((vc - 30000 - VS_MIN) / DV)), last = Math.min(VS_N - 1, Math.floor((vc + far - VS_MIN) / DV));
    const nLines = last - first + 1, uc = S.C[0] * AV[0] + S.C[1] * AV[1], u0 = Math.floor((uc - HALF_U) / DU) * DU, NU = 2 * HALF_U / DU;
    const city = sm(.34, .44, t) * (1 - S.morph);
    gl.useProgram(PL.p); camU(PL, S);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(PL.U.u_hm, 0);
    gl.uniform3f(PL.U.u_grid, meta.e0, meta.n0, meta.step); gl.uniform2i(PL.U.u_size, meta.cols, meta.rows);
    gl.uniform2fv(PL.U.u_hv, HV); gl.uniform2fv(PL.U.u_av, AV);
    gl.uniform1f(PL.U.u_vs0, VS_MIN + first * DV); gl.uniform1f(PL.U.u_u0, u0);
    gl.uniform1f(PL.U.u_exag, S.exag); gl.uniform1f(PL.U.u_fog, 52000 * Math.min(Math.max(alt / 9000, .2), 1));
    gl.uniform1f(PL.U.u_sweepV, vc + 3000 + ((t * 2.4) % 1) * 70000); gl.uniform1f(PL.U.u_sweepA, 1 - sm(.42, .52, t));
    gl.uniform1f(PL.U.u_morph, S.morph); gl.uniform2f(PL.U.u_px, W, H);
    gl.uniform1fv(PL.U.u_gx, new Float32Array(13).map((_, i) => grid[i] ?? -1e6)); gl.uniform1i(PL.U.u_ng, grid.length);
    gl.uniform1f(PL.U.u_spacing, DV * (H / 2) / (Math.max(alt, 1) * tanV));
    gl.uniform1f(PL.U.u_gain, 1.05); gl.uniform1f(PL.U.u_round, 0);
    gl.bindVertexArray(emptyVAO);
    // 1. the ground fills the depth buffer (nothing on screen), so ridges hide the lines behind them
    gl.colorMask(false, false, false, false);
    if (S.morph < 1) { gl.uniform1f(PL.U.u_mode, 1); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 2 * NU, nLines - 1); }
    // 2. so do the buildings' walls and roofs, pushed back a little so their own edges stay in front
    if (city > 0) {
      gl.useProgram(PC.p); camU(PC, S); gl.bindVertexArray(cityVAO);
      gl.uniform2fv(PC.U.u_g, G); gl.uniform1f(PC.U.u_exag, S.exag); gl.uniform1f(PC.U.u_faces, 1);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 2);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fBuf); gl.drawElements(gl.TRIANGLES, IF, gl.UNSIGNED_INT, 0);
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    // 3. lines, light added to light
    gl.colorMask(true, true, true, true); gl.depthMask(false);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(PL.p); gl.bindVertexArray(emptyVAO); gl.uniform1f(PL.U.u_mode, 0);
    gl.drawArraysInstanced(gl.LINE_STRIP, 0, NU, nLines);
    if (city > 0) {
      gl.useProgram(PC.p); gl.bindVertexArray(cityVAO); gl.uniform1f(PC.U.u_faces, 0);
      gl.uniform1f(PC.U.u_city, city); gl.uniform1f(PC.U.u_cfog, 3200 * Math.max(1, alt / 650)); gl.uniform1f(PC.U.u_top, 1 + .8 * sm(.85, .93, t));
      gl.uniform1f(PC.U.u_gain, 1.15); gl.uniform1f(PC.U.u_round, 0);
      gl.blendEquation(gl.MAX);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eBuf); gl.drawElements(gl.LINES, IE, gl.UNSIGNED_INT, 0);
      gl.blendEquation(gl.FUNC_ADD);
      // 4. the Jet d'eau: a glow, then the spray
      gl.useProgram(PJ.p); camU(PJ, S); gl.bindVertexArray(emptyVAO);
      const J = meta.pins.jet;
      gl.uniform3f(PJ.U.u_jet, J[0], J[1], J[2]); gl.uniform2f(PJ.U.u_wind, .6, -.8);
      gl.uniform1f(PJ.U.u_time, time / 1000); gl.uniform1f(PJ.U.u_exag, S.exag); gl.uniform1f(PJ.U.u_amp, city);
      gl.uniform1f(PJ.U.u_dpr, scale); gl.uniform1f(PJ.U.u_fpx, cssW / (2 * tanH)); gl.uniform1f(PJ.U.u_gain, 1.2); gl.uniform1f(PJ.U.u_round, 1);
      gl.uniform1f(PJ.U.u_halo, 1); gl.drawArrays(gl.POINTS, 0, 20000);
      gl.uniform1f(PJ.U.u_halo, 0); gl.drawArrays(gl.POINTS, 0, 20000);
    }
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    return S;
  }
  return { draw, project, state, resize, gl };
}
