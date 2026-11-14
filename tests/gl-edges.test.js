// Task 5: depth-edge outlines. The skyline is a bright line above both the sky and the terrain below it,
// and ridges inside the terrain get lines too (not just the skyline).
const H = require('./harness');
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

H.run('gl-edges: pangarchulla, dark', async (keep) => {
  const { page, browser, errors } = await H.open({ theme: 'dark', noMap: true });
  keep(browser);
  await H.enter(page, 'pangarchulla');
  // hide the DOM overlays so they can't sit on the sampled pixels
  await page.addStyleTag({ content: '#labels, .corner, #vpbar, #compass { display: none !important; }' });
  const W = await page.evaluate(() => innerWidth);
  const xs = Array.from({ length: 9 }, (_, k) => Math.round(W * (k + 0.5) / 9));
  const rows = await page.evaluate((xs) => window.__game.glSkylineRows(xs), xs);
  const on = await H.pixels(page);
  let good = 0;
  const notes = [];
  xs.forEach((x, k) => {
    const y = rows[k]; if (y == null) return;
    const ls = lum(on.px(x, y)), la = lum(on.px(x, y - 3)), lb = lum(on.px(x, y + 4));
    if (ls - la >= 25 && ls - lb >= 25) good++; else notes.push(`x${x}: line ${ls.toFixed(0)} sky ${la.toFixed(0)} below ${lb.toFixed(0)}`);
  });
  H.check(good === rows.filter(r => r != null).length && good >= 5, `skyline brighter than sky above and terrain below by ≥ 25 at ${good} columns ${notes.join('; ')}`);
  await H.shot(page, 'stage1-edges');

  // ridge lines: pixels that brighten when the outline pass is on, away from the skyline
  await page.evaluate(() => { window.__game.glSetEdges(false); window.__game.onViewChanged(); });
  await page.waitForTimeout(800);
  const off = await H.pixels(page);
  const sky = await page.evaluate((w) => window.__game.glSkylineRows(Array.from({ length: w }, (_, x) => x)), on.width);
  let ridge = 0;
  for (let y = 0; y < on.height; y++) for (let x = 0; x < on.width; x++) {
    if (sky[x] != null && Math.abs(y - sky[x]) <= 2) continue;
    if (lum(on.px(x, y)) - lum(off.px(x, y)) > 12) ridge++;
  }
  H.check(ridge > 2000, `ridge-line pixels in the view: ${ridge} (> 2,000)`);
  await page.evaluate(() => { window.__game.glSetEdges(true); window.__game.onViewChanged(); });
  H.check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  return browser;
});
