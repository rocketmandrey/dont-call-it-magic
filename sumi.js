// "Don't Call It Magic" as ONE ensō. A red lipstick thread runs round a giant circle (R 5000 px) on one
// 12000x12000 world canvas; every image grows out of the thread (mouth line -> blade -> ensō -> iris -> tear -> heart ...),
// stays on the canvas, and the camera follows the brush tip to the next one (emaki: stop, look, unroll). Right half washi,
// left half ink-flooded (light ink on black): the song's first half goes down the light side, the second half up the dark
// side. On the last "pleasure"s the camera steps back until the whole clip reads as one unclosed ensō, sealed in its gap.
// World = cells 1080x1920 (paper + ink baked, pooled canvases, replay per cell); zoom < ZOV uses an overview baked at start.
const W = 1080, H = 1920, C = document.getElementById('c'), X = C.getContext('2d');
const INK = '#16120f', RED = '#b8231c', CRIMSON = '#a01628', LIPLINE = '#5e0c10', PAPER = '#f2ead8', DARK = '#141110', GOFUN = '#e6dccb';
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = u => (u = clamp(u), u * u * (3 - 2 * u));
const easeOut = u => (u = clamp(u), 1 - (1 - u) ** 3);
const ATK = u => 1 - (1 - u) ** 1.35, STEADY = u => 1 - (1 - u) ** 1.25, LIN = u => u;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function rng(seed) { return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = n => { n = Math.imul(n ^ n >>> 16, 0x45d9f3b); n = Math.imul(n ^ n >>> 16, 0x45d9f3b); return ((n ^ n >>> 16) >>> 0) / 4294967296; };
const vnoise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };
const vn2 = (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), h = (a, b) => hash(a * 73856093 ^ b * 19349663);
  return lerp(lerp(h(i, j), h(i + 1, j), ux), lerp(h(i, j + 1), h(i + 1, j + 1), ux), uy); };
let S, BEATS = [], HITS = [];

// ---------- world ----------
const DEG = Math.PI / 180, R0 = 5000, CX = 6000, CY = 6000, WW = 12000, CW = 1080, CH = 1920, ZOV = .55;
const ringXY = (deg, r = R0) => [CX + r * Math.sin(deg * DEG), CY - r * Math.cos(deg * DEG)];
const bndX = y => CX + 70 * (vnoise(y / 260 + 3) - .5) + 24 * (vnoise(y / 47 + 11) - .5); // ragged edge of the ink flood
const isDark = (x, y) => x < bndX(y);

// ---------- stroke geometry (bristle brush + beat pressure nodes) ----------
const cr = (a, b, c, d, u) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
function prep(st, seed) {
  st.seed = seed;
  const P = [st.pts[0], ...st.pts, st.pts.at(-1)], d = [];
  for (let i = 1; i < P.length - 2; i++) for (let k = 0; k < 12; k++) d.push([0, 1, 2].map(j => cr(P[i - 1][j], P[i][j], P[i + 1][j], P[i + 2][j], k / 12)));
  d.push(st.pts.at(-1).slice());
  const cum = [0]; for (let i = 1; i < d.length; i++) cum.push(cum[i - 1] + Math.hypot(d[i][0] - d[i - 1][0], d[i][1] - d[i - 1][1]));
  const len = cum.at(-1) || 1, step = st.step || 3.5, n = Math.max(2, Math.ceil(len / step)), Sm = [];
  const ez = st.ease || ATK, nodes = st.dur > .3 ? BEATS.filter(b => b > st.t0 + .04 && b < st.t0 + st.dur - .02).map(b => ez((b - st.t0) / st.dur)) : [];
  st.nodeAt = st.noSplat ? new Set() : new Set(nodes.map(r => Math.round(r * n)));
  for (let i = 0, j = 0; i <= n; i++) {
    const s = len * i / n; while (j < d.length - 2 && cum[j + 1] < s) j++;
    const u = clamp((s - cum[j]) / ((cum[j + 1] - cum[j]) || 1)), q = [0, 1, 2].map(k => lerp(d[j][k], d[j + 1][k], u));
    const tx = d[j + 1][0] - d[j][0], ty = d[j + 1][1] - d[j][1], tl = Math.hypot(tx, ty) || 1, r = s / len;
    const ta = st.taper ?? .6, taper = 1 - ta * (1 - (0.55 + 0.45 * smooth(r / 0.07)) * (1 - 0.75 * smooth((r - 0.78) / 0.22)));
    let k = 0; for (const rb of nodes) k += Math.exp(-(((r - rb) / (st.nodeW || .022)) ** 2));
    Sm.push({ x: q[0], y: q[1], p: q[2] * taper * (1 + .22 * (vnoise(seed * .37 + r * 7) - .5)) * (1 + Math.min(.3, 45 / st.w) * k), k, nx: -ty / tl, ny: tx / tl, r, dk: isDark(q[0], q[1]) });
  }
  const R = rng(seed * 7919 + 13), nb = st.nb || Math.round(clamp(st.w / 3.2, 8, 120)), br = [];
  const nc = Math.max(3, Math.round(nb / 9)), cs = Array.from({ length: nc }, () => (R() * 1e6) | 0);
  for (let i = 0; i < nb; i++) { const o = (i + R()) / nb * 2 - 1; br.push({ c: cs[Math.min(nc - 1, Math.floor((o + 1) / 2 * nc))], o: o + (R() - .5) * .05, ink: (st.load ?? 1) * (0.7 + 0.5 * R()) * (1 - 0.35 * o * o), r: R(), f: 0.02 + 0.08 * R(), seed: (R() * 1e6) | 0, jit: (R() - .5) * .6 }); }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of Sm) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const m = st.w + 200; st.bb = [x0 - m, y0 - m, x1 + m, y1 + m];
  Object.assign(st, { S: Sm, br, len, n, bw: clamp(st.w / nb * 1.9, 1.6, 8) });
}
// colour follows the paper under the brush: ink on washi (multiply), light gofun on the black half (source-over)
const colAt = (col, dk) => col === INK && dk ? GOFUN : col;
function drawStep(g, st, i) {
  const a = st.S[i - 1], b = st.S[i], dk = b.dk, col = colAt(st.col || INK, dk), light = col === GOFUN;
  g.save(); g.globalCompositeOperation = st.over || dk ? 'source-over' : 'multiply'; g.strokeStyle = col; g.fillStyle = col;
  if (st.wet) {
    const wr = 1 - 0.7 * Math.pow(b.r, 2) * (st.dry ?? .3);
    g.lineCap = 'round'; g.globalAlpha = st.wet * 0.5 * wr; g.lineWidth = st.w * b.p * 0.62; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  }
  g.lineCap = 'round'; g.lineWidth = st.bw;
  const dry = st.dry ?? 0.3, spread = 1 + Math.min(.25, 30 / st.w) * vnoise(i * 0.05 + st.n), al = st.alpha ?? (light ? .6 : .5);
  for (const h of st.br) {
    const ink = h.ink * (1 + .5 * b.k) * (1 - dry * Math.pow(b.r, 1.4) * (0.4 + 1.2 * h.r)), nz = .45 * vnoise(h.seed + i * st.bw * h.f * 2.5) + .55 * vnoise(h.c + i * .045);
    if (ink * (0.5 + 1.0 * nz) < 0.36 || vnoise(h.seed * .01 + i * .09) < .1 + .25 * dry * b.r) continue;
    const wa = h.o * spread + h.jit * 0.08 + .06 * (vnoise(h.seed + i * .02) - .5), wb = wa + .06 * (vnoise(h.seed + (i + 1) * .02) - vnoise(h.seed + i * .02));
    const oa = wa * st.w * a.p / 2, ob = wb * st.w * b.p / 2;
    g.globalAlpha = clamp(ink) * al * (0.55 + 0.6 * vnoise(h.c + 7 + i * .03));
    g.beginPath(); g.moveTo(a.x + a.nx * oa, a.y + a.ny * oa); g.lineTo(b.x + b.nx * ob, b.y + b.ny * ob); g.stroke();
  }
  g.restore();
  if (st.nodeAt.has(i)) splat(g, b.x, b.y, 5, st.w * .7 + 20, st.seed * 31 + i, st.col || INK, clamp(st.w / 150, .3, 1));
}
function splat(g, cx, cy, n, spread, seed, col = INK, size = 1) { // flicked ink: blobs + satellites + streaks outward
  const R = rng(seed), dk = isDark(cx, cy); col = colAt(col, dk);
  g.save(); g.globalCompositeOperation = dk ? 'source-over' : 'multiply'; g.fillStyle = col; g.strokeStyle = col;
  for (let i = 0; i < n; i++) {
    const an = R() * 6.283, d = spread * Math.pow(R(), 0.6), x = cx + Math.cos(an) * d, y = cy + Math.sin(an) * d * 1.1, r = size * (2 + 16 * Math.pow(R(), 3));
    g.globalAlpha = 0.75 + 0.25 * R(); g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    if (R() < .5) { g.lineWidth = r * .6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(an) * r * 3, y - Math.sin(an) * r * 3); g.stroke(); }
    for (let k = 0; k < 3; k++) { const e = d + r * (1.5 + 3 * R()); g.beginPath(); g.arc(cx + Math.cos(an + (R() - .5) * .1) * e, cy + Math.sin(an + (R() - .5) * .1) * e * 1.1, r * .25 * R() + .8, 0, 7); g.fill(); }
  }
  g.restore();
}

function spray(g, x, y, dx, dy, n, len, seed, col = INK, size = 1) { // dry flicked drops with tails, fanning in the throw direction
  const R = rng(seed), dk = isDark(x, y), c = colAt(col, dk), a0 = Math.atan2(dy, dx);
  g.save(); g.globalCompositeOperation = dk ? 'source-over' : 'multiply'; g.fillStyle = c; g.strokeStyle = c; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = a0 + (R() - .5) * (R() < .8 ? 1.1 : 2.4), d = len * (.1 + .9 * Math.pow(R(), .7)), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d, ca = Math.cos(a), sa = Math.sin(a);
    const r = size * (1.2 + 12 * Math.pow(R(), 2.6)) * (1.15 - .6 * d / len), tl = r * (3 + 7 * R());
    g.globalAlpha = .75 + .25 * R(); g.beginPath(); g.ellipse(px, py, r * (1.15 + .9 * R()), r, a, 0, 6.2832); g.fill();
    g.lineWidth = r * .75; g.beginPath(); g.moveTo(px, py); g.lineTo(px - ca * tl * .45, py - sa * tl * .45); g.stroke();
    g.lineWidth = r * .3; g.beginPath(); g.moveTo(px - ca * tl * .45, py - sa * tl * .45); g.lineTo(px - ca * tl, py - sa * tl); g.stroke();
    if (R() < .6) { const e = r * (2.2 + 3 * R()); g.beginPath(); g.arc(px + ca * e, py + sa * e, r * .3 + .6, 0, 6.2832); g.fill(); }
  }
  g.restore();
}

// ---------- paper (tileable, no vignette: the vignette is a screen overlay) ----------
function buildPaper(bg, fibreDark, fibreLight, seed) {
  const c = mk(CW, CH), g = c.getContext('2d'), R = rng(seed);
  g.fillStyle = bg; g.fillRect(0, 0, CW, CH);
  const im = g.getImageData(0, 0, CW, CH), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - .5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n * .9; }
  g.putImageData(im, 0, 0);
  for (let i = 0; i < 2600; i++) {
    const x = R() * CW, y = R() * CH, a = R() * 6.28, l = 20 + R() * 90;
    g.strokeStyle = R() < .6 ? fibreDark(R()) : fibreLight(R()); g.lineWidth = .5 + R() * 1.2;
    for (const [ox, oy] of [[0, 0], [-CW, 0], [0, -CH], [-CW, -CH]]) { // wrap so tiles meet without seams
      g.beginPath(); g.moveTo(x + ox, y + oy); g.quadraticCurveTo(x + ox + Math.cos(a + 1) * l * .5, y + oy + Math.sin(a + 1) * l * .5, x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke();
    }
  }
  return c;
}
let PAPER_L, PAPER_D, VIG;
function paintPaper(g, x0, y0, w, h) { // world rect, g already transformed to world
  const tx0 = Math.floor(x0 / CW), ty0 = Math.floor(y0 / CH), tx1 = Math.floor((x0 + w - 1) / CW), ty1 = Math.floor((y0 + h - 1) / CH);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) g.drawImage(PAPER_L, tx * CW, ty * CH, CW + 4, CH + 4);
  if (x0 > CX + 80) return;
  g.save(); g.beginPath(); g.moveTo(x0 - 20, y0 - 20); for (let y = y0 - 20; y <= y0 + h + 20; y += 12) g.lineTo(bndX(y), y); g.lineTo(x0 - 20, y0 + h + 20); g.closePath(); g.clip();
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= Math.min(tx1, Math.floor(CX / CW) + 1); tx++) g.drawImage(PAPER_D, tx * CW, ty * CH, CW + 4, CH + 4);
  g.restore();
}

