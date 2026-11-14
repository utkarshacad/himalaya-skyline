// Final-review fixes for phone smoothness:
//  I1 — a settle reads back a small depth grid, not the whole distance target;
//  I2 — a frame draws only the columns in view, not all 360° of the mesh.
const H = require('./harness');

H.run('gl-perf: work per frame and per settle', async (keep) => {
  const { page, browser, errors } = await H.open({ theme: 'dark', noMap: true, dpr: 2 });
  keep(browser);
  await H.enter(page, 'pangarchulla');
  await page.evaluate(() => window.__game.onViewChanged());
  await page.waitForTimeout(1200);                                   // one settle
  const s = await page.evaluate(() => ({ ...window.__game.stats(), buf: window.__game.glBufferPixels() }));
  H.check(s.depthReadPixels > 0 && s.depthReadPixels <= s.buf / 16 + 4096, `settle read ${s.depthReadPixels} px of a ${s.buf} px target (≤ 1/16)`);
  H.check(s.glIndices > 0 && s.glIndices <= s.meshIndices * 0.3, `frame drew ${s.glIndices} of ${s.meshIndices} indices at a ${(await page.evaluate(() => window.__game.view.hfov * 180 / Math.PI)).toFixed(0)}° view (≤ 30 %)`);
  // the view still matches the CPU march after the culling (skyline at 9 columns, across the 0°/360° seam too)
  for (const heading of [null, 0.02]) {
    if (heading !== null) { await page.evaluate((h) => { window.__game.view.heading = h; window.__game.onViewChanged(); }, heading); await page.waitForTimeout(1200); }
    const rows = await page.evaluate(async () => { const W = innerWidth, xs = Array.from({ length: 9 }, (_, k) => Math.round(W * (k + 0.5) / 9));
      const gl = window.__game.glSkylineRows(xs), cpu = await window.__game.cpuSkylineRows(xs); return xs.map((x, k) => [gl[k], cpu[k]]); });
    const used = rows.filter(r => r[1] != null), worst = Math.max(...used.map(r => Math.abs(r[0] - r[1])));
    H.check(used.length >= 5 && worst <= 3, `skyline within 3 px of the CPU march ${heading === null ? 'at the start view' : 'looking across the seam'} (worst ${worst.toFixed(1)} px)`);
  }
  H.check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  return browser;
});
