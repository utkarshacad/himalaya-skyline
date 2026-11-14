// Task 4: the flow-line tracer. Lines are world-space polylines that start on high ground and run downhill.
// Vertex = 16 bytes: float32 east, north, height; uint8 u·255, weight·255, gully (127 ± 127·tanh(.6·conv)), flag (tier + 2·last).
const H = require('./harness');

// run one sector in a worker and measure the result inside the page
const measure = (page, opts) => page.evaluate(async (opts) => {
  const g = window.__game, r = await g.traceForTest(opts);
  const f = new Float32Array(r.verts), b = new Uint8Array(r.verts), n = f.length / 4, PPR = g.FLOW.PPR, D0 = g.FLOW.D0;
  const sm = (a, c, x) => { const t = Math.max(0, Math.min(1, (x - a) / (c - a))); return t * t * (3 - 2 * t); };
  const sep = (h) => 1.1 + 15 * Math.pow(1 - sm(3600, 7000, h), 1.3);
  let nan = 0; for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) if (f[i * 4 + k] !== f[i * 4 + k]) nan++;
  const lines = []; let cur = null;
  for (let i = 0; i < n; i++) {
    const flag = b[i * 16 + 15];
    if (!cur) { cur = { tier: flag & 1, o: i, n: 0 }; lines.push(cur); }
    cur.n++; if (flag & 2) cur = null;
  }
  const H_ = (i) => f[i * 4 + 2], U = (i) => b[i * 16 + 12];
  let uBad = 0, upBad = 0, short = 0, high = 0, openEnd = cur ? 1 : 0;
  for (const L of lines) {
    if (L.n < 6) short++;
    if (U(L.o) !== 0 || U(L.o + L.n - 1) !== 255) uBad++;
    for (let j = 1; j < L.n; j++) { if (U(L.o + j) < U(L.o + j - 1)) uBad++; if (H_(L.o + j) > H_(L.o + j - 1) + 3) upBad++; }
    if (H_(L.o) > 4500) high++;
  }
  // spacing: log-polar cells; a vertex well below its start has no vertex of another line (itself outside its bunching zone) too close
  const cell = (i) => { const e = f[i * 4], nn = f[i * 4 + 1], d = Math.hypot(e, nn); return [Math.atan2(e, nn) * PPR, Math.log(d / D0) * PPR]; };
  const owner = new Int32Array(n), deep = new Uint8Array(n);
  lines.forEach((L, k) => { for (let j = 0; j < L.n; j++) { owner[L.o + j] = k; deep[L.o + j] = H_(L.o) - H_(L.o + j) > 350 ? 1 : 0; } });
  const hash = new Map(), key = (a, v) => Math.floor(a / 8) * 100003 + Math.floor(v / 8);
  const C = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { const [a, v] = cell(i); C[i * 2] = a; C[i * 2 + 1] = v; const k = key(a, v); (hash.get(k) || hash.set(k, []).get(k)).push(i); }
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let tested = 0, crowded = 0;
  const tier0 = opts.tiers === 1 || true;
  for (let t = 0; t < 4000 && tested < 200; t++) {
    const i = Math.floor(rnd() * n); if (!deep[i] || (lines[owner[i]].tier !== 0)) continue;
    tested++; const r0 = 0.4 * sep(H_(i) - 2), a = C[i * 2], v = C[i * 2 + 1]; let hit = false;
    for (let da = -8; da <= 8 && !hit; da += 8) for (let dv = -8; dv <= 8 && !hit; dv += 8) for (const j of hash.get(key(a + da, v + dv)) || []) {
      if (owner[j] === owner[i] || !deep[j] || lines[owner[j]].tier !== 0) continue;
      if (Math.hypot(C[j * 2] - a, C[j * 2 + 1] - v) < r0) { hit = true; break; }
    }
    if (hit) crowded++;
  }
  // tier 1 starts keep clear of tier-0 vertices
  let t1 = 0, t1Close = 0;
  for (const L of lines) if (L.tier === 1) {
    t1++; const i = L.o, a = C[i * 2], v = C[i * 2 + 1], r1 = 0.25 * sep(H_(i) - 2) * 0.5;
    out: for (let da = -8; da <= 8; da += 8) for (let dv = -8; dv <= 8; dv += 8) for (const j of hash.get(key(a + da, v + dv)) || [])
      if (lines[owner[j]].tier === 0 && Math.hypot(C[j * 2] - a, C[j * 2 + 1] - v) < r1) { t1Close++; break out; }
  }
  return { ms: r.ms, nVerts: n, nLines: lines.length, reported: r.nLines, nan, uBad, upBad, short, high, openEnd, tested, crowded, t1, t1Close, bands: r.bands };
}, opts);