// ---------- shapes (local 1080x1920 frame coords; a station maps them onto the ring) ----------
// brush lips = 2 upper strokes meeting at the cupid's bow + one fat lower crescent (+ the mouth line, usually the thread)
function lipsSpec(cx, cy, w, col = RED) {
  const s = w / 640, P = pts => pts.map(([x, y, p]) => [cx + x * s, cy + y * s, p]);
  return [
    { pts: P([[-322, 2, .12], [-240, -24, .5], [-140, -56, .95], [-78, -66, 1], [-30, -50, .85], [10, -42, .7]]), w: 92 * s, col, dry: .5, wet: .5, load: 1.2, taper: .5, dur: .2 },
    { pts: P([[322, 2, .12], [240, -24, .5], [140, -56, .95], [78, -66, 1], [30, -50, .85], [-10, -42, .7]]), w: 92 * s, col, dry: .5, wet: .5, load: 1.2, taper: .5, dur: .2 },
    { pts: P([[-310, 10, .1], [-210, 44, .6], [-90, 72, 1], [0, 76, 1], [90, 72, 1], [210, 44, .6], [310, 10, .1]]), w: 132 * s, col, dry: .9, wet: .45, load: 1.25, taper: .5, dur: .3 },
    { pts: P([[-326, 1, .5], [-170, 8, 1], [-40, 12, 1], [0, 18, 1], [40, 12, 1], [170, 8, 1], [326, 1, .5]]), w: 13 * s, col: LIPLINE, dry: .2, alpha: .8, taper: .3, dur: .25 },
  ];
}
const tf = (specs, cx, cy, sc, rot, ox = 0, oy = 0) => { const c = Math.cos(rot), s = Math.sin(rot); return specs.map(o => ({ ...o, w: o.w * sc, pts: o.pts.map(([x, y, p]) => [cx + ((x - ox) * c - (y - oy) * s) * sc, cy + ((x - ox) * s + (y - oy) * c) * sc, p]) })); };
const flipY = (specs, cy = 960) => specs.map(s => ({ ...s, pts: s.pts.map(([x, y, p]) => [x, 2 * cy - y, p]) }));
const rev = s => ({ ...s, pts: s.pts.slice().reverse() });
const arcPts = (cx, cy, rx, ry, a0, a1, n, p = [1, 1]) => Array.from({ length: n + 1 }, (_, k) => { const u = k / n, a = lerp(a0, a1, u) * DEG; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, lerp(p[0], p[1], u)]; });
function enso(cx, cy, r, gapDeg, gapAt, seed) { // clockwise, never closed
  const g = gapDeg * DEG, a0 = gapAt + g / 2, a1 = gapAt + 2 * Math.PI - g / 2, N = 30, pts = [];
  for (let k = 0; k <= N; k++) { const u = k / N, a = lerp(a0, a1, u), rr = r * (1 + .06 * (vnoise(seed + u * 4) - .5) - .025 * u); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, (u < .04 ? 1.1 : 1) * lerp(1, .72, u)]); }
  return { pts, gx: cx + Math.cos(gapAt) * r, gy: cy + Math.sin(gapAt) * r };
}
function offsetPts(pts, d) { return pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1; return [p[0] - ty / l * d, p[1] + tx / l * d, p[2]]; }); }
const SHAPE = {
  profile: () => { const Pr = [ // woman's profile facing right: contour in 5 chained strokes, closed eye, hair masses, red lips
    { pts: [[455, 470, .5], [540, 520, .9], [598, 610, 1], [618, 720, 1], [612, 762, .9]], w: 30, taper: 0, dry: .4 },
    { pts: [[611, 750, .9], [597, 796, .8], [614, 842, 1], [652, 892, 1], [694, 936, .95], [676, 958, .7]], w: 30, taper: 0, dry: .4 },
    { pts: [[684, 950, .7], [648, 968, .85], [640, 992, .8], [666, 1012, .9], [648, 1034, .7], [668, 1060, .9], [640, 1098, .8]], w: 26, taper: 0, dry: .3 },
    { pts: [[646, 1090, .8], [666, 1140, 1], [650, 1186, 1], [600, 1212, .9], [535, 1222, .4]], w: 30, taper: 0, dry: .5 },
    { pts: [[588, 1228, .9], [572, 1330, 1], [580, 1500, .3]], w: 24, dry: .8 },
    { pts: [[528, 816, .5], [562, 824, 1], [596, 814, .5]], w: 16, dry: .2 },
    { pts: [[490, 468, .6], [380, 468, 1], [300, 560, 1], [268, 760, 1], [300, 1000, .9], [255, 1260, .3]], w: 120, dry: 1.2, wet: .4, alpha: .55, load: 1.15, dur: .5 },
    { pts: [[440, 500, .5], [345, 610, 1], [335, 860, .9], [395, 1090, .3]], w: 80, dry: 1.3, alpha: .55, dur: .4 },
    { pts: [[655, 1012, .6], [646, 1034, 1], [660, 1058, .6]], w: 36, col: RED, wet: .6, taper: .3 },
    ]; windblown(Pr); return Pr; },
  dagger: pts => tf([
    { pts: [[-60, -40, .9], [-56, 220, 1], [-32, 420, .8], [0, 560, .2]], w: 28, taper: .2, dry: .5 },
    { pts: [[60, -40, .9], [54, 220, 1], [30, 420, .8], [0, 560, .2]], w: 28, taper: .2, dry: .5 },
    { pts: [[-210, -70, .6], [-100, -56, 1], [0, -52, 1], [100, -56, 1], [210, -70, .6]], w: 66, dry: .9, wet: .3 },
    { pts: [[0, -95, 1], [0, -200, 1], [0, -315, 1]], w: 80, wet: .5, dry: .6, taper: .15 },
    { pts: [[0, -330, .6], [0, -372, 1], [0, -400, .5]], w: 96, taper: .3, wet: .6 },
    { pts: pts || [[0, 585, .25], [0, 660, 1]], w: 50, col: RED, wet: .8, taper: .3, load: 1.3 },
  ], 540, 900, 1.05, .38),
  eye: () => tf([ // an angry eye (the ensō is its iris): slanted brow, heavy upper lid, lower lid, pupil, lashes
    { pts: [[245, 770, 1], [520, 722, 1], [835, 615, .25]], w: 74, dry: 1.1, wet: .3 },
    { pts: [[240, 935, .3], [380, 852, .9], [560, 820, 1], [720, 850, .9], [845, 918, .35]], w: 48, dry: .6, wet: .3 },
    { pts: [[270, 952, .3], [430, 1002, .8], [600, 1008, .8], [800, 930, .3]], w: 22, dry: .5 },
    { pts: [[545, 888, .9], [545, 926, 1]], w: 88, wet: .9, taper: .1, load: 1.3 },
    { pts: [[655, 832, .8], [700, 760, .15]], w: 18 }, { pts: [[728, 850, .8], [790, 786, .15]], w: 18 },
    { pts: [[785, 876, .8], [860, 826, .15]], w: 18 }, { pts: [[822, 900, .7], [900, 878, .15]], w: 16 },
  ], 540, 900, 2, 0, 545, 905),
  heart: (dx = 0, col = RED, w = 124) => [ // two lobes from the cleft down to the tip
    rev({ pts: [[540, 1265, .35], [400, 1110, .9], [290, 930, 1], [318, 780, .9], [440, 728, .9], [528, 790, .8], [556, 830, .5]].map(([x, y, p]) => [x - dx, y, p]), w, col, dry: .9, wet: .5, load: 1.2, dur: .3 }),
    rev({ pts: [[540, 1265, .35], [680, 1110, .9], [790, 930, 1], [762, 780, .9], [640, 728, .9], [552, 790, .8], [524, 830, .5]].map(([x, y, p]) => [x + dx, y, p]), w, col, dry: .9, wet: .5, load: 1.2, dur: .3 }),
  ],
  crack: () => [{ pts: [[540, 800, .6], [505, 900, 1], [575, 990, 1], [505, 1100, 1], [548, 1260, .4]], w: 20, dry: .3, taper: .2, dur: .12 }],
  snake: () => flipY([ // S body in one stroke (head at the bottom, striking down), diamond head
    { pts: [[830, 1660, .1], [660, 1585, .5], [430, 1480, .85], [360, 1330, 1], [430, 1228, 1], [680, 1120, 1], [742, 980, 1], [702, 862, 1], [480, 772, .95], [440, 660, .85]], w: 96, dry: .9, taper: .3, dur: .9, ease: STEADY },
    { pts: [[440, 660, .7], [468, 585, 1.25], [515, 530, .95], [545, 505, .4]], w: 112, dry: .3, wet: .6, taper: .1 },
    { pts: [[476, 572, .7], [488, 580, 1]], w: 26, col: RED, taper: 0 },
    { pts: [[545, 502, .9], [585, 455, .6]], w: 14, col: RED, taper: .2 }, { pts: [[585, 455, .6], [596, 405, .2]], w: 12, col: RED }, { pts: [[585, 455, .6], [640, 435, .2]], w: 12, col: RED },
  ]),
  petals: () => [
    { pts: arcPts(540, 730, 108, 100, 250, 110, 10, [.4, 1]), w: 74, dry: .8, wet: .5, load: 1.2 },
    { pts: arcPts(540, 730, 108, 100, -70, 70, 10, [.4, 1]), w: 74, dry: .8, wet: .5, load: 1.2 },
    { pts: [[405, 770, .4], [470, 858, 1], [610, 858, 1], [675, 770, .4]], w: 84, dry: .8, wet: .5, load: 1.2 },
    { pts: [[400, 640, .3], [345, 760, 1], [420, 885, .5]], w: 60, dry: 1 },
    { pts: [[680, 640, .3], [735, 760, 1], [660, 885, .5]], w: 60, dry: 1 },
  ],
  leaves: () => [
    { pts: [[532, 1180, .2], [440, 1140, 1], [350, 1165, .1]], w: 76, taper: .9, dry: .7, wet: .3 },
    { pts: [[546, 1330, .2], [640, 1285, 1], [728, 1300, .1]], w: 76, taper: .9, dry: .7, wet: .3 },
    { pts: [[532, 1050, .8], [498, 1028, .2]], w: 16 }, { pts: [[543, 1420, .8], [578, 1398, .2]], w: 16 },
  ],
  cracks: (ix, iy, seed) => { const R = rng(seed), out = [];
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283 + R() * .5, L = 120 + 190 * R(), pts = [[ix, iy, 1]];
      for (let j = 1; j <= 3; j++) { const r = L * j / 3, aj = a + (R() - .5) * .35; pts.push([ix + Math.cos(aj) * r, iy + Math.sin(aj) * r * 1.2, 1 - j * .25]); }
      out.push({ pts, w: 10, dry: .2, taper: .1, dur: .08, col: GOFUN, alpha: .75, over: 1 }); }
    return out; },
  grave: () => [
    { pts: [[80, 1450, .6], [260, 1440, 1], [480, 1455, .8], [700, 1438, 1], [1000, 1452, .5]], w: 110, wet: .4, load: 1.2, dry: 1.4, taper: .25, dur: .3 },
    { pts: [[235, 1362, .25], [420, 1262, 1], [660, 1262, 1], [845, 1362, .25]], w: 110, dry: .9, wet: .4 },
    { pts: [[405, 900, .75], [540, 892, 1], [675, 903, .65]], w: 62, dry: .9, wet: .3, taper: .2 },
  ],
  apple: () => tf([ // red fill (the thread scribbles inside the ensō) + crimson shading
    { pts: [[548, 808, .45], [420, 762, 1], [308, 885, 1], [318, 1105, 1], [432, 1242, .9], [546, 1228, .45]], w: 200, col: RED, dry: .2, wet: .85, load: 1.4, dur: .35 },
    { pts: [[532, 808, .45], [660, 762, 1], [772, 885, 1], [762, 1105, 1], [648, 1242, .9], [534, 1228, .45]], w: 200, col: RED, dry: .2, wet: .85, load: 1.4, dur: .35 },
    { pts: [[545, 850, .5], [545, 1040, 1], [545, 1210, .5]], w: 250, col: RED, dry: .9, wet: .4, alpha: .85, load: 1.2 },
    { pts: [[470, 850, .2], [380, 960, 1], [400, 1110, .3]], w: 110, col: CRIMSON, dry: 1.1, alpha: .6 },
    { pts: [[610, 850, .2], [700, 960, 1], [680, 1110, .3]], w: 110, col: CRIMSON, dry: 1.1, alpha: .6 },
  ], 540, 985, 1.1, 0, 540, 1010),
  horseshoe: () => [
    { pts: [[398, 640, .7], [350, 850, 1], [378, 1100, 1], [468, 1250, 1], [548, 1284, .9]], w: 124, dry: 1.1, wet: .3, taper: .1, dur: .35 },
    { pts: [[682, 640, .7], [730, 850, 1], [702, 1100, 1], [612, 1250, 1], [532, 1284, .9]], w: 124, dry: 1.1, wet: .3, taper: .1, dur: .35 },
    { pts: [[372, 600, .6], [430, 604, 1]], w: 70, taper: 0 }, { pts: [[650, 604, 1], [708, 600, .6]], w: 70, taper: 0 },
  ],
  glass: () => [
    { pts: [[368, 600, .8], [362, 760, 1], [420, 905, 1], [540, 962, .8]], w: 30, dry: .4, taper: .1 },
    { pts: [[712, 600, .8], [718, 760, 1], [660, 905, 1], [540, 962, .8]], w: 30, dry: .4, taper: .1 },
    { pts: [[368, 600, .6], [540, 570, .9], [712, 600, .6]], w: 16, taper: .2 }, { pts: [[368, 600, .6], [540, 632, .9], [712, 600, .6]], w: 18, taper: .2 },
    { pts: [[540, 962, 1], [540, 1160, .8], [540, 1360, .9]], w: 26, taper: .1 },
    { pts: [[375, 1392, .5], [540, 1372, 1], [705, 1392, .5]], w: 38, taper: .3 },
  ],
  wine: () => [[925, 468, 612], [878, 418, 662], [826, 388, 692], [772, 372, 708], [715, 368, 712]].map(([y, a, b], k) => ({ pts: k % 2 ? [[b - 6, y, .8], [(a + b) / 2, y + 6, 1], [a + 6, y, .8]] : [[a + 6, y, .8], [(a + b) / 2, y + 6, 1], [b - 6, y, .8]], w: 62, col: RED, wet: .7, dry: .5, taper: .1, ease: LIN, dur: .22, load: 1.2 })),
};

