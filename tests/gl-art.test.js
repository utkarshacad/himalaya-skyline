// Stage 2 art in the terrain shader: snow tone, mist above the local valley floor, the light theme.
const { H, lum, hex, cdist, quiet, art, box, grid, capAndFlank } = require('./art-util');
const MIST_DARK = hex('#3a414b');

// lowest visible ground and a high point at a similar distance, in [lo, hi] metres
function valleyAndRidge(g, lo, hi) {
  const band = g.filter(c => c.d > lo && c.d < hi && c.y > 20);
  const valley = band.reduce((a, c) => (c.h < a.h ? c : a));
  const near = band.filter(c => c.d > valley.d * 0.8 && c.d < valley.d * 1.25);
  const ridge = near.reduce((a, c) => (c.h > a.h ? c : a));
  return { valley, ridge };
}

H.run('gl-art: snow, valley mist', async (keep) => {
  let { page, browser, errors } = await H.open({ theme: 'dark', noMap: true });
  keep(browser);
  await H.enter(page, 'pangarchulla'); await quiet(page);
  await art(page, { edges: false, flow: false, rivers: false });
  const img = await H.pixels(page);
  const { pk, cap, flank } = await capAndFlank(page, 'Dunagiri');
  const lc = lum(box(img, cap.x, cap.y)), lf = lum(box(img, flank.x, flank.y));
  H.check(lc - lf >= 25, `Dunagiri's cap (${lc.toFixed(0)}) is ≥ 25 brighter than the face ${Math.round(pk.h - flank.h)} m lower (${lf.toFixed(0)})`);

  // the snowline dips on lit ground: snow adds more to sun-facing slopes than to shaded ones at the same height
  const g = await grid(page);
  const band = g.filter(c => c.h > 5000 && c.h < 5400 && c.d > 8000 && c.d < 45000);
  const sun = await page.evaluate((pts) => window.__game.sunFacing(pts), band.map(c => [c.az, c.d]));
  await art(page, { snow: false });
  const noSnow = await H.pixels(page);
  await art(page, { snow: true });
  const add = (c) => lum(img.px(c.x, c.y)) - lum(noSnow.px(c.x, c.y));
  const lit = band.filter((c, k) => sun[k] > 0.12).map(add), shade = band.filter((c, k) => sun[k] < -0.12).map(add);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  H.check(lit.length > 20 && shade.length > 20 && mean(lit) > 3 && mean(lit) > mean(shade) * 1.5,
    `snow at 5,000–5,400 m adds ${mean(lit).toFixed(1)} on ${lit.length} lit cells vs ${mean(shade).toFixed(1)} on ${shade.length} shaded ones`);

  // mist pools in the valley, not on the ridge beside it
  const vr = valleyAndRidge(g, 8000, 30000);
  const cv = box(img, vr.valley.x, vr.valley.y, 2), cr = box(img, vr.ridge.x, vr.ridge.y, 2);
  H.check(cdist(cv, MIST_DARK) <= 14, `valley floor at ${(vr.valley.d / 1000).toFixed(0)} km, ${Math.round(vr.valley.h)} m is mist-coloured (${cv.map(Math.round)} vs ${MIST_DARK})`);
  H.check(cdist(cv, MIST_DARK) < cdist(cr, MIST_DARK), `and closer to the mist colour than the ridge at ${Math.round(vr.ridge.h)} m (${cr.map(Math.round)})`);

  // theme colours are prepared once, not per frame
  const tb = await page.evaluate(() => window.__game.stats().themeBuilds);
  for (let k = 0; k < 60; k++) await page.evaluate(() => { window.__game.view.heading += 0.004; window.__game.onViewChanged(); return new Promise(r => requestAnimationFrame(r)); });
  const tb2 = await page.evaluate(() => window.__game.stats().themeBuilds);
  H.check(tb >= 1 && tb2 === tb, `theme uniforms built ${tb} time(s), not while panning (${tb2})`);
  H.check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await H.shot(page, 'stage2-dark-terrain');
  await browser.close();

  // Kausani: every valley is far below 2,400 m, where an absolute mist height would fog ridge and valley alike
  ({ page, browser, errors } = await H.open({ theme: 'dark', noMap: true }));
  keep(browser);
  await H.enter(page, 'kausani'); await quiet(page);
  await art(page, { edges: false, flow: false, rivers: false });
  const im2 = await H.pixels(page), g2 = (await grid(page)).filter(c => c.h < 3200);
  const k = valleyAndRidge(g2, 18000, 45000);
  const kv = box(im2, k.valley.x, k.valley.y, 2), kr = box(im2, k.ridge.x, k.ridge.y, 2);
  H.check(cdist(kr, MIST_DARK) > 14, `kausani: a ridge top at ${Math.round(k.ridge.h)} m is not mist-coloured (${kr.map(Math.round)})`);
  H.check(cdist(kr, MIST_DARK) - cdist(kv, MIST_DARK) >= 8, `kausani: the valley at ${Math.round(k.valley.h)} m (${kv.map(Math.round)}) is clearly mistier than the ridge`);
  H.check(errors.length === 0, 'kausani: no console errors');
  await browser.close();

  // ---- Ink & Mist (light): warm paper, ink-wash ranges that lighten with distance, never pure white, no grain
  ({ page, browser, errors } = await H.open({ theme: 'light', noMap: true }));
  keep(browser);
  await H.enter(page, 'pangarchulla'); await quiet(page);
  await art(page, { edges: true, flow: false, rivers: false });
  const li = await H.pixels(page), lg = await grid(page);
  const top = box(li, li.width / 2, 10, 8);
  H.check(cdist(top, hex('#f6f3ec')) <= 6, `light: top-centre sky ${top.map(Math.round)} ≈ #f6f3ec`);
  let white = 0, sd = 0; const m0 = lum(top);
  for (let i = 0; i < li.data.length; i += 4) if (li.data[i] === 255 && li.data[i + 1] === 255 && li.data[i + 2] === 255) white++;
  for (let j = -8; j < 8; j++) for (let i = -8; i < 8; i++) sd += (lum(li.px(li.width / 2 + i, 10 + j)) - m0) ** 2;
  sd = Math.sqrt(sd / 256);
  H.check(white === 0, `light: no pure-white pixel (${white})`);
  H.check(sd < 0.5, `light: the sky is smooth, no grain (σ ${sd.toFixed(2)})`);
  await art(page, { edges: false });
  const lw = await H.pixels(page);
  const meanL = (cells) => cells.reduce((s, c) => s + lum(lw.px(c.x, c.y)), 0) / Math.max(1, cells.length);
  const nearL = meanL(lg.filter(c => c.d < 6000 && c.d > 300)), farL = meanL(lg.filter(c => c.d > 60000 && c.d < 100000));
  H.check(nearL < 110 && farL > 170, `light: ranges lighten with distance (near ${nearL.toFixed(0)} < 110, 60–100 km ${farL.toFixed(0)} > 170)`);
  const lv = valleyAndRidge(lg, 8000, 30000), lvc = box(lw, lv.valley.x, lv.valley.y, 2);
  H.check(cdist(lvc, hex('#e6e2d8')) <= 16, `light: the valley floor is paper mist (${lvc.map(Math.round)} vs ${hex('#e6e2d8')})`);
  const W = li.width, xs = Array.from({ length: 9 }, (_, k) => Math.round(W * (k + 0.5) / 9));
  const rows = await page.evaluate((xs) => window.__game.glSkylineRows(xs), xs);
  let inked = 0, seen = 0;
  xs.forEach((x, k) => { if (rows[k] == null || rows[k] < 6) return; seen++; if (lum(li.px(x, rows[k] - 4)) - Math.min(lum(li.px(x, rows[k])), lum(li.px(x, rows[k] + 1))) >= 40) inked++; });
  H.check(seen >= 5 && inked === seen, `light: the skyline is an ink line ≥ 40 darker than the sky at ${inked}/${seen} columns`);
  H.check(errors.length === 0, 'light: no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await art(page, { edges: true });
  await H.shot(page, 'stage2-light-wash');
  return browser;
});
