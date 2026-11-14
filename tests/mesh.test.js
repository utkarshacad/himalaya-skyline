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
    for (let i = 0; i < cols * rows; i++) if (attr[i * 4 + 3] < -1e8) holes++;
    let nanAttr = 0; for (let i = 0; i < attr.length; i++) if (attr[i] !== attr[i]) nanAttr++;
    let ratioErr = 0; const r0 = rings[1] / rings[0];
    for (let r = 1; r < rows; r++) ratioErr = Math.max(ratioErr, Math.abs(rings[r] / rings[r - 1] - r0));
    // 20 random grid points: mesh height vs elevAt at the same polar point (computed in the worker)
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pts = [];
    for (let k = 0; k < 20; k++) { const c = Math.floor(rnd() * cols), r = Math.floor(rnd() * rows); pts.push({ c, r, az: 2 * Math.PI * c / cols, d: rings[r] }); }
    const ref = await window.__game.elevAtPolarForTest(pts.map(p => [p.az, p.d]));
    let maxErr = 0, compared = 0, posErr = 0;
    pts.forEach((p, k) => {
      const i = p.r * cols + p.c, h = pos[i * 3 + 2];
      const e = pos[i * 3], n = pos[i * 3 + 1];
      posErr = Math.max(posErr, Math.abs(Math.hypot(e, n) - p.d));
      if (ref[k] === ref[k] && attr[i * 4 + 3] > -1e8) { compared++; maxErr = Math.max(maxErr, Math.abs(h - ref[k])); }
    });
    return { ms, cols, rows, verts: pos.length / 3, attrLen: attr.length, idxLen: m.index.length, ring0: rings[0], ringN: rings[rows - 1], ratioErr, nanPos, nanAttr, holes, maxErr, compared, posErr };
  });
}

H.run('mesh: polar grid around the viewer', async (keep) => {
  let { page, browser, errors } = await H.open({ theme: 'dark', noMap: true });
  keep(browser);
  await H.enter(page, 'pangarchulla');
  const a = await meshChecks(page);
  console.log(`  pangarchulla mesh built in ${(a.ms / 1000).toFixed(2)} s`);
  H.check(a.verts === a.cols * a.rows && a.cols === 2048 && a.rows === 600, `vertex count ${a.verts} = ${a.cols}×${a.rows}`);
  H.check(a.attrLen === a.verts * 4, 'attr has 4 floats per vertex');
  H.check(a.idxLen === a.cols * (a.rows - 1) * 6, `index covers the wrapped grid (${a.idxLen})`);
  H.check(Math.abs(a.ring0 - 12) < 1e-3 && Math.abs(a.ringN - 235000) < 1, `rings ${a.ring0.toFixed(3)} … ${a.ringN.toFixed(1)} m`);
  H.check(a.ratioErr < 1e-6 * 2, `ring ratio constant (max deviation ${a.ratioErr.toExponential(2)})`);
  H.check(a.compared >= 15 && a.maxErr < 0.5, `heights match elevAt within 0.5 m on ${a.compared}/20 points (max ${a.maxErr.toFixed(3)} m)`);
  H.check(a.posErr < 0.05, `east/north radius matches ring distance (max ${a.posErr.toFixed(4)} m)`);
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
