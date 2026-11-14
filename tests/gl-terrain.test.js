// Task 4: the WebGL2 terrain renderer. Sky colour, skyline agreement with the CPU ray march,
// resize (Review Focus 2) and the render-target cap on dpr-3 phones (Review Focus 5).
const H = require('./harness');

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const near = (a, b, tol) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

// GL skyline row (first terrain row from the top, from the GL depth target) vs the CPU march, at 9 columns
async function skylineAgreement(page) {
  return page.evaluate(async () => {
    const g = window.__game, W = innerWidth;
    const xs = Array.from({ length: 9 }, (_, k) => Math.round(W * (k + 0.5) / 9));
    const gl = g.glSkylineRows(xs);
    const cpu = await g.cpuSkylineRows(xs);
    return xs.map((x, k) => ({ x, gl: gl[k], cpu: cpu[k] }));
  });
}
function reportAgreement(rows, label) {
  const bad = rows.filter(r => r.cpu != null && !(Math.abs(r.gl - r.cpu) <= 3));
  const used = rows.filter(r => r.cpu != null);
  H.check(used.length >= 5 && bad.length === 0, `${label}: GL skyline within 3 px of the CPU march at ${used.length} columns` +
    ` (worst ${Math.max(...used.map(r => Math.abs(r.gl - r.cpu))).toFixed(1)} px)` + (bad.length ? ' bad: ' + JSON.stringify(bad) : ''));
}

H.run('gl-terrain: pangarchulla, dark', async (keep) => {
  let { page, browser, errors } = await H.open({ theme: 'dark', noMap: true });
  keep(browser);
  await H.enter(page, 'pangarchulla');
  H.check(await page.evaluate(() => window.__game.glActive()), 'GL panorama is active');
  const img = await H.pixels(page);
  const top = img.px(img.width / 2, 2);
  H.check(near(top, hex('#0b0d11'), 6), `top-centre sky ${top} ≈ #0b0d11`);
  reportAgreement(await skylineAgreement(page), '1330×640');
  await H.shot(page, 'stage1-dark');

  await page.setViewportSize({ width: 800, height: 900 });
  await page.waitForTimeout(400);
  await page.waitForFunction(() => window.__game.ready(), null, { timeout: 60000 });
  const size = await page.evaluate(() => window.__game.glBufferSize());
  H.check(size.w >= 800 && size.h >= 900, `drawing buffer followed the resize (${size.w}×${size.h})`);
  reportAgreement(await skylineAgreement(page), '800×900');
  H.check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));

  // looking down in phone portrait: the ground under the viewer (closer than the first ring) is not painted as sky
  await page.evaluate(() => { window.__game.view.pitch = -0.45; window.__game.onViewChanged(); });
  await page.waitForTimeout(800);
  await page.addStyleTag({ content: '#labels, .corner, #vpbar, #compass, #guess, #info { display: none !important; }' });
  const dn = await H.pixels(page), bx = dn.width / 2, by = dn.height - 30, bc = dn.px(bx, by);
  const sk = await page.evaluate((y) => window.__game.skyRGB(y), by);
  const bd = await page.evaluate(([x, y]) => window.__game.depthAt([[x, y]])[0], [bx, by]);
  H.check(!bc.every((v, i) => Math.abs(v - sk[i]) <= 8) && Math.max(...bc) < 40, `bottom of the view looking down is dark ground ${bc}, not sky ${sk.map(Math.round)}`);
  H.check(bd > 0 && bd < 50, `and reads as ground right below (${bd && bd.toFixed(1)} m), not open sky`);
  H.check(errors.length === 0, 'no console errors looking down');
  await browser.close();

  ({ page, browser, errors } = await H.open({ theme: 'dark', noMap: true, dpr: 3 }));
  keep(browser);
  await H.enter(page, 'pangarchulla');
  const px = await page.evaluate(() => window.__game.glBufferPixels());
  H.check(px > 0 && px <= 4.2e6, `dpr 3: drawing buffer ${(px / 1e6).toFixed(2)} M pixels ≤ 4.2 M`);
  H.check(errors.length === 0, 'no console errors at dpr 3');
  await browser.close();

  // a mesh with holes (a quarter of the tiles never arrive) still draws a complete, opaque frame
  const lost = (url) => { const m = url.match(/terrarium\/(\d+)\/(\d+)\/(\d+)/); return !!m && (+m[2] * 7 + +m[3] * 13 + +m[1]) % 4 === 1; };
  ({ page, browser, errors } = await H.open({ theme: 'dark', noMap: true, blockTiles: lost }));
  keep(browser);
  await H.enter(page, 'pangarchulla');
  H.check(await page.evaluate(() => window.__game.glActive()), 'holes: GL panorama is active');
  const amin = await page.evaluate(() => window.__game.glAlphaMin());
  H.check(amin === 255, `holes: every pixel of the frame is opaque (min alpha ${amin})`);
  const terr = await page.evaluate(() => window.__game.depthPixels(500, 100000).length);
  H.check(terr > 2000, `holes: terrain still fills the view (${terr} grid cells)`);
  H.check(errors.filter(e => !/Failed to load resource|ERR_FAILED/.test(e)).length === 0, 'holes: no errors apart from the aborted tile loads');
  return browser;
});