function windblown(Pr) { // the face tilted chin-up (breathing in), hair streaming back in long dry strokes
  for (const i of [0, 1, 2, 3, 5, 8]) Pr[i] = tf([Pr[i]], 600, 1250, 1, -.14, 600, 1250)[0];
  Pr[4] = { pts: [[588, 1228, .9], [578, 1360, 1], [586, 1560, .2]], w: 24, dry: .8 };
  Pr[6] = { pts: [[500, 474, .8], [380, 500, 1], [250, 600, 1], [140, 800, .9], [40, 1060, .7], [-60, 1320, .5], [-200, 1560, .2]], w: 130, dry: 1.5, wet: .3, alpha: .6, taper: .3, dur: .5, ease: STEADY };
  Pr[7] = { pts: [[440, 600, .7], [360, 760, 1], [300, 980, .9], [220, 1240, .7], [110, 1500, .5], [-20, 1720, .15]], w: 90, dry: 1.6, alpha: .55, taper: .3, dur: .5, ease: STEADY };
}
// ---------- program: items on the world canvas ----------
const ITEMS = [], FOLLOW = [], TL = 114.9; // TL: items at/after this time also go into the live overview
let SEED = 1;
const TH = { col: RED, w: 34, taper: 0, dry: .45, wet: .35, load: 1.2, thread: 1, ease: STEADY, noSplat: 1, nodeW: .012 };
function brushAt(t0, spec) { const it = { kind: 'brush', dur: .22, ...spec, t0 }; prep(it, SEED++); ITEMS.push(it); return it; }
const B = (at, spec) => brushAt(at - (spec.lead ?? .3) * (spec.dur ?? .22), spec); // the mass of the stroke lands on `at`
function station(deg, o = {}) { const [px, py] = ringXY(deg); return { deg, ox: px - 540, oy: py - 960, z: o.z ?? 1, fy: o.fy ?? 930 }; }
const P = (s, x, y, p = 1) => [x + s.ox, y + s.oy, p];
const L = (s, spec) => ({ ...spec, pts: spec.pts.map(([x, y, p]) => P(s, x, y, p ?? 1)) });
const seq = (s, times, specs, o = {}) => specs.map((sp, i) => B(times[i], L(s, { ...sp, ...o })));
const viaRing = (dA, dB, k, wob) => Array.from({ length: k }, (_, i) => [...ringXY(lerp(dA, dB, (i + 1) / (k + 1)), R0 + (i % 2 ? wob : -wob)), 1]);
function go(t0, t1, a, b, pts, o = {}) { const lk = brushAt(t0, { ...TH, dur: t1 - t0, pts, ...o }); if (a) FOLLOW.push({ t0, t1, lk, a, b, mid: o.mid }); return lk; }
const ev = (t0, bb, fn) => ITEMS.push({ kind: 'ev', t0, dur: 0, n: 1, bb, fn });
const burnAt = (t0, dur, x, y, rx, ry, seed) => { const it = { kind: 'burn', t0, dur, n: 22, x, y, rx, ry, seed, bb: [x - rx * 1.6, y - ry * 1.6, x + rx * 1.6, y + ry * 1.6] }; ITEMS.push(it); BURNS.push(it); };
const splatAt = (t0, x, y, n, spread, seed, col, size = 1) => ev(t0, [x - spread * 2, y - spread * 2, x + spread * 2, y + spread * 2], g => splat(g, x, y, n, spread, seed, col, size));
const PUSH = [], BURNS = [];
const push = (t, z, hold, x, y) => PUSH.push({ t, z, hold, x, y }); // camera close-up on a hit (world focus)
const sprayAt = (t0, x, y, dx, dy, n, len, seed, col = INK, size = 1) => ev(t0, [x - len * 1.4, y - len * 1.4, x + len * 1.4, y + len * 1.4], g => spray(g, x, y, dx, dy, n, len, seed, col, size));
function bleedAt(t0, dur, x, y, rx, ry, col, seed, nw = 110) { // "curse": ink creeps along the paper fibres from a rim, branching veins
  const R = rng(seed), wk = [], N = 15, walk = (px, py, a, s0, w) => { const pts = [[px, py]]; for (let j = s0; j < N; j++) { a += (R() - .5) * .7; const l = 4 + 9 * R(); px += Math.cos(a) * l; py += Math.sin(a) * l * .85; pts.push([px, py]);
      if (R() < .06 && w > 1.6) walk(px, py, a + (R() < .5 ? -.7 : .7), j + 1, w * .6); } wk.push({ pts, s0, w }); };
  for (let i = 0; i < nw; i++) { const a = i / nw * 6.2832 + R() * .25; walk(x + Math.cos(a) * rx * (.97 + .06 * R()), y + Math.sin(a) * ry * (.97 + .06 * R()), a + (R() - .5) * .9, (R() * 5) | 0, 1.5 + 4 * R()); }
  const m = N * 22; ITEMS.push({ kind: 'bleed', t0, dur, n: N, wk, col, bb: [x - rx - m, y - ry - m, x + rx + m, y + ry + m] });
}
function bleedStep(g, it, k) {
  g.save(); g.lineCap = 'round';
  for (const w of it.wk) { const i = k - w.s0; if (i < 1 || i >= w.pts.length) continue; const [ax, ay] = w.pts[i - 1], [bx, by] = w.pts[i], dk = isDark(bx, by), c = colAt(it.col, dk), f = 1 - i / w.pts.length * .8;
    g.globalCompositeOperation = dk ? 'source-over' : 'multiply'; g.strokeStyle = c;
    g.globalAlpha = .09; g.lineWidth = w.w * f * 4; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    g.globalAlpha = .55; g.lineWidth = w.w * f; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
  g.restore();
}
// ---------- helpers ----------
function blotAt(t0, x, y, r, seed, col = RED) { // a live cinnabar blot: it spreads in steps, pools darker at the edge, throws drops and runs
  ITEMS.push({ kind: 'blot', t0, dur: .3, n: 10, x, y, r, seed, col, bb: [x - r * 2, y - r * 2, x + r * 2, y + r * 3] });
  sprayAt(t0 + .02, x, y, 1, -.4, 18, r * 2.2, seed + 1, col, 1); sprayAt(t0 + .02, x, y, -1, .3, 12, r * 1.6, seed + 2, col, .8);
  brushAt(t0 + .3, { pts: [[x + r * .15, y + r * .7, 1], [x + r * .18, y + r * 1.4, .7], [x + r * .16, y + r * 1.9, .9]], w: r * .22, col, wet: .9, dry: .1, taper: .1, dur: .6, ease: STEADY, noSplat: 1 });
}
function blotPath(g, it, q) { g.beginPath(); for (let a = 0; a <= 90; a++) { const an = a / 90 * 6.2832, c = Math.cos(an), sn = Math.sin(an), k = 1 + .35 * (vn2(it.seed + c * 1.3, sn * 1.3) - .5) + .18 * (vn2(it.seed + c * 5, sn * 5 + 4) - .5); g.lineTo(it.x + c * it.r * q * k, it.y + sn * it.r * q * k * .9); } g.closePath(); }
function blotStep(g, it, k) { const q = easeOut(k / it.n), dk = isDark(it.x, it.y); g.save(); g.globalCompositeOperation = dk ? 'source-over' : 'multiply'; g.fillStyle = it.col; g.globalAlpha = .32; blotPath(g, it, q); g.fill();
  if (k === it.n) { g.strokeStyle = '#6e0d0a'; g.globalAlpha = .45; g.lineWidth = it.r * .07; blotPath(g, it, q * .97); g.stroke(); g.globalAlpha = .6; g.fillStyle = it.col; blotPath(g, it, q * .8); g.fill(); } g.restore(); }
function tongueAt(t, s, x0, y0, h, b, lean, curl, seed) { // one painted flame tongue: cinnabar body, hot core, ink contours flicking into a hooked tip
  const R = rng(seed), sway = (R() - .5) * b * .5, c = u => [s.ox + x0 + lean * u * u + sway * Math.sin(u * Math.PI * 1.3) + curl * b * .9 * Math.pow(clamp((u - .7) / .3), 2), s.oy + y0 - h * u], hw = u => b / 2 * Math.pow(1 - u, .85) * (1 + .4 * Math.sin(u * Math.PI)) * (.35 + .65 * smooth(u / .18)); // rounded base, no flat cut
  const N = 16, lf = [], rt = []; for (let k = 0; k <= N; k++) { const u = k / N, [x, y] = c(u); lf.push([x - hw(u), y]); rt.push([x + hw(u), y]); }
  const x = s.ox + x0, y = s.oy + y0, poly = (f) => { const q = []; for (let k = 0; k <= N; k++) { const u = k / N, [cx, cy] = c(u); q.push([cx - hw(u) * f, cy]); } for (let k = N; k >= 0; k--) { const u = k / N, [cx, cy] = c(u); q.push([cx + hw(u) * f, cy]); } return q; };
  const body = poly(1), core = poly(.42).map(([px, py]) => [px, py + h * .06]);
  ev(t + .06, [x - b - h, y - h * 1.2, x + b + h, y + b], g => { const dk = isDark(x, y); g.save(); g.globalCompositeOperation = dk ? 'source-over' : 'multiply';
    for (const [pg, col, a] of [[body, RED, .88], [core, '#e2682e', dk ? .75 : .55]]) { g.globalAlpha = a; g.fillStyle = col; g.beginPath(); pg.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.closePath(); g.fill(); }
    g.restore(); });
  const wl = clamp(b * .16, 8, 22);
  brushAt(t, { pts: lf.filter((_, k) => k % 2 === 0).map(([px, py], k, a) => [px, py, lerp(1, .15, k / (a.length - 1))]), w: wl, col: INK, dry: .8, wet: .2, taper: .3, dur: .14, ease: ATK, noSplat: 1 });
  brushAt(t + .04, { pts: rt.filter((_, k) => k % 2 === 0).map(([px, py], k, a) => [px, py, lerp(.9, .1, k / (a.length - 1))]), w: wl * .8, col: INK, dry: .9, wet: .2, taper: .3, dur: .14, ease: ATK, noSplat: 1 });
}
function flameAt(times, s, bx, by, H, Wd, seed) { // fire painted by the brush: tongues tearing upwards, each beat a taller layer, dry ink smoke curls
  const R = rng(seed);
  times.forEach((t, j) => { const g1 = (j + 1) / times.length, n = 3 + j * 2;
    for (let i = 0; i < n; i++) { const e = n > 1 ? i / (n - 1) * 2 - 1 : 0, h = H * (.45 + .55 * g1) * (1 - .45 * e * e) * (.8 + .3 * R()), b = Wd * (.5 + .25 * g1) * (1 - .3 * Math.abs(e)) * (.8 + .3 * R());
      tongueAt(t + Math.abs(e) * .06, s, bx + e * Wd * (.45 + .3 * g1), by, h, b, e * h * .28, (e >= 0 ? 1 : -1) * (.6 + .6 * R()), seed * 50 + j * 10 + i); }
    for (let i = 0; i < 2; i++) { const sx = bx + (R() - .5) * Wd * .8, sy = by - H * (.9 + .12 * j), r = 30 + 40 * R(), dir = R() < .5 ? -1 : 1, pts = [];
      for (let k = 0; k <= 12; k++) { const a = k / 12 * 5, rr = r * (1 - k / 16); pts.push([sx + dir * Math.sin(a) * rr + dir * k * 5, sy - k * 30 - Math.cos(a) * rr * .45, .9 - k * .05]); }
      B(t + .2, L(s, { pts, w: 20 + 10 * R(), col: INK, alpha: .38, dry: 1.2, wet: 0, taper: .4, dur: .6, ease: STEADY, noSplat: 1 })); } });
}
function rimFlames(t, s, cx, cy, rx, ry, seed, n = 7) { // small tongues left licking round the upper rim of the hole
  const R = rng(seed); for (let i = 0; i < n; i++) { const a = (-155 + 130 * i / (n - 1) + (R() - .5) * 8) * DEG, h = 90 + 90 * R() * (1 - Math.abs(Math.cos(a)) * .4);
    tongueAt(t + i * .04, s, cx + Math.cos(a) * rx * .98, cy + Math.sin(a) * ry * .98 + 10, h, 46 + 20 * R(), Math.cos(a) * h * .45, Math.cos(a) >= 0 ? 1 : -1, seed * 30 + i); }
}
const CHAR = '#1e1612', FUSES = [];
function fuseAt(lk, s, tA, tB, seed, y0, y1) { // the thread catches fire and burns like a fuse: char eats the red, a live flame runs ahead
  const idx = []; lk.S.forEach((p, i) => { const lx = p.x - s.ox, ly = p.y - s.oy; if (lx > 0 && lx < 1080 && ly > y0 && ly < y1) idx.push(i); }); if (idx.length < 2) return;
  const K = 14; for (let k = 0; k < K; k++) { const i0 = idx[Math.round(k / K * (idx.length - 1))], i1 = idx[Math.round((k + 1) / K * (idx.length - 1))], pts = []; for (let i = Math.max(idx[0], i0 - 3); i <= i1; i += 3) pts.push([lk.S[i].x, lk.S[i].y, 1]);
    if (pts.length > 1) brushAt(lerp(tA, tB, (k + .5) / K), { pts, w: 42, col: CHAR, dry: .35, wet: .5, alpha: .8, taper: 0, dur: .06, noSplat: 1 }); }
  FUSES.push({ S: lk.S, idx, tA, tB, seed });
}
const scorchAt = (t0, dur, x, y, rx, ry, seed) => ITEMS.push({ kind: 'burn', noHole: 1, t0, dur, n: 14, x, y, rx, ry, seed, bb: [x - rx * 1.6, y - ry * 1.6, x + rx * 1.6, y + ry * 1.6] });
function kintsugiAt(times, s, cx, cy, Rk, seed) { // "break": the mirror cracks from the impact; the cracks are filled with red lacquer and a gold vein (kintsugi)
  const R = rng(seed), cracks = [], seg = (x, y, a, n, len, p0) => { const pts = [[x, y, p0]]; for (let j = 0; j < n; j++) { a += (R() - .5) * .7; const l = len * (.7 + .6 * R()), x1 = x + Math.cos(a) * l, y1 = y + Math.sin(a) * l;
      for (let q = 1; q <= 4; q++) pts.push([lerp(x, x1, q / 4), lerp(y, y1, q / 4), p0 * (1 - (j + q / 4) / (n + .5))]); x = x1; y = y1; if (R() < .35 && n > 2) cracks.push({ pts: seg(x, y, a + (R() < .5 ? -.9 : .9), 2, len * .6, p0 * .6) }); } return pts; };
  for (let k = 0; k < 7; k++) cracks.push({ main: 1, pts: seg(cx, cy, (k + .2 + .6 * R()) / 7 * 6.2832, 4, Rk / 4, 1) });
  const all = [...cracks.filter(c => c.main), ...cracks.filter(c => !c.main)];
  all.forEach((c, i) => { const t = times[Math.min(times.length - 1, Math.floor(i / all.length * times.length))] + (i % 3) * .03;
    B(t, L(s, { pts: c.pts, w: c.main ? 20 : 12, col: RED, dry: .15, wet: .6, taper: .1, dur: .16, ease: ATK, noSplat: 1, over: 1 }));
    B(t + .12, L(s, { pts: c.pts, w: c.main ? 5 : 3, col: '#d9a441', dry: .3, taper: .1, dur: .16, noSplat: 1, over: 1, alpha: .9 })); });
}
function timedLine(t0, pts, o = {}) { // pts [x, y, p, t]: one brush stroke whose tip passes each point exactly at its time
  const ts = pts.map(q => q[3]), cO = [0]; for (let i = 1; i < pts.length; i++) cO.push(cO[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); const tot = cO.at(-1), t1 = ts.at(-1);
  const ease = u => { const t = t0 + u * (t1 - t0); let lo = 0, hi = ts.length - 1; if (t <= ts[0]) return 0; if (t >= ts[hi]) return 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; ts[m] <= t ? lo = m : hi = m; } return lerp(cO[lo], cO[hi], clamp((t - ts[lo]) / ((ts[hi] - ts[lo]) || 1))) / tot; };
  return brushAt(t0, { ...TH, pts: pts.map(q => [q[0], q[1], q[2]]), dur: t1 - t0, ease, step: 2, ...o });
}
const TAPE = {}; // finale: a recorder pen runs strictly right at the candle's height and ends in the thread's first point
function tapeLipsAt(A, xEnd) {
  const yT = A[1], x0 = A[0], hw = 400, C0 = x0 + 60 + hw, xs = C0 + hw + 150; // lips span [C0-hw, C0+hw]
  const X = [[115.3, x0], [116.3, C0 - hw], [127.3, C0 + hw], [129.25, xs], [TEND, xEnd]], xp = t => { if (t <= X[0][0]) return x0; for (let i = 1; i < X.length; i++) if (t <= X[i][0]) return lerp(X[i - 1][1], X[i][1], (t - X[i - 1][0]) / (X[i][0] - X[i - 1][0])); return xEnd; };
  const env = x => { const u = clamp((x - (C0 - hw)) / (2 * hw)) * 2 - 1, q = 1 - u * u; // upper lip (cupid's bow) up, lower lip down
    return [HU * Math.pow(q, .7) * (1 - .38 * Math.exp(-((u / .13) ** 2))) * (1 + .18 * Math.exp(-(((Math.abs(u) - .32) / .13) ** 2))), HL * Math.pow(q, .6)]; };
  Object.assign(TAPE, { xp, yT, C0, hw });
  const R = rng(1307), out = [[x0, yT, 1, 115.3]];
  for (let t = 115.35; t < 116.3; t += .05) out.push([xp(t), yT + (R() - .5) * 3, 1, t]);
  // tremor: baseline, a fine needle up to the upper-lip envelope, baseline, a needle down to the lower-lip envelope: from afar the envelope is the lips
  // the tremor beats like a pulse: on each beat amplitude and frequency jump, then die down until the next one; downbeats a bit bigger
  const DB = new Set(S.downbeats), pul = t => { let b = -9; for (const x of BEATS) { if (x > t) break; b = x; } return (DB.has(b) ? 1.12 : 1) * Math.exp(-(t - b) * 4.5); };
  for (let k = 0, t = 116.3; t < 127.3; k++) { const pl = pul(t), dt = lerp(.2, .06, clamp(pl)), tp = t + dt * .5, x = xp(tp), [up, lo] = env(x), am = .45 + .55 * pl;
    out.push([xp(t), yT + (R() - .5) * 4, .5, t], [x, yT + (k % 2 ? lo : -up) * am * (.88 + .12 * R()) + (R() - .5) * 4, .12, tp]); t += dt; }
  for (let t = 127.3; t < TEND; t += .1) out.push([xp(t), yT, 1, t]); // flatline: the heart stops; the pen goes on
  out.push([xEnd, yT, 1, TEND]);
  return timedLine(115.3, out, { w: TW, ovw: 1, dry: .3, wet: .4 });
}
const TEND = 130.75; let HU = 240, HL = 215, DT = .15, TW = 14;
function buryAt(s, T, flip) { // "bury me in the ground": a spade (the thread is its handle) stuck in a fresh mound, ground line, red roots
  const Y = y => flip ? 1920 - y : y, Pp = (x, y) => [s.ox + x, s.oy + Y(y)], dir = flip ? -1 : 1;
  B(T[0], L(s, { pts: [[466, Y(644), .8], [540, Y(636), 1], [614, Y(646), .8]], w: 40, dry: .5, taper: .1 }));
  const blade = [[518, 1012], [562, 1012], [582, 1058], [640, 1062], [634, 1180], [622, 1300], [590, 1370], [540, 1405], [490, 1370], [458, 1300], [446, 1180], [440, 1062], [498, 1058]].map(([x, y]) => Pp(x, y));
  const [bx, by] = Pp(540, 1200); ev(T[1], [bx - 200, by - 260, bx + 200, by + 260], g => { const dk = isDark(bx, by), R = rng(77 + (flip ? 1 : 0)), path = () => { g.beginPath(); blade.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.closePath(); };
    g.save(); g.globalCompositeOperation = dk ? 'source-over' : 'multiply'; g.fillStyle = colAt(INK, dk); g.globalAlpha = .94; path(); g.fill(); path(); g.clip(); g.globalCompositeOperation = 'source-over'; g.strokeStyle = dk ? DARK : PAPER; g.lineCap = 'round';
    for (let i = 0; i < 40; i++) { const x = s.ox + 440 + 200 * R(), y0 = Y(1010 + 300 * R()), l = (40 + 120 * R()) * dir; g.globalAlpha = .15 + .3 * R(); g.lineWidth = 1 + 3 * R(); g.beginPath(); g.moveTo(x, s.oy + y0); g.lineTo(x + (R() - .5) * 6, s.oy + y0 + l); g.stroke(); }
    g.globalAlpha = .7; g.lineWidth = 5; g.beginPath(); g.moveTo(...Pp(452, 1075)); g.lineTo(...Pp(458, 1290)); g.stroke(); g.restore(); });
  const mound = []; for (let k = 0; k <= 30; k++) { const u = k / 30, x = lerp(110, 970, u), y = 1500 - 178 * Math.pow(Math.sin(u * Math.PI), .8) + 6 * Math.sin(u * 37); mound.push([x, y]); }
  const [mx, my] = Pp(540, 1420); ev(T[2], [mx - 480, my - 200, mx + 480, my + 120], g => { const dk = isDark(mx, my); g.save(); g.fillStyle = g.createPattern(dk ? PAPER_D : PAPER_L, 'repeat'); g.beginPath(); mound.forEach(([x, y], i) => i ? g.lineTo(...Pp(x, y)) : g.moveTo(...Pp(x, y))); g.closePath(); g.fill();
    const R = rng(91); g.globalCompositeOperation = dk ? 'source-over' : 'multiply'; g.fillStyle = colAt(INK, dk);
    for (let i = 0; i < 420; i++) { const u = R(), x = lerp(130, 950, u), top = 1500 - 178 * Math.pow(Math.sin(u * Math.PI), .8), y = lerp(top + 14, 1500, Math.pow(R(), .8)), r = 1.2 + 5 * Math.pow(R(), 3); g.globalAlpha = .25 + .5 * R(); g.beginPath(); g.ellipse(...Pp(x, y), r * 1.4, r, R() * 3, 0, 6.2832); g.fill(); }
    g.restore(); });
  B(T[3], L(s, { pts: mound.filter((_, k) => k % 3 === 0).map(([x, y]) => [x, Y(y - 4), .5 + .5 * Math.sin(Math.PI * (x - 110) / 860)]), w: 50, dry: 1.3, wet: .25, taper: .3, dur: .35, ease: STEADY }));
  B(T[4], L(s, { pts: [[20, Y(1506), .6], [300, Y(1498), 1], [700, Y(1510), .9], [1060, Y(1500), .5]], w: 58, dry: 1.4, wet: .2, taper: .25, dur: .3 }));
  sprayAt(T[4], ...Pp(540, 1330), 0, -dir, 24, 300, 449 + (flip ? 1 : 0), INK, 1);
  [[[540, 1515, 1], [500, 1600, .8], [430, 1660, .6], [370, 1750, .15]], [[540, 1520, 1], [592, 1610, .8], [680, 1672, .6], [725, 1770, .15]], [[504, 1592, .8], [522, 1690, .5], [494, 1800, .1]], [[598, 1618, .7], [588, 1730, .1]], [[432, 1660, .6], [356, 1680, .1]]]
    .forEach((pts, k) => B(T[5] + k * .08, L(s, { ...TH, pts: pts.map(([x, y, p]) => [x, Y(y), p]), w: 14 - k, dry: .5, taper: .3, dur: .25 })));
}
const breakAt = (times, s, x, y, seed) => kintsugiAt(times, s, x, y, 560, seed);
const tipAt = (lk, t) => lk.S[Math.floor(lk.n * (lk.ease || ATK)(clamp((t - lk.t0) / lk.dur)))];
let S19, S1C; const FIN0 = 115.24, ZF = .094;

function build() {
  // ink flood edge between the halves (always there; the camera crosses it on the kiss trail and sees it on the pull-back)
  for (let y = -200; y < WW + 200; y += 1500) brushAt(-2, { pts: [0, 1, 2, 3, 4].map(k => [bndX(y + k * 400) + 34, y + k * 400, 1]), w: 76, dry: 1.3, wet: .25, alpha: .5, taper: 0, dur: .001, noSplat: 1 });

  // ===== ACT I (top, moving right, washi): seduction =====
  // 1. PROFILE — the thread flies in from the gap on the drop 1.0 and lands in her lips; she is drawn around it.
  const S1 = station(8); S1C = ctr(S1);
  { const Pr = SHAPE.profile();
    seq(S1, [.998, 1.25, 1.5, 1.75, 2.0, 2.36, 3.6, 4.37], [{ ...Pr[6], dur: .45, lead: .6 }, Pr[0], Pr[1], Pr[2], Pr[3], Pr[7], Pr[5], Pr[4]]);
    B(5.341, L(S1, { ...Pr[8], ...TH, w: 40, taper: .3 }));
    // only when the lips are there, the thread comes in from the gap and strikes her out (slam 6.34)
    B(6.339, { ...TH, pts: [[...ringXY(0), .3], P(S1, 220, 960, .9), P(S1, 650, 1040, 1.25), P(S1, 1150, 1125, .9)], w: 48, dur: .2, lead: .8, ease: ATK, taper: .3 }); }
  // 2. LIPS — "whisper" leaves her mouth and becomes a mouth line; upper lip halves and lower lip on the slams.
  const S2 = station(24), L2 = lipsSpec(540, 930, 720);
  go(6.55, 8.3, S1, S2, [P(S1, 1150, 1125), P(S1, 1350, 1060), ...viaRing(14, 19, 2, 70), ...L(S2, L2[3]).pts.map(([x, y]) => [x, y, 1])]);
  seq(S2, [9.311, 9.822, 10.82], [L2[0], L2[1], L2[2]]);
  // 3. DAGGER — "assassin" 11.8: the thread leaves the mouth corner as a straight slash and becomes the blade's red edge.
  const S3 = station(40), D = SHAPE.dagger(), edge = tf([{ pts: [[0, -60, 1], [0, 250, 1.1], [0, 540, .8]], w: 1 }], 540, 900, 1.05, .38)[0].pts;
  go(11.62, 12.3, S2, S3, [P(S2, 900, 931), P(S2, 1500, 1000), ...L(S3, { pts: edge }).pts], { ease: ATK, w: 38 });
  seq(S3, [12.53, 13.03, 13.28, 13.76, 14.26], D.slice(0, 5));
  const drop = L(S3, { ...D[5], ...TH, w: 50, taper: .1, dur: .22 }); B(15.232, drop);
  // 4. ENSŌ → EYE — the drop stretches ("elastic"), swells with rage, swings a red ensō onto "magic"; seal in the gap;
  //    lids and brow close round it: the ensō is the iris of an angry eye.
  const S4 = station(57, { z: .82, fy: 900 }), E4 = enso(540, 900, 205, 44, -2.2, 11);
  go(15.45, 18.9, S3, S4, [drop.pts.at(-1), ...viaRing(45, 51, 2, 110).map(([x, y], k) => [x, y, [0.9, 1.5][k]]), P(S4, 180, 470, 1.5), P(S4, 360, 690, 1.3), P(S4, E4.pts[0][0], E4.pts[0][1], 1.1)]);
  brushAt(18.9, L(S4, { ...TH, pts: E4.pts, w: 50, dry: 1.0, dur: 1.25, taper: .15, noSplat: 0 }));
  blotAt(21.711, E4.gx + S4.ox, E4.gy + S4.oy, 58, 217, INK); // a small ink blot closes the circle
  const Ey = SHAPE.eye(); seq(S4, [22.2, 22.44, 22.68, 23.197, 23.66, 23.9, 24.16, 24.41], Ey);

  // ===== ACT II (right side, going down, washi): escalation =====
  // 5. HEART — a tear drops from the iris and draws two red lobes; crack on 28.17.
  const S5 = station(74), Hh = SHAPE.heart();
  go(24.5, 26.0, S4, S5, [P(S4, 540, 1110), P(S4, 552, 1400), ...viaRing(63, 69, 1, 60), P(S5, 540, 560), P(S5, 540, 810)]);
  seq(S5, [26.14, 27.167], Hh); seq(S5, [28.166], SHAPE.crack());
  // 6. SNAKE — from the heart's tip down to the tail; the thread runs as a red stripe along the black body, head strikes down.
  const S6 = station(91), Sn = SHAPE.snake();
  go(28.85, 30.03, S5, S6, [P(S5, 540, 1270), P(S5, 540, 1500), ...viaRing(79, 85, 1, 90), P(S6, 830, 260)]);
  // the whole snake is ONE decisive throw — body and head in a single stroke (the head is only the swell at its end), then the tongue
  B(31.138, L(S6, { ...Sn[0], pts: [...Sn[0].pts, ...Sn[1].pts.slice(1)], w: 100, dur: .55, lead: .85, ease: ATK, wet: .5, dry: .8 }));
  B(31.138, L(S6, { ...TH, pts: offsetPts(Sn[0].pts, -66), dur: .5, lead: .85, ease: ATK, w: 26 }));
  // no drawn head — the throw's own swell is the head; the camera freezes on it, then the tongue on the downbeat
  seq(S6, [32.1, 32.14, 32.18], Sn.slice(3).map(sp => ({ ...sp, w: sp.w * 1.4, pts: sp.pts.map(([x, y, p]) => [545 + (x - 545) * 1.6, 1418 + (y - 1418) * 1.6, p]), dur: .08, ease: ATK }))); // tongue ×1.9 from its root
  // 7. ROSE — the tongue coils into a spiral = the rose's heart; ink petals; the stem is the thread.
  const S7 = station(107), sp = []; for (let k = 0; k <= 18; k++) { const u = k / 18, a = u * 2.4 * Math.PI, r = lerp(20, 96, u); sp.push([540 + Math.cos(a) * r, 720 + Math.sin(a) * r * .85, lerp(.6, 1, u)]); }
  go(32.4, 33.55, S6, S7, [P(S6, 596, 1520), P(S6, 610, 1700), ...viaRing(96, 102, 1, 60), P(S7, 560, 560), [...P(S7, sp[0][0], sp[0][1])]]);
  B(33.84, L(S7, { ...TH, pts: sp, dur: .4, w: 34 }));
  seq(S7, [34.1, 34.34, 34.58, 34.83, 35.08], tf(SHAPE.petals(), 540, 760, 1.35, 0, 540, 760).map(p => ({ ...p, col: RED })));
  B(35.45, L(S7, { ...TH, pts: [[540, 950, .9], [528, 1200, 1], [548, 1540, .6]], dur: .35, w: 34 }));
  seq(S7, [35.62, 35.84], SHAPE.leaves().slice(0, 2));
  // the thorns are drawn slowly, the camera stops on the last one and a red drop swells on its tip
  seq(S7, [36.1, 36.34, 36.58], [[536, 1085, -1], [531, 1262, 1], [541, 1425, -1]].map(([x, y, sd]) => ({ pts: [[x, y + 26, 1], [x + sd * 48, y - 6, .45], [x + sd * 104, y - 50, .01]], w: 32, dry: .25, wet: .1, taper: .02, dur: .34, ease: STEADY, lead: .6 })));
  B(36.82, L(S7, { pts: [[437, 1372, .5], [437, 1387, 1], [438, 1399, 1]], w: 30, col: RED, wet: .9, dry: .1, taper: 0, dur: .14 })); B(36.95, L(S7, { pts: [[438, 1399, .5], [438, 1460, .35], [439, 1500, .15]], w: 14, col: RED, wet: .8, dry: .2, taper: .3, dur: .2 }));
  // 8. MATCH → MIRROR — the thread ends in a red match head; flame on "burn" 38.08 burns a hole in the scroll; the charred
  //    hole is the black glass of a hand mirror, the match stick its handle; cracks on "break" 40.05 and 41.04.
  const S8 = station(123);
  const lk8 = go(36.95, 37.45, S7, S8, [P(S7, 548, 1545), P(S7, 548, 1760), ...viaRing(112, 118, 1, 50), P(S8, 540, 700), P(S8, 540, 1050)]);
  B(37.5, L(S8, { ...TH, pts: [[540, 1040, .9], [540, 1112, 1]], w: 84, wet: .8, taper: .2, load: 1.3, dur: .15 }));
  B(37.7, L(S8, { pts: [[540, 1120, .9], [540, 1340, 1], [540, 1580, .8]], w: 40, dry: .4, taper: .1, dur: .3 }));
  fuseAt(lk8, S8, 37.6, 38.0, 81, 120, 1030);
  flameAt([38.081, 38.3, 38.5], S8, 540, 1050, 600, 200, 82);
  scorchAt(38.12, .7, S8.ox + 545, S8.oy + 800, 300, 380, 83);
  burnAt(38.78, .4, S8.ox + 545, S8.oy + 830, 270, 320, 8);
  rimFlames(39.2, S8, 545, 830, 270, 320, 84);
  seq(S8, [39.48, 39.72], [
    { pts: arcPts(545, 830, 330, 380, -90, -270, 20, [.8, .9]), w: 60, dry: .9, wet: .3, taper: .2, ease: STEADY, dur: .35 },
    { pts: arcPts(545, 830, 330, 380, -90, 90, 20, [.8, .9]), w: 60, dry: .9, wet: .3, taper: .2, ease: STEADY, dur: .35 }]);
  bleedAt(38.94, 1.3, S8.ox + 545, S8.oy + 830, 330, 380, INK, 38);
  [[-1, -.4], [1, -.2], [.3, 1]].forEach(([dx, dy], k) => sprayAt(38.94, S8.ox + 545 + dx * 330, S8.oy + 830 + dy * 380, dx, dy, 24, 330, 39 + k, INK, 1.1));
  { const [bx, by] = P(S8, 545, 830); blotAt(40.054, bx, by, 150, 401); // "break me down" = a live red blot with runs
    brushAt(40.54, { pts: [[bx - 60, by + 120, 1], [bx - 66, by + 260, .8], [bx - 58, by + 380, 1]], w: 30, col: RED, wet: .9, dry: .1, taper: .1, dur: .8, ease: STEADY, noSplat: 1 });
    brushAt(40.98, { pts: [[bx + 70, by + 110, .9], [bx + 76, by + 330, .7], [bx + 70, by + 520, .9]], w: 24, col: RED, wet: .9, dry: .1, taper: .1, dur: 1.0, ease: STEADY, noSplat: 1 }); }
  // 9. GRAVE — the thread is the post of the cross and goes into the ground.
  const S9 = station(139);
  go(41.3, 43.42, S8, S9, [P(S8, 540, 1590), P(S8, 540, 1800), ...viaRing(128, 134, 1, 70), P(S9, 540, 620), P(S9, 540, 1300)]);
  buryAt(S9, [43.6, 43.88, 44.22, 44.44, 44.92, 45.05], 0);
  // 10. ENSŌ → APPLE — the thread comes out of the earth; a big black ensō lands on "magic" 48.0; the thread enters its gap
  //     and fills it red on each "pleasure"; stem, leaf, bite: guilty pleasure.
  const S10 = station(155, { fy: 960 }), E10 = enso(540, 960, 330, 36, -Math.PI / 2, 23);
  go(45.6, 48.3, S9, S10, [P(S9, 540, 1310), P(S9, 540, 1700), ...viaRing(144, 150, 1, 80), P(S10, 540, 420), P(S10, 540, 700)]);
  brushAt(46.85, L(S10, { pts: E10.pts, w: 110, dry: 1.1, wet: .3, ease: STEADY, dur: 1.2 }));
  const Ap = SHAPE.apple(); seq(S10, [49.714, 50.945, 51.757, 52.95, 53.2], [Ap[0], Ap[1], Ap[2], Ap[3], Ap[4]]);
  seq(S10, [52.3, 52.78], [{ pts: [[540, 700, 1], [548, 610, .9], [572, 520, .45]], w: 30, dry: .4 }, { pts: [[556, 600, .2], [640, 540, 1], [735, 548, .1]], w: 84, taper: .9, dry: .7, wet: .3 }]);
  // ONE bite, then the apple of sin grows devil horns and a tail, one brush stroke per beat; the thread leads on
  // the bite is TORN out in one paper-coloured whip (its dry bristle edge = the tooth marks), crumbs and juice fly, the apple jolts ("ой")
  { const [bx, by] = P(S10, 925, 910), r = 200, rim = a => r * (1 - .13 * Math.abs(Math.sin(a * 6))); // one snap of the jaws: a round chunk with tooth scallops
    ev(53.88, [bx - 260, by - 260, bx + 260, by + 260], g => { g.save(); g.fillStyle = g.createPattern(PAPER_L, 'repeat'); g.beginPath();
      for (let k = 0; k <= 120; k++) { const a = k / 120 * 6.2832, q = rim(a); g.lineTo(bx + Math.cos(a) * q, by + Math.sin(a) * q * 1.15); } g.closePath(); g.fill(); g.restore(); });
    brushAt(53.9, { pts: Array.from({ length: 13 }, (_, k) => { const a = (125 + k * 110 / 12) * DEG, q = rim(a) + 6; return [bx + Math.cos(a) * q, by + Math.sin(a) * q * 1.15, .6 + .4 * Math.sin(k / 12 * Math.PI)]; }), w: 40, col: GOFUN, over: 1, dry: 1.1, alpha: .85, taper: .2, dur: .09, ease: ATK, noSplat: 1 }); // pale flesh rim, dry bristles = tooth marks
    sprayAt(53.92, bx - 60, by - 150, .6, -1, 20, 230, 5388, RED, 1.5); sprayAt(53.94, bx - 60, by + 170, .5, 1, 14, 200, 5389, INK, 1.2); } // juice + crumbs fly off
  seq(S10, [54.9, 55.86], [ // horns: fat at the root, curling up and in to a needle tip
    { pts: [[392, 668, 1], [330, 590, .8], [300, 500, .45], [322, 420, .01]], w: 78, dry: .5, wet: .4, taper: .02, dur: .3, ease: STEADY },
    { pts: [[700, 690, 1], [770, 610, .8], [805, 520, .45], [790, 440, .01]], w: 78, dry: .5, wet: .4, taper: .02, dur: .3, ease: STEADY }]);
  // the devil's tail is ONE red whip on one beat, ending in a sharp spade; the thread goes on at once
  B(56.84, L(S10, { pts: [[700, 1200, .8], [840, 1310, 1], [980, 1290, .85], [1020, 1180, .6], [965, 1095, .3], [948, 1068, 1.7], [922, 990, .01]], w: 34, col: RED, dry: .4, wet: .4, taper: .02, dur: .16, lead: .8, ease: ATK }));
  B(56.84, L(S10, { pts: [[1000, 1098, .05], [948, 1068, 1], [896, 1038, .05]], w: 52, col: RED, dry: .3, wet: .4, taper: .05, dur: .06, lead: 0, ease: ATK, noSplat: 1 })); // the spade's barbs, in the same whip
  brushAt(56.95, L(S10, { ...TH, pts: [[540, 1290, .6], [520, 1420, .9], [430, 1520, 1], [205, 1540, 1]], w: 40, taper: .1, dur: 1.6, ease: STEADY }));
  // 11. KISS TRAIL — one kiss per "pleasure" along the thread (iji-dōzu: the same lips walk the scroll); the thread is each
  //     kiss's mouth line; halfway the camera crosses the edge of the ink flood.
  const S11 = station(214);
  const trail = go(58.6, 66.3, S10, S11, [P(S10, 205, 1540), P(S10, -40, 1580), ...viaRing(166, 206, 7, 45), P(S11, 1000, 1370), P(S11, 540, 1340)], { ease: LIN, mid: [0, -140] });
  [59.88, 60.82, 61.82, 62.82, 63.86, 64.82].forEach((tk, k) => { const a = tipAt(trail, tk), i = trail.S.indexOf(a), b0 = trail.S[Math.max(0, i - 6)], b1 = trail.S[Math.min(trail.n, i + 6)], sz = [430, 500, 450, 520, 460, 540][k], rot = clamp(Math.atan2(b0.y - b1.y, b0.x - b1.x), -.15, .15);
    lipsSpec(0, 0, sz).slice(0, 3).forEach((sp, j) => B(tk - .16 + j * .08, tf([sp], a.x, a.y - sz * .01, 1, rot)[0])); });

  // ===== ACT III (bottom → left side, black): turn =====
  // 12. HORSESHOE (gofun on black) — arms on the beats, heels on the drop 67.78, nails, splash on 69.78.
  seq(S11, [66.82, 67.32, 67.779, 67.9], SHAPE.horseshoe());
  ev(68.0, [S11.ox + 300, S11.oy + 700, S11.ox + 780, S11.oy + 1200], g => { g.save(); g.globalCompositeOperation = 'destination-out'; for (const [x, y] of [[352, 800], [360, 950], [398, 1100], [728, 800], [720, 950], [682, 1100]]) { g.beginPath(); g.ellipse(S11.ox + x, S11.oy + y, 11, 16, 0, 0, 7); g.fill(); } g.restore(); });
  splatAt(69.776, S11.ox + 540, S11.oy + 1000, 40, 380, 69, INK, 1.2);
  // 13. LASSO — the thread throws a loop on the drop 70.5, knot 71.05, a second whirl on "dance"; a red heart is caught
  //     inside the loop (74.7–76.6) and squeezed until it bleeds.
  const S12 = station(230), lc = [500, 1060];
  const lkL = go(69.9, 70.3, S11, S12, [P(S11, 540, 1340), P(S11, 300, 1360), ...viaRing(218, 225, 1, 40), P(S12, lc[0] + 330, lc[1])], { ease: ATK });
  brushAt(70.3, L(S12, { ...TH, pts: arcPts(lc[0], lc[1], 330, 170, 0, 355, 36).map(([x, y, p], k) => [x, y + k * 1.2, p]), w: 40, dry: .9, dur: .45 }));
  B(71.053, L(S12, { ...TH, pts: [[818, 1050, .8], [860, 1020, 1.2], [836, 985, .7]], w: 56, taper: 0 }));
  brushAt(72.5, L(S12, { ...TH, pts: arcPts(lc[0], lc[1] + 10, 300, 150, 355, 0, 30), w: 26, dry: 1.2, dur: .55 }));
  // the lasso catches a heart; then the loop cleanly tightens round it
  const caught = [[74.68, { pts: [[500, 1150, .4], [420, 1090, 1], [385, 1015, 1], [420, 965, .8], [480, 975, .6], [500, 1010, .4]], w: 58, col: RED, dry: .5, wet: .5 }],
      [75.14, { pts: [[500, 1150, .4], [580, 1090, 1], [615, 1015, 1], [580, 965, .8], [520, 975, .6], [500, 1010, .4]], w: 58, col: RED, dry: .5, wet: .5 }],
      [76.16, { pts: [[445, 1020, .8], [500, 1080, 1], [555, 1020, .8]], w: 76, col: RED, wet: .7, dry: .2 }], [76.62, { pts: [[418, 1004, .6], [440, 982, .3]], w: 12, dry: .3 }]];
  for (const [t, sp] of caught) B(t, L(S12, sp));
  // the wipe (ellipse 440×260) erases the link's approach, so the ring starts on the last link point outside the wipe
  const outW = lkL.S.findLast(p => ((p.x - S12.ox - lc[0]) / 450) ** 2 + ((p.y - S12.oy - lc[1]) / 270) ** 2 > 1), pOut = [outW.x - S12.ox, outW.y - S12.oy, .9];
  const loopPts = (rx, ry, a1, n) => [pOut, [lerp(pOut[0], lc[0] + rx, .5), lerp(pOut[1], lc[1], .6), .9], ...arcPts(lc[0], lc[1], rx, ry, 0, a1, n)];
  [[78.6, 250, 145], [78.75, 200, 130], [78.9, 165, 118]].forEach(([t, rx, ry], k) => {
    const cx = S12.ox + lc[0], cy = S12.oy + lc[1];
    ev(t, [cx - 460, cy - 280, cx + 460, cy + 280], g => { g.save(); g.fillStyle = g.createPattern(PAPER_D, 'repeat'); g.beginPath(); g.ellipse(cx, cy, 440, 260, 0, 0, 6.2832); g.ellipse(cx, cy, rx + 18, ry + 18, 0, 0, 6.2832, true); g.fill('evenodd'); g.restore(); });
    brushAt(t + .01, L(S12, { ...TH, pts: loopPts(rx, ry, k < 2 ? 360 : 540, k < 2 ? 32 : 46), w: k < 2 ? 30 : 34, dur: k < 2 ? .06 : .3, ease: LIN })); });
  // 14. GLASS — the surviving thread climbs, gofun glass, the thread pours the wine stroke by stroke, overflows on "magic".
  const S13 = station(246);
  [[-38, 78.95, 150], [22, 79.1, 230], [60, 79.28, 120]].forEach(([dx, t, l], k) => { const x = lc[0] + dx, y = lc[1] + 108 + Math.abs(dx) * .2; // the squeezed heart bleeds a few cinnabar drops from under the loop
    B(t, L(S12, { pts: [[x, y, .5], [x + 2, y + l * .5, .7], [x, y + l, 1.5]], w: 16, col: RED, wet: .9, dry: .05, taper: .05, dur: .7, ease: STEADY, noSplat: 1 }));
    B(t + .9, L(S12, { pts: [[x, y + l + 40, 1], [x, y + l + 58, 1]], w: 18, col: RED, wet: .9, dry: .05, taper: 0, dur: .08, noSplat: 1 })); });
  go(79.3, 80.75, S12, S13, [P(S12, lc[0] - 165, lc[1]), P(S12, 60, 1060), P(S12, -80, 900), ...viaRing(236, 241, 1, 40), P(S13, 880, 1250), P(S13, 860, 560), P(S13, 660, 440), P(S13, 545, 560), P(S13, 540, 900)], { ease: ATK });
  seq(S13, [80.0, 80.1, 80.2, 80.3, 80.42, 80.55], SHAPE.glass(), { dur: .14 });
  seq(S13, [80.84, 81.1, 81.62, 82.08, 82.36], SHAPE.wine());
  seq(S13, [83.6, 83.75], [{ pts: [[706, 612, .8], [736, 700, 1], [730, 830, .4]], w: 30, col: RED, wet: .6, dry: .2, dur: .5, ease: LIN },
    { pts: [[392, 620, .8], [372, 728, 1], [382, 872, .3]], w: 28, col: RED, wet: .6, dry: .2, dur: .6, ease: LIN }]);

  // ===== ACT IV (left side, going up, black): the chorus again, every motif changed =====
  // 15. CLOSED EYE — the thread rises from below and becomes a tear; the lid falls on the slam 86.68.
  const S14 = station(262);
  go(84.2, 86.5, S13, S14, [P(S13, 368, 590), P(S13, 330, 300), ...viaRing(250, 256, 1, 50), P(S14, 610, 1560), P(S14, 596, 1300), P(S14, 580, 1020)]);
  seq(S14, [86.68, 86.95, 87.14, 87.4, 87.64, 87.8, 87.7], [
    { pts: [[230, 870, .3], [380, 950, .9], [540, 990, 1], [700, 950, .9], [850, 870, .3]], w: 60, dry: .6, wet: .3 },
    { pts: [[320, 928, .8], [290, 1010, .15]], w: 20 }, { pts: [[430, 970, .8], [412, 1060, .15]], w: 20 }, { pts: [[540, 992, .8], [540, 1085, .15]], w: 20 },
    { pts: [[650, 970, .8], [668, 1060, .15]], w: 20 }, { pts: [[760, 928, .8], [790, 1010, .15]], w: 20 },
    { pts: [[250, 720, .4], [540, 650, 1], [820, 730, .3]], w: 64, dry: 1.1, wet: .2 }]);
  // 16. STITCHED HEART — two separated gofun halves; the thread enters at the tip and sews the gap upward.
  const S15 = station(278), H2 = SHAPE.heart(80, INK, 110);
  go(87.95, 90.05, S14, S15, [P(S14, 850, 870), P(S14, 900, 600), ...viaRing(267, 272, 1, 50), P(S15, 540, 1500), P(S15, 540, 1270)]);
  seq(S15, [88.654, 89.62], H2);
  brushAt(90.05, L(S15, { ...TH, pts: Array.from({ length: 11 }, (_, k) => [k % 2 ? 470 : 610, lerp(1250, 790, k / 10), 1]), dur: 1.35, ease: LIN, w: 28, taper: 0 }));
  // 17. OUROBOROS (ensō 3) — the thread circles as the spine, the body rings round it, the head bites the tail on "mad".
  const S16 = station(294), oc = [540, 900];
  go(91.45, 93.72, S15, S16, [P(S15, 540, 780), P(S15, 540, 520), ...viaRing(283, 288, 1, 50), P(S16, 540, 1400), P(S16, oc[0], oc[1] + 300)]);
  brushAt(93.72, L(S16, { ...TH, pts: arcPts(oc[0], oc[1], 205, 205, 90, 430, 40), dur: .8, w: 30 }));
  B(94.26, L(S16, { pts: arcPts(oc[0], oc[1], 300, 300, 105, 395, 40, [.7, 1]), w: 104, dry: .9, wet: .3, dur: .5, ease: STEADY, taper: .3 }));
  B(94.54, L(S16, { pts: arcPts(oc[0], oc[1], 300, 300, 392, 432, 6, [1.1, .8]), w: 150, dry: .3, wet: .6, taper: .15 }));
  B(95.36, L(S16, { ...TH, pts: [[oc[0] + 190, oc[1] + 225, 1], [oc[0] + 200, oc[1] + 235, 1]], w: 30, taper: 0 }));
  // 18. ROSE, WILTING AND BURNING — the stem (thread) bends, the head hangs, petals fall; "burn" 101.46 burns it out;
  //     "break" 103.54 cracks round the hole; dry splats on the beats (the style breaks at the peak).
  const S17 = station(310), rh = [830, 847];
  const lk17 = go(95.7, 97.4, S16, S17, [P(S16, 540, 600), P(S16, 560, 300), ...viaRing(299, 304, 1, 50), P(S17, 560, 1560), P(S17, 545, 1250), P(S17, 540, 1000), P(S17, 640, 820), P(S17, 720, 930)]);
  // the same rose as in act I (red spiral heart + petals), now white, nodding sideways off the crook of the stem
  { const rs = [], rc = [830, 887], ang = 1.2, sc = 1.2; for (let k = 0; k <= 18; k++) { const u = k / 18, a = u * 2.4 * Math.PI, r = lerp(20, 96, u); rs.push([540 + Math.cos(a) * r, 720 + Math.sin(a) * r * .85, lerp(.6, 1, u)]); }
    brushAt(97.35, L(S17, { ...TH, pts: [[720, 930, 1], ...tf([{ pts: rs.slice().reverse(), w: 1 }], rc[0], rc[1], sc, ang, 540, 760)[0].pts], dur: .5, w: 30 }));
    seq(S17, [97.9, 98.14, 98.36, 98.58, 98.78], tf(SHAPE.petals(), rc[0], rc[1], sc, ang, 540, 760)); }
  seq(S17, [98.9, 99.15, 99.45], [[880, 1260, .6], [690, 1390, -.5], [850, 1500, .3]].map(([x, y, r], k) => ({ pts: [[x - 44, y - 12 + r * 24, .15], [x - 10, y + 10, 1], [x + 30, y + 6 - r * 10, .8], [x + 48, y - 14 - r * 24, .1]], w: 58 - 4 * k, dry: .5, wet: .5, taper: .3 }))); // falling petals
  seq(S17, [99.3, 99.58], [{ pts: [[545, 1300, .2], [440, 1250, 1], [360, 1290, .1]], w: 70, taper: .9, dry: .8, wet: .3 }, { pts: [[548, 1180, .2], [470, 1100, 1], [410, 1120, .1]], w: 60, taper: .9, dry: .8 }]);
  seq(S17, [99.8, 100.1, 100.5, 100.8], [{ pts: [[180, 1640, .5], [520, 1628, 1], [960, 1645, .4]], w: 70, dry: 1.3, wet: .2, taper: .3 },
    ...[[690, 1592], [800, 1602], [900, 1588]].map(([x, y], k) => ({ pts: [[x - 44, y - 8, .15], [x - 12, y + 10, 1], [x + 26, y + 8, .8], [x + 46, y - 10, .1]], w: 56 + 4 * k, dry: .5, wet: .5, taper: .3 }))]);
  fuseAt(lk17, S17, 100.98, 101.4, 171, 800, 1600);
  flameAt([101.46, 101.66, 101.86], S17, rh[0], rh[1] + 150, 560, 190, 172);
  burnAt(102.05, .4, S17.ox + rh[0], S17.oy + rh[1] + 40, 250, 270, 17);
  rimFlames(102.5, S17, rh[0], rh[1] + 40, 250, 270, 173);
  bleedAt(102.44, 1.2, S17.ox + rh[0], S17.oy + rh[1] + 40, 290, 310, RED, 102, 44);
  [[-1, -.3], [1, .2], [-.2, 1]].forEach(([dx, dy], k) => sprayAt(102.44, S17.ox + rh[0] + dx * 290, S17.oy + rh[1] + 40 + dy * 310, dx, dy, 26, 340, 102 + k, RED, 1.1));
  breakAt([103.538, 103.96, 104.44], S17, rh[0], rh[1] + 40, 103);
  BEATS.filter(b => b > 101.9 && b < 104.6).forEach((b, k) => splatAt(b, S17.ox + rh[0] + (k % 2 ? 330 : -330), S17.oy + rh[1] + (k % 3 - 1) * 260, 9, 120, 300 + k, INK, .8));
  // 19. GRAVE UPSIDE DOWN — the thread climbs the cross post from its tip into the hanging mound and the sky-ground.
  const S18 = station(326);
  go(104.6, 106.6, S17, S18, [P(S17, 540, 1000), P(S17, 520, 700), ...viaRing(315, 320, 1, 50), P(S18, 540, 1400), P(S18, 540, 1160), P(S18, 540, 660)]);
  buryAt(S18, [106.75, 106.9, 107.34, 107.5, 107.68, 108.1], 1);
  splatAt(108.38, S18.ox + 540, S18.oy + 560, 22, 260, 108, INK, 1);
  // 20. CANDLE (on black) — "don't / call / magic"; the thread is the candle's cradle on the slam 113.17.
  S19 = station(341, { z: .95 }); S19.oy = ringXY(0)[1] - 931; // the candle's cradle ends at the height of the thread's first point
  go(108.62, 109.35, S18, S19, [P(S18, 540, 650), P(S18, 540, 380), ...viaRing(331, 336, 1, 40), P(S19, 132, 931)], { ease: ATK });
  // "don't call it magic": a candle is lit; the thread leaves the image at (948, 931) on the slam
  { seq(S19, [109.42, 109.9, 110.38], [{ pts: [[540, 1250, 1], [540, 800, 1]], w: 130, dry: .6, wet: .3, taper: .05 }, { pts: [[482, 812, .8], [478, 900, .6], [482, 945, .2]], w: 22 },
      { pts: [[540, 520, .3], [540, 640, .6], [540, 700, 1]], w: 30, col: RED, wet: .8, dry: .1 }]); B(110.9, L(S19, { pts: [[540, 802, 1], [542, 772, .6]], w: 8 }));
    tongueAt(111.38, S19, 540, 780, 230, 76, 6, 1, 1911); tongueAt(111.5, S19, 540, 780, 130, 44, -8, -1, 1912);
    B(113.174, L(S19, { ...TH, pts: [[132, 931, .8], [300, 1262, 1], [540, 1280, 1.2], [780, 1262, 1], [948, 931, .8]], w: 30, taper: 0, dur: .35 })); }
  splatAt(114.428, S19.ox + 540, S19.oy + 1010, 18, 220, 52, RED, 1.1);

  // ===== finale: ECG tremor -> lips (envelope) -> flatline -> lipstick smear -> the pen runs on right into the first stroke =====
  { const A = P(S19, 948, 931), [xE] = ringXY(0);
    tapeLipsAt(A, xE); const { C0, hw, yT } = TAPE;
    // the last chord: bright lipstick smeared by a palm across the lips, dragged to the right (waxy dry edge)
    B(129.22, { pts: [[C0 - hw - 40, yT + 30, .6], [C0 - 200, yT - 20, 1], [C0, yT + 15, 1.15], [C0 + 250, yT - 10, 1.05], [C0 + hw + 120, yT + 20, .6]], w: 240, col: '#d8281e', dry: 1.2, wet: .5, load: 1.5, taper: .2, dur: .35, lead: .4, ease: ATK, noSplat: 1, over: 1, alpha: .85 }); }

  const dtip = tf([{ pts: [[0, 610, 1]], w: 1 }], 540, 900, 1.05, .38)[0].pts[0];
  for (const [t, z, h, s, x, y] of [[6.339, 1.3, .15, S1, 650, 1040], [44.92, 1.3, .4, S9, 540, 1300], [10.82, 1.35, .6, S2, 540, 960], [15.232, 1.7, .25, S3, dtip[0], dtip[1]], [23.197, 1.5, .5, S4, 540, 900],
    [28.166, 1.4, .3, S5, 540, 1000], [31.138, 1.5, 1.05, S6, 520, 1400], [38.081, 1.4, 1.5, S8, 545, 830], [40.054, 1.2, .6, S8, 545, 830], [53.88, 1.15, 3.5, S10, 660, 930], [67.779, 1.4, .5, S11, 540, 1150], [71.053, 1.5, .3, S12, 840, 1020], [86.68, 1.45, .6, S14, 540, 950], [90.651, 1.4, .5, S15, 540, 1020],
    [94.54, 1.35, .4, S16, 700, 1150], [101.46, 1.35, 1.4, S17, 700, 1100], [103.538, 1.2, .5, S17, 700, 1100], [107.68, 1.3, .6, S18, 540, 820], [113.174, 1.5, .5, S19, 540, 960]]) push(t, z, h, s.ox + x, s.oy + y);
  // 6. dry drops at the end of every big throw that lands on a slam or drop
  const best = new Map();
  for (const it of ITEMS) { if (it.kind !== 'brush' || it.t0 < 0 || it.w < 36) continue; const te = it.t0 + it.dur;
    for (const h of HITS) if (h.kind !== 'stop' && Math.abs(te - h.t) < .16 && (!best.has(h) || best.get(h).w < it.w)) best.set(h, it); }
  for (const [h, it] of best) { const e = it.S[it.n], q = it.S[Math.max(0, it.n - 6)]; sprayAt(h.t, e.x, e.y, e.x - q.x || 1, e.y - q.y, 16, 140 + it.w * 1.2, (h.t * 100) | 0, it.col || INK, clamp(it.w / 70, .6, 1.4)); }
  // the flood edge past the world (for the whole-picture frame) is added last, so it does not shift the brush seeds of the images
  for (let y = -200 - 1500 * 3; y < -200; y += 1500) brushAt(-2, { pts: [0, 1, 2, 3, 4].map(k => [bndX(y + k * 400) + 34, y + k * 400, 1]), w: 76, dry: 1.3, wet: .25, alpha: .5, taper: 0, dur: .001, noSplat: 1 });
  for (let y = -200 + 1500 * 9; y < OY0 + OH + 200; y += 1500) brushAt(-2, { pts: [0, 1, 2, 3, 4].map(k => [bndX(y + k * 400) + 34, y + k * 400, 1]), w: 76, dry: 1.3, wet: .25, alpha: .5, taper: 0, dur: .001, noSplat: 1 });
  ITEMS.sort((a, b) => a.t0 - b.t0);
}

// ---------- cells: 1080x1920 world tiles with paper + ink baked, pooled canvases, replay per cell ----------
const CR = 1.5, CELLS = new Map(), POOL = Array.from({ length: 12 }, () => ({ c: mk(CW * CR, CH * CR), owner: null, used: 0 })); let tick = 0;
function cell(ix, iy) { const k = iy * 1000 + ix; let c = CELLS.get(k); if (!c) { c = { ix, iy, x0: ix * CW, y0: iy * CH, items: [], done: [], lastT: Infinity, p: null }; CELLS.set(k, c); } return c; }
function register() { for (const it of ITEMS) { const [x0, y0, x1, y1] = it.bb; for (let iy = Math.floor(y0 / CH); iy <= Math.floor(y1 / CH); iy++) for (let ix = Math.floor(x0 / CW); ix <= Math.floor(x1 / CW); ix++) cell(ix, iy).items.push(it); } }
function burnPath(g, it, r, sc = 1) { g.beginPath(); for (let a = 0; a <= 160; a++) { const an = a / 160 * 6.2832, c = Math.cos(an), s = Math.sin(an);
  const q = r * sc * (1 + .3 * (vn2(it.seed + c * 1.7, s * 1.7) - .5) + .14 * (vn2(c * 6 + it.seed, s * 6 + 9) - .5) + .07 * (vn2(c * 24 + it.seed, s * 24 + 3) - .5)); g.lineTo(it.x + c * it.rx * q, it.y + s * it.ry * q); } g.closePath(); }
function burnStep(g, it, k) { // the hole grows in n fixed steps; the paper browns ahead of it (layers pile into a gradient), charred band, live ember rim
  const r = easeOut(k / it.n), last = k === it.n;
  g.save(); g.globalCompositeOperation = 'source-atop'; g.lineJoin = 'round';
  g.fillStyle = 'rgba(120,68,24,.06)'; burnPath(g, it, r, 1.32); g.fill(); g.fillStyle = 'rgba(70,36,12,.09)'; burnPath(g, it, r, 1.13); g.fill();
  if (it.noHole) { g.restore(); return; }
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; burnPath(g, it, r); g.fill(); g.globalCompositeOperation = 'source-atop';
  if (last) { for (const [lw, a] of [[80, .22], [40, .55], [16, .92]]) { g.lineWidth = lw; g.strokeStyle = `rgba(28,15,7,${a})`; burnPath(g, it, r); g.stroke(); } }
  else { g.lineWidth = 34; g.strokeStyle = 'rgba(26,13,6,.72)'; burnPath(g, it, r); g.stroke(); g.lineWidth = 4; g.strokeStyle = 'rgba(120,40,14,.5)'; burnPath(g, it, r); g.stroke(); }
  g.restore();
}
const STEP = {
  brush: (g, it, k, rc) => { if (rc) { const b = it.S[k], m = it.w + 160; if (b.x < rc[0] - m || b.x > rc[2] + m || b.y < rc[1] - m || b.y > rc[3] + m) return; } drawStep(g, it, k); },
  burn: burnStep, blot: blotStep, bleed: bleedStep, ev: (g, it) => it.fn(g),
};
function runItems(g, items, done, t, rc) {
  for (let j = 0; j < items.length; j++) { const it = items[j]; if (t < it.t0) break;
    const u = it.dur > 0 ? clamp((t - it.t0) / it.dur) : 1, target = it.kind === 'brush' ? Math.floor(it.n * (u < 1 ? (it.ease || ATK)(u) : 1)) : Math.floor(it.n * u);
    while (done[j] < target) STEP[it.kind](g, it, ++done[j], rc); }
}
function advanceCell(c, t) {
  let p = c.p; if (!p) { p = POOL.reduce((a, b) => a.used < b.used ? a : b); if (p.owner) p.owner.p = null; p.owner = c; c.p = p; c.lastT = Infinity; }
  p.used = ++tick; const g = p.c.getContext('2d');
  if (t < c.lastT) { g.setTransform(CR, 0, 0, CR, -c.x0 * CR, -c.y0 * CR); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(c.x0, c.y0, CW, CH); paintPaper(g, c.x0, c.y0, CW, CH); c.done = c.items.map(() => 0); }
  g.setTransform(CR, 0, 0, CR, -c.x0 * CR, -c.y0 * CR); runItems(g, c.items, c.done, t, [c.x0, c.y0, c.x0 + CW, c.y0 + CH]); c.lastT = t; return p.c;
}
// ---------- overview: the whole world at 4096 px, baked once (everything before TL), late items drawn live ----------
const OVS = 4096, S0 = OVS / WW, OY0 = -4000, OH = 20000;  // the overview spans a taller paper band, so the final whole-picture frame (9:16) never shows past its edge
 let OV_BASE, OV_LIVE, OV_ITEMS, ovDone, ovLast = Infinity;
const ovClone = it => { if (it.kind !== 'brush') return it; const c = { ...it, w: it.w * (it.ovw ?? (it.thread ? 2.6 : 1.2)), step: 7, nb: 0 }; prep(c, it.seed); return c; };
function bakeOverview() {
  OV_BASE = mk(OVS, Math.round(OH * S0)); OV_LIVE = mk(OVS, Math.round(OH * S0)); const g = OV_BASE.getContext('2d'); g.setTransform(S0, 0, 0, S0, 0, -OY0 * S0); paintPaper(g, 0, OY0, WW, OH);
  const early = ITEMS.filter(it => it.t0 < TL).map(ovClone); runItems(g, early, early.map(() => 0), 1e9, null);
  OV_ITEMS = ITEMS.filter(it => it.t0 >= TL).map(ovClone);
}
function advanceOverview(t) {
  const g = OV_LIVE.getContext('2d');
  if (t < ovLast) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, OVS, OVS); g.drawImage(OV_BASE, 0, 0); ovDone = OV_ITEMS.map(() => 0); }
  g.setTransform(S0, 0, 0, S0, 0, -OY0 * S0); runItems(g, OV_ITEMS, ovDone, t, null); ovLast = t; return OV_LIVE;
}

