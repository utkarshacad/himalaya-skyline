// Task 6: flow lines on the GPU — accumulated, depth-tested, compressed. Bright caps, no hard white, quiet gullies,
// nothing traced or uploaded while the view moves, and fallbacks when the GPU can't render to half floats.
const { H, lum, quiet, art, box, capAndFlank } = require('./art-util');
const settle = (page, t = 240000) => page.waitForFunction(() => window.__game.flowSettled(), null, { timeout: t, polling: 250 });
const capDelta = async (page, cap) => {
  await art(page, { flow: true }); const on = lum(box(await H.pixels(page), cap.x, cap.y));
  await art(page, { flow: false }); const off = lum(box(await H.pixels(page), cap.x, cap.y));
  await art(page, { flow: true }); return on - off;
};
const frames = async (page, n, fn) => { for (let k = 0; k < n; k++) await page.evaluate(fn); };
const counters = (page) => page.evaluate(() => { const s = window.__game.stats(); return [s.flowTraces, s.lineUploads, s.meshBuilds].join('/'); });

H.run('gl-lines: flow lines on the GPU', async (keep) => {
  let { page, browser, errors } = await H.open({ theme: 'dark', noMap: true });
  keep(browser);
  // progressive first visit: terrain is up while lines are still arriving
  await H.enter(page, 'pangarchulla'); await quiet(page);
  const mid = await page.evaluate(() => { const s = window.__game.Flow.state(); return { done: s.done, ready: window.__game.ready() }; });
  H.check(mid.ready && mid.done < 16, `terrain is drawn before the lines are all in (${mid.done}/16 sectors)`);
  await settle(page);
  await art(page, { edges: false });
  const { cap } = await capAndFlank(page, 'Dunagiri');
  const dc = await capDelta(page, cap);
  H.check(dc >= 30, `flow lines brighten Dunagiri's cap by ${dc.toFixed(0)} (≥ 30)`);

  // no hard white anywhere on the terrain, with outlines on
  await art(page, { edges: true });
  const img = await H.pixels(page);
  const terrainCells = await page.evaluate(() => window.__game.gridInfo().map(c => [c.x, c.y]));
  let max = 0, over = 0, n = 0;
  for (const [x, y] of terrainCells) for (let j = -1; j <= 2; j++) for (let i = -1; i <= 2; i++) { const p = img.px(x + i, y + j), m = Math.max(...p); n++; if (m > max) max = m; if (m > 205) over++; }
  H.check(max < 228, `brightest terrain channel ${max} (< 228)`);
  H.check(over / n < 0.0005, `${(100 * over / n).toFixed(3)} % of terrain pixels above 205 (< 0.05 %)`);

  // quiet gullies: the most concave ground is barely brighter than the ground beside it
  await art(page, { edges: false });
  const gim = await H.pixels(page), cc = await page.evaluate(() => window.__game.concaveCells(20));
  let gd = 0; for (const c of cc) gd += lum(box(gim, c.x, c.y, 1)) - (lum(box(gim, c.x - 6, c.y, 1)) + lum(box(gim, c.x + 6, c.y, 1))) / 2;
  gd /= Math.max(1, cc.length);
  H.check(cc.length >= 15 && gd <= 12, `${cc.length} gully points are ${gd.toFixed(1)} brighter than their flanks (≤ 12)`);

  // depth test: a bright synthetic line behind a nearer ridge leaves its pixels untouched; the same line in the open shows
  const pts = await page.evaluate(() => {
    const g = window.__game.gridInfo(), W = innerWidth, out = { hidden: null, open: null };
    // a column where near terrain (< 12 km) hides ground far behind it: put the line 2.5× farther, just under the near skyline
    for (const c of g) {
      if (out.hidden && out.open) break;
      if (c.x < 80 || c.x > W - 80) continue;
      if (!out.hidden && c.d > 3000 && c.d < 12000) { const above = g.find(o => Math.abs(o.x - c.x) < 3 && o.y < c.y - 30 && o.y > c.y - 60); if (above && above.d > c.d * 1.5)
        out.hidden = { az: c.az, d: c.d * 2.5, h: c.h - 200 }; }
      if (!out.open && c.d > 15000 && c.d < 40000 && c.h < 4000) out.open = { az: c.az, d: c.d, h: c.h + 2 };
    }
    return out;
  });
  H.check(!!pts.hidden && !!pts.open, 'found a hidden and an open spot for the synthetic line');
  if (pts.hidden && pts.open) {
    const diff = async (spot) => {
      await page.evaluate(() => { window.__game.setArt({ only: 99 }); });
      const p = await page.evaluate((s) => window.__game.synthLine(99, s.az, s.d, s.h), spot);
      await art(page, { flow: true }); const A = await H.pixels(page);
      await art(page, { flow: false }); const B = await H.pixels(page);
      let m = 0; for (let j = -3; j <= 3; j++) for (let i = -12; i <= 12; i++) m = Math.max(m, lum(A.px(p.x + i, p.y + j)) - lum(B.px(p.x + i, p.y + j)));
      return m;
    };
    const dOpen = await diff(pts.open), dHid = await diff(pts.hidden);
    H.check(dOpen >= 10, `the synthetic line in the open brightens its pixels (+${dOpen.toFixed(0)})`);
    H.check(dHid <= 2, `the same line behind a ridge leaves them untouched (+${dHid.toFixed(0)})`);
    await page.evaluate(() => { window.__game.GLPano.clearFlowSector(99); window.__game.setArt({ only: null, flow: true }); });
  }

  // panning, zoom and fly are uniforms only
  const c0 = await counters(page);
  await frames(page, 120, () => { window.__game.view.heading += 0.006; window.__game.onViewChanged(); return new Promise(r => requestAnimationFrame(r)); });
  H.check(await counters(page) === c0, `120 pan frames: traces/uploads/mesh builds unchanged (${c0})`);
  await page.evaluate(() => { window.__game.view.heading -= 0.72; window.__game.onViewChanged(); });
  await page.evaluate(() => window.__game.setEyeOffset(3000));
  await page.waitForFunction(() => Math.abs(window.__game.eyeOff - 3000) < 1, null, { timeout: 180000 });
  const { cap: cap2 } = await capAndFlank(page, 'Dunagiri');
  const df = await capDelta(page, cap2);
  H.check(df >= 15 && await counters(page) === c0, `at +3,000 m the cap still has lines (+${df.toFixed(0)}), nothing re-traced`);
  await page.evaluate(() => window.__game.setEyeOffset(0));
  await page.waitForFunction(() => window.__game.eyeOff === 0, null, { timeout: 180000 });

  // two density tiers: the fine tier adds lines when zoomed in, nothing at the default zoom
  const lit = async (c) => lum(box(await H.pixels(page), c.x, c.y + 6, 10));   // mean brightness just under the summit
  const hf = await page.evaluate(() => window.__game.view.hfov);
  const { cap: c1 } = await capAndFlank(page, 'Dunagiri');
  await art(page, { fine: true }); const f1 = await lit(c1); await art(page, { fine: false }); const f0 = await lit(c1);
  H.check(Math.abs(f1 - f0) < 0.5, `at 1× zoom the fine tier is hidden (${f1.toFixed(1)} vs ${f0.toFixed(1)})`);
  await page.evaluate((hf) => { window.__game.setFov(hf / 2.2, true); window.__game.onViewChanged(); }, hf);
  await page.waitForTimeout(500);
  const { cap: cz } = await capAndFlank(page, 'Dunagiri');
  await art(page, { fine: true }); const z1 = await lit(cz); await art(page, { fine: false }); const z0 = await lit(cz);
  H.check(z1 - z0 >= 2, `at 2.2× zoom the fine tier brightens the cap (${z1.toFixed(1)} vs ${z0.toFixed(1)})`);
  await art(page, { fine: true });
  H.check(await page.evaluate(() => window.__game.stats().lineDraws) <= 16, 'at most 16 sector draws a frame');
  H.check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await H.shot(page, 'stage2-dark-lines-zoom');
  await browser.close();

  // no half-float render targets: lines accumulate in 8 bits
  ({ page, browser, errors } = await H.open({ theme: 'dark', noMap: true, init: () => {
    const g = WebGL2RenderingContext.prototype.getExtension;
    WebGL2RenderingContext.prototype.getExtension = function (n) { return /color_buffer_(half_)?float/i.test(n) ? null : g.call(this, n); };
  } }));
  keep(browser);
  await H.enter(page, 'pangarchulla'); await quiet(page); await settle(page);
  H.check(await page.evaluate(() => window.__game.flowMode()) === 'byte', 'no float buffers → 8-bit accumulation');
  await art(page, { edges: false });
  const { cap: cb } = await capAndFlank(page, 'Dunagiri');
  const db = await capDelta(page, cb);
  H.check(db >= 20, `8-bit lines still brighten the cap (+${db.toFixed(0)})`);
  H.check(errors.length === 0, '8-bit: no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close();

  // the accumulation target can't be built at all: no lines, terrain still drawn
  ({ page, browser, errors } = await H.open({ theme: 'dark', noMap: true, init: () => {
    const c = WebGL2RenderingContext.prototype.checkFramebufferStatus;
    WebGL2RenderingContext.prototype.checkFramebufferStatus = function (t) {
      const two = this.getFramebufferAttachmentParameter(t, this.COLOR_ATTACHMENT1, this.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE);
      return two === this.NONE ? this.FRAMEBUFFER_INCOMPLETE_ATTACHMENT : c.call(this, t);
    };
  } }));
  keep(browser);
  await H.enter(page, 'pangarchulla');
  H.check(await page.evaluate(() => window.__game.flowMode()) === 'off', 'no accumulation target → flow lines off');
  H.check(await page.evaluate(() => window.__game.glActive() && window.__game.depthPixels(500, 100000).length > 2000), 'and the terrain still draws');
  H.check(errors.length === 0, 'no accumulation target: no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  return browser;
});