H.run('flow-trace: the sector facing Dunagiri', async (keep) => {
  let { page, browser, errors } = await H.open({ theme: 'dark', noMap: true });
  keep(browser);
  await H.enter(page, 'pangarchulla');
  const a = await measure(page, { tiers: 2 });
  console.log(`  one sector, both tiers: ${a.nLines} lines, ${a.nVerts} vertices, ${(a.ms / 1000).toFixed(1)} s`);
  H.check(a.nLines > 300 && a.reported === a.nLines, `${a.nLines} lines (> 300), as reported`);
  H.check(a.nan === 0, 'no NaN in the vertices');
  H.check(a.uBad === 0 && a.openEnd === 0, `u runs 0 → 1 without going back on every line (${a.uBad} bad)`);
  H.check(a.upBad === 0, `lines only run downhill (${a.upBad} rising steps)`);
  H.check(a.short === 0, `every line has at least 6 vertices (${a.short} shorter)`);
  H.check(a.high / a.nLines > 0.6, `${Math.round(100 * a.high / a.nLines)} % of lines start above 4,500 m (> 60 %)`);
  const hi = a.bands.line55 / Math.max(1, a.bands.cand55), lo = a.bands.line33 / Math.max(1, a.bands.cand33);
  H.check(a.bands.cand55 > 100 && a.bands.cand33 > 100 && hi >= 5 * lo, `ground above 5,500 m is seeded ${(hi / Math.max(lo, 1e-9)).toFixed(1)}× as densely as 3,300–4,000 m (≥ 5×)`);
  H.check(a.tested >= 150 && a.crowded === 0, `spacing holds below the bunching zone (${a.crowded} of ${a.tested} vertices crowded)`);
  H.check(a.t1 > 50 && a.t1Close === 0, `fine-tier lines (${a.t1}) start clear of the base tier (${a.t1Close} too close)`);
  const base = await measure(page, { tiers: 1 });
  H.check(base.t1 === 0 && base.nLines < a.nLines, `tiers: 1 traces the base tier only (${base.nLines} lines)`);
  const small = await measure(page, { tiers: 2, budget: 2000 });
  H.check(small.nVerts <= 2000 && small.nVerts > 500, `budget 2,000 → ${small.nVerts} vertices`);
  const broke = await page.evaluate(() => window.__game.askBrokenWorker());
  H.check(broke === 'rejected', `ask() on a worker that throws: ${broke}`);
  const slow = await page.evaluate(() => window.__game.askSilentWorker(400));
  H.check(slow === 'timeout', `ask() on a worker that never answers: ${slow}`);
  H.check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close();

  const lost = (url) => { const m = url.match(/terrarium\/(\d+)\/(\d+)\/(\d+)/); return !!m && (+m[2] * 7 + +m[3] * 13 + +m[1]) % 4 === 1; };
  ({ page, browser, errors } = await H.open({ theme: 'dark', noMap: true, blockTiles: lost }));
  keep(browser);
  await H.enter(page, 'pangarchulla');
  const h = await measure(page, { tiers: 2 });
  H.check(h.nan === 0 && h.nLines > 50 && h.uBad === 0, `with a quarter of the tiles missing: ${h.nLines} lines, no NaN`);
  return browser;
});