// ---------- camera: hold on a station, follow the brush tip between stations, then the pull-back ----------
const ctr = s => [s.ox + 540, s.oy + s.fy];
function camAt(t) {
  if (t >= FIN0) { // ONE slow pull-back at a constant log speed (0.8 s ramp-in, 0.5 s ease-out) that lands on the whole picture at 131.6, then holds
    const [ax, ay] = ctr(S19), [bx0, by0, bx1, by1] = window.BBOX, z0 = .95, zE = 1080 / ((bx1 - bx0) * 1.035), cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
    const T = 131.6 - FIN0, r1 = .8, r2 = .5, d = clamp(t - FIN0, 0, T), s = d < r1 ? d * d / (2 * r1) : d < T - r2 ? d - r1 / 2 : T - r1 / 2 - r2 / 2 - (T - d) ** 2 / (2 * r2), u = s / (T - r1 / 2 - r2 / 2), z = z0 * Math.pow(zE / z0, u);
    const f = (1 / z - 1 / z0) / (1 / zE - 1 / z0); return { x: lerp(ax, cx, f), y: lerp(ay, cy, f), z }; } // x,y ∝ 1/z: a zoom about a fixed screen point that drifts to the picture centre
  let hold = FOLLOW[0].a;
  for (const f of FOLLOW) {
    if (t < f.t0) break;
    if (t <= f.t1) { const u = (t - f.t0) / (f.t1 - f.t0), tip = tipAt(f.lk, t), a0 = f.lk.S[0], a1 = f.lk.S[f.lk.n], [px, py] = ctr(f.a), [qx, qy] = ctr(f.b), e = smooth(u);
      let ox = lerp(px - a0.x, qx - a1.x, e), oy = lerp(py - a0.y, qy - a1.y, e);
      if (f.mid) { const e1 = smooth(u / .1), e2 = smooth((u - .9) / .1); ox = u < .5 ? lerp(px - a0.x, f.mid[0], e1) : lerp(f.mid[0], qx - a1.x, e2); oy = u < .5 ? lerp(py - a0.y, f.mid[1], e1) : lerp(f.mid[1], qy - a1.y, e2); }
      return { x: tip.x + ox, y: tip.y + oy, z: lerp(f.a.z, f.b.z, e) }; }
    hold = f.b;
  }
  const [x, y] = ctr(hold); return { x, y, z: hold.z };
}

