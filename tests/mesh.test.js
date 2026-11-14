// Task 3: the polar terrain mesh built in a worker. Geometry, heights against elevAt, no NaN,
// and (Review Focus 3) a mesh with flagged holes but no NaN when a quarter of the tiles never arrive.
const H = require('./harness');

async function meshChecks(page) {
  return page.evaluate(async () => {
    const t0 = performance.now();
    const m = await window.__game.buildMeshForTest();
    const ms = performance.now() - t0;
    const { cols, rows, rings, pos, attr } = m;
    let nanPos = 0, holes = 0;
    for (let i = 0; i < pos.length; i++) if (pos[i] !== pos[i]) nanPos++;
    for (let i = 0; i < cols * rows; i++) if (attr[i * 6 + 3] === -32768) holes++;
    let nanAttr = 0; for (let i = 0; i < attr.length; i++) if (attr[i] !== attr[i]) nanAttr++;
    let ratioErr = 0; const r0 = rings[1] / rings[0];
    for (let r = 1; r < rows; r++) ratioErr = Math.max(ratioErr, Math.abs(rings[r] / rings[r - 1] - r0));
    // 20 random grid points: mesh height vs elevAt at the same polar point (computed in the worker)
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pts = [];
    // each vertex sits on its column's ray, inside its ring cell [rings[r]·q^−½, rings[r]·q^½] (snapped to the cell's high point)
    const q = Math.sqrt(r0);
    for (let k = 0; k < 20; k++) {
      const c = Math.floor(rnd() * cols), r = Math.floor(rnd() * rows), i = r * cols + c;
      pts.push({ c, r, az: 2 * Math.PI * c / cols, d: Math.hypot(pos[i * 3], pos[i * 3 + 1]) });
    }
    const ref = await window.__game.elevAtPolarForTest(pts.map(p => [p.az, p.d]));
    let maxErr = 0, compared = 0, posErr = 0, azErr = 0;
    pts.forEach((p, k) => {
      const i = p.r * cols + p.c, h = pos[i * 3 + 2];
      const e = pos[i * 3], n = pos[i * 3 + 1], lo = rings[p.r] / q, hi = rings[p.r] * q;
      posErr = Math.max(posErr, p.d < lo - 0.01 ? lo - p.d : p.d > hi + 0.01 ? p.d - hi : 0);
      azErr = Math.max(azErr, Math.abs(Math.atan2(e, n) - (p.az > Math.PI ? p.az - 2 * Math.PI : p.az)));
      if (ref[k] === ref[k] && attr[i * 6 + 3] !== -32768) { compared++; maxErr = Math.max(maxErr, Math.abs(h - ref[k])); }
    });
    // valley floor (attr[4]): never above the vertex, far below a summit, close under a valley bottom
    let floorBad = 0, floorSeen = 0;
    for (let k = 0; k < 20; k++) {
      const i = Math.floor(rnd() * cols * rows); if (attr[i * 6 + 3] === -32768) continue;
      floorSeen++; const dh = pos[i * 3 + 2] - attr[i * 6 + 4];
      if (!(dh >= -1 && dh < 6000)) floorBad++;
    }
    const pk = window.__game.CUR.peaks.find(q => q.name === 'Dunagiri');
    const pc = Math.round(((pk.az % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / (2 * Math.PI) * cols) % cols;
    let pr = 0; for (let r = 0; r < rows; r++) if (Math.abs(rings[r] - pk.d) < Math.abs(rings[pr] - pk.d)) pr = r;
    let summitRise = -1e9;                       // the highest vertex within ±2 cells of the summit
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) { const i = (pr + dr) * cols + (pc + dc + cols) % cols; if (attr[i * 6 + 3] !== -32768) summitRise = Math.max(summitRise, pos[i * 3 + 2] - attr[i * 6 + 4]); }
    let low = -1;
    for (let i = 0; i < cols * rows; i++) { const d = Math.hypot(pos[i * 3], pos[i * 3 + 1]); if (d > 3000 && d < 20000 && attr[i * 6 + 3] !== -32768 && (low < 0 || pos[i * 3 + 2] < pos[low * 3 + 2])) low = i; }
    const lowRise = low < 0 ? NaN : pos[low * 3 + 2] - attr[low * 6 + 4];
    const peakMB = window.__game.stats().meshPeakMB, isI16 = attr instanceof Int16Array;
    return { floorBad, floorSeen, summitRise, lowRise, peakMB, isI16, ms, cols, rows, verts: pos.length / 3, attrLen: attr.length, idxLen: m.index.length, ring0: rings[0], ringN: rings[rows - 1], ratioErr, nanPos, nanAttr, holes, maxErr, compared, posErr, azErr };
  });
}

H.run('mesh: polar grid around the viewer', async (keep) => {
  let { page, browser, errors } = await H.open({ theme: 'dark', noMap: true });
  keep(browser);
  await H.enter(page, 'pangarchulla');
  const a = await meshChecks(page);
  console.log(`  pangarchulla mesh built in ${(a.ms / 1000).toFixed(2)} s`);
  H.check(a.verts === a.cols * a.rows && a.cols === 2048 && a.rows === 600, `vertex count ${a.verts} = ${a.cols}×${a.rows}`);
  H.check(a.isI16 && a.attrLen === a.verts * 6, 'attr is an Int16Array with 6 values per vertex');
  H.check(a.floorSeen >= 15 && a.floorBad === 0, `valley floor is at or below the vertex on ${a.floorSeen} random vertices`);
  H.check(a.summitRise > 1500, `Dunagiri's summit stands ${Math.round(a.summitRise)} m above its valley floor (> 1500)`);
  H.check(a.lowRise < 150, `the lowest ground within 20 km is ${Math.round(a.lowRise)} m above its floor (< 150)`);
  H.check(a.peakMB > 0 && a.peakMB < 45, `mesh build peak ${a.peakMB && a.peakMB.toFixed(1)} MB < 45`);
  H.check(a.idxLen === a.cols * (a.rows - 1) * 6, `index covers the wrapped grid (${a.idxLen})`);
  H.check(Math.abs(a.ring0 - 12) < 1e-3 && Math.abs(a.ringN - 235000) < 1, `rings ${a.ring0.toFixed(3)} … ${a.ringN.toFixed(1)} m`);
  H.check(a.ratioErr < 1e-6 * 2, `ring ratio constant (max deviation ${a.ratioErr.toExponential(2)})`);
  H.check(a.compared >= 15 && a.maxErr < 0.5, `heights match elevAt within 0.5 m on ${a.compared}/20 points (max ${a.maxErr.toFixed(3)} m)`);
  H.check(a.posErr < 0.05 && a.azErr < 1e-5, `vertices lie on their column's ray inside their ring cell (radius ${a.posErr.toFixed(4)} m, az ${a.azErr.toExponential(1)} rad off)`);
  H.check(a.nanPos === 0 && a.nanAttr === 0, `no NaN in pos/attr (${a.nanPos}/${a.nanAttr})`);
  H.check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close();

  // about a quarter of the tiles never arrive from either host (chosen by tile coordinates)
  const lost = (url) => { const m = url.match(/terrarium\/(\d+)\/(\d+)\/(\d+)/); return !!m && (+m[2] * 7 + +m[3] * 13 + +m[1]) % 4 === 1; };
  ({ page, browser, errors } = await H.open({ theme: 'dark', noMap: true, blockTiles: lost }));
  keep(browser);
  await H.enter(page, 'pangarchulla');
  const b = await meshChecks(page);
  H.check(b.holes > 0, `missing tiles leave flagged holes (${b.holes} vertices)`);
  H.check(b.nanPos === 0 && b.nanAttr === 0, `still no NaN in pos/attr (${b.nanPos}/${b.nanAttr})`);
  H.check(errors.filter(e => !/Failed to load resource|ERR_FAILED/.test(e)).length === 0, 'no errors apart from the aborted tile loads');
  return browser;
});
