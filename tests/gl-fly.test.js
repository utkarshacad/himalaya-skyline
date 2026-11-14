// Task 7: drag-to-fly. Dragging the handle up lifts the eye smoothly (never dipping), with no mesh
// rebuild; ridges drop as the eye rises; a double-click on the track lands back on the ground.
const H = require('./harness');

H.run('gl-fly: pangarchulla, drag the fly handle', async (keep) => {
  const { page, browser, errors } = await H.open({ theme: 'dark', noMap: true });
  keep(browser);
  await H.enter(page, 'pangarchulla');
  const s0 = await page.evaluate(() => window.__game.stats());
  const W = await page.evaluate(() => innerWidth);
  const row0 = (await page.evaluate((x) => window.__game.glSkylineRows([x]), Math.round(W / 2)))[0];

  // sample the eye offset on every animation frame while dragging
  await page.evaluate(() => { const g = window.__game; g.__eyes = []; const f = () => { g.__eyes.push(g.eyeOff); if (g.__sampling) requestAnimationFrame(f); }; g.__sampling = true; requestAnimationFrame(f); });
  const track = await page.$('#fly-track'), handle = await page.$('#fly-handle');
  H.check(!!track && !!handle && await track.isVisible(), 'the fly control is a drag track with a handle');
  const tb = await track.boundingBox(), hb = await handle.boundingBox();
  const x = hb.x + hb.width / 2, y0 = hb.y + hb.height / 2, travel = await page.evaluate(() => window.__game.flyTravel());
  await page.mouse.move(x, y0); await page.mouse.down();
  for (let i = 1; i <= 20; i++) { await page.mouse.move(x, y0 - travel * 0.6 * i / 20); await page.evaluate(() => new Promise(requestAnimationFrame)); }
  await page.mouse.up();
  await page.waitForFunction(() => Math.abs(window.__game.eyeOff - window.__game.eyeTarget) < 1, null, { timeout: 180000 });
  await page.evaluate(() => { window.__game.__sampling = false; });
  const eyes = await page.evaluate(() => window.__game.__eyes);
  const end = await page.evaluate(() => window.__game.eyeOff);
  let dips = 0; for (let i = 1; i < eyes.length; i++) if (eyes[i] < eyes[i - 1] - 1e-6) dips++;
  H.check(Math.abs(end - 3000) <= 150, `eye offset after dragging 60 % of the track: ${end.toFixed(0)} m (≈ 3,000)`);
  H.check(dips === 0 && eyes.length > 5, `eye rose monotonically over ${eyes.length} frames (${dips} dips)`);
  const s1 = await page.evaluate(() => window.__game.stats());
  H.check(s1.meshBuilds === s0.meshBuilds, `no mesh rebuild while flying (${s1.meshBuilds})`);
  await page.waitForFunction(() => window.__game.ready(), null, { timeout: 180000 });
  const row1 = (await page.evaluate((x) => window.__game.glSkylineRows([x]), Math.round(W / 2)))[0];
  H.check(row1 > row0 + 5, `skyline at the view centre moved down: row ${row0.toFixed(0)} → ${row1.toFixed(0)}`);
  await H.shot(page, 'stage1-fly3000');

  await page.dblclick('#fly-track');
  await page.waitForFunction(() => window.__game.eyeOff < 1, null, { timeout: 180000 });
  H.check(true, 'double-click on the track lands back on the ground');
  await page.keyboard.down('Shift'); await page.keyboard.press('ArrowUp'); await page.keyboard.up('Shift');
  await page.waitForFunction(() => Math.abs(window.__game.eyeOff - 250) < 1, null, { timeout: 180000 });
  H.check(true, 'Shift+↑ flies up 250 m');
  H.check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  return browser;
});