// ---------- compositing ----------
function pulse(t) { let b = -9; for (const x of BEATS) { if (x > t) break; b = x; } return .35 * Math.exp(-(t - b) * 7); }
function shake(t) { let a = 0; for (const h of HITS) { const d = t - h.t; if (d >= 0 && d < .5) a += (h.kind === 'drop' ? 22 : 11) * Math.exp(-d * 9); } const db = t - 53.88; if (db >= 0 && db < .4) a += 26 * Math.exp(-db * 11); const d = t - 129.22; if (d >= 0 && d < .5) a += 16 * Math.exp(-d * 9); return a; }
function pushAt(t, cam) {
  if (t >= FIN0) return cam; let m = 1, fx = 0, fy = 0, ws = 0;
  for (const p of PUSH) { const d = t - p.t; if (d < 0 || d > p.hold + 1.3) continue; const e = d < .2 ? easeOut(d / .2) : d < .2 + p.hold ? 1 : 1 - smooth((d - .2 - p.hold) / 1.1), k = (p.z - 1) * e; m += k; fx += p.x * k; fy += p.y * k; ws += k; }
  if (ws > 0) { const s = clamp(1.4 * (1 - 1 / m)); cam.x += (fx / ws - cam.x) * s; cam.y += (fy / ws - cam.y) * s; cam.z *= m; } return cam;
}
function sparks(t) { // live embers + ash flying off a burning edge; the running flame on a burning fuse
  for (const f of FUSES) { if (t < f.tA || t > f.tB + .08) continue; const u = clamp((t - f.tA) / (f.tB - f.tA)), p = f.S[f.idx[Math.round(u * (f.idx.length - 1))]]; X.save(); X.globalCompositeOperation = isDark(p.x, p.y) ? 'source-over' : 'multiply';
    for (const [ox, hs, bs, col, a] of [[-22, .6, .7, RED, .85], [24, .7, .7, RED, .85], [0, 1, 1, RED, .9], [0, .62, .6, '#d84a22', .9], [2, .32, .32, '#f3b04c', .9]]) { // three tongues + hot core, flickering
      const fl = vnoise(t * 19 + ox + f.seed), h = (130 + 80 * fl) * hs, b = 78 * bs, dx = (vnoise(t * 13 + ox * .1) - .5) * 50 * hs + ox * .8, x = p.x + ox * .6, y = p.y + 8;
      X.globalAlpha = a; X.fillStyle = col; X.beginPath(); X.moveTo(x - b / 2, y); X.bezierCurveTo(x - b * .75, y - h * .35, x + dx - b * .35, y - h * .6, x + dx, y - h); X.bezierCurveTo(x + dx + b * .2, y - h * .55, x + b * .8, y - h * .3, x + b / 2, y); X.closePath(); X.fill(); }
    X.restore(); }
  for (const it of BURNS) { const te = it.t0 + it.dur; if (t < it.t0 || t > te + 1.6) continue; X.save();
    const R = rng(it.seed * 17);
    for (let i = 0; i < 90; i++) { const ts = it.t0 + (it.dur + .5) * R(), an = R() * 6.2832, life = .5 + .9 * R(), vy = 120 + 280 * R(), vx = (R() - .5) * 140, sz = 2 + 5 * R(), ash = R() < .35, age = t - ts;
      if (age < 0 || age > life) continue; const rr = easeOut(Math.min(1, (ts - it.t0) / it.dur)), f = 1 - age / life;
      const x = it.x + Math.cos(an) * it.rx * rr * 1.05 + vx * age + 25 * Math.sin(age * 7 + i), y = it.y + Math.sin(an) * it.ry * rr * 1.05 - vy * age + 50 * age * age;
      X.globalCompositeOperation = ash ? 'source-over' : 'lighter'; X.globalAlpha = f * (ash ? .7 : 1); X.fillStyle = ash ? '#6e6259' : (f > .55 ? '#ffd27a' : '#ff6a24'); X.fillRect(x, y, sz, sz * (ash ? .5 : 1)); }
    X.restore(); }
}
function render(t) {
  X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.globalCompositeOperation = 'source-over'; X.fillStyle = '#0a0807'; X.fillRect(0, 0, W, H);
  const cam = pushAt(t, camAt(t)), a = shake(t), sx = a * (vnoise(t * 37) - .5) * 2, sy = a * (vnoise(t * 37 + 9) - .5) * 2, z = cam.z * (1 + (t < FIN0 ? .012 * pulse(t) / .35 : 0)); // no beat breathing on the finale pull-back (read as the frame swimming)
  const ca = clamp((cam.z - ZOV) / .15); // cells and overview crossfade over z .55–.70 (a hard switch popped the thread width ~120 s)
  if (ca < 1) { X.setTransform(z / S0, 0, 0, z / S0, 540 - cam.x * z + sx, 960 - (cam.y - OY0) * z + sy); X.drawImage(advanceOverview(t), 0, 0); }
  if (ca > 0) {
    const vx0 = cam.x - 560 / z, vx1 = cam.x + 560 / z, vy0 = cam.y - 980 / z, vy1 = cam.y + 980 / z;
    X.setTransform(z, 0, 0, z, 540 - cam.x * z + sx, 960 - cam.y * z + sy); X.globalAlpha = ca;
    for (let iy = Math.floor(vy0 / CH); iy <= Math.floor(vy1 / CH); iy++) for (let ix = Math.floor(vx0 / CW); ix <= Math.floor(vx1 / CW); ix++) {
      const c = cell(ix, iy); X.drawImage(advanceCell(c, t), c.x0, c.y0, CW + 1.5 / z, CH + 1.5 / z); }
    X.globalAlpha = 1; sparks(t); }
  X.setTransform(1, 0, 0, 1, 0, 0); X.drawImage(VIG, 0, 0);
}

// ---------- contract ----------
(async () => {
  S = await (await fetch('assets/timing.json')).json(); BEATS = S.beats; HITS = S.hits;
  PAPER_L = buildPaper(PAPER, r => `rgba(130,108,70,${.05 + r * .07})`, r => `rgba(255,252,240,${.3 + r * .3})`, 1);
  PAPER_D = buildPaper(DARK, r => `rgba(0,0,0,${.2 + r * .2})`, r => `rgba(230,220,200,${.05 + r * .09})`, 2);
    VIG = mk(W, H); { const g = VIG.getContext('2d'), v = g.createRadialGradient(W / 2, H / 2, H * .32, W / 2, H / 2, H * .78); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,24,10,.32)'); g.fillStyle = v; g.fillRect(0, 0, W, H); }
  build(); register(); bakeOverview();
  { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const it of ITEMS) if (it.kind === 'brush' && it.t0 >= 0) for (const p of it.S) { const h = it.w * p.p / 2; x0 = Math.min(x0, p.x - h); y0 = Math.min(y0, p.y - h); x1 = Math.max(x1, p.x + h); y1 = Math.max(y1, p.y + h); }
    window.BBOX = [x0, y0, x1, y1]; } // the whole drawn picture; the final frame is fitted to it
  window.ready = true;
})();
window.frame = async t => render(t);
