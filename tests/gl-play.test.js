// Task 6: the play view runs on GLPano. Quiz flow, telescope, panning without re-renders, and the
// visibility slider as a live uniform (no mesh rebuild, far ranges become sky).
const H = require('./harness');

H.run('gl-play: kausani', async (keep) => {
  const { page, browser, errors } = await H.open({ theme: 'dark', noMap: true });
  keep(browser);
  await H.enter(page, 'kausani');
  H.check(await page.evaluate(() => window.__game.glActive()), 'GL panorama is active');
  await page.waitForTimeout(600);                                         // let the first settle read the depth grid

  // ---- quiz: open the first "?", a wrong guess shakes, the right guess scores and shows the info bar
  const q = (await page.$$('#labels .q')).filter(Boolean);
  let opened = null;
  for (const b of q) if (await b.isVisible()) { await b.click(); opened = await page.evaluate(() => window.__game.guessTarget && window.__game.guessTarget.name); break; }
  H.check(!!opened, `a quiz marker opened the guess box (${opened})`);
  const wrong = opened === 'Everest' ? 'Trisul' : 'Everest';
  await page.fill('#g-input', wrong); await page.press('#g-input', 'Enter');
  H.check(await page.evaluate(() => document.getElementById('guess').classList.contains('shake')), `wrong guess "${wrong}" shakes the box`);
  await page.fill('#g-input', opened); await page.press('#g-input', 'Enter');
  await page.waitForTimeout(200);
  const nm = await page.textContent('#info-nm');
  H.check(nm.startsWith('Got it · ' + opened), `info bar after the right guess: "${nm}"`);
  const prog = await page.textContent('#pl-progress'), nVis = await page.evaluate(() => window.__game.CUR.peaks.filter(p => p.visible).length);
  H.check(prog === `1/${nVis}`, `progress ${prog} (want 1/${nVis}; plan expected 1/7)`);

  // ---- telescope
  await page.click('#scope-btn'); await page.waitForTimeout(300);
  const sc = await page.textContent('#info-nm');
  H.check(/^Terrain|^Unnamed peak|^Open sky/.test(sc) || (await page.evaluate((t) => window.__game.CUR.peaks.some(p => t.includes(p.name)), sc)), `telescope reads "${sc}"`);
  const scDepth = await page.evaluate(() => window.__game.depthAtCentre());
  H.check(scDepth > 0, `telescope depth under the crosshair: ${Math.round(scDepth)} m`);
  await page.click('#scope-btn');

  // ---- 120 pan frames: no re-render on the processor
  const s0 = await page.evaluate(() => window.__game.stats());
  const box = await page.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(box.x, box.y); await page.mouse.down();
  for (let i = 1; i <= 120; i++) { await page.mouse.move(box.x - i * 3, box.y); await page.evaluate(() => new Promise(requestAnimationFrame)); }
  await page.mouse.up();
  await page.waitForTimeout(500);
  const s1 = await page.evaluate(() => window.__game.stats());
  H.check(s1.newGen === 0 && s0.newGen === 0, `processor generations during play: ${s1.newGen}`);
  H.check(s1.glFrames - s0.glFrames >= 60, `GL frames drawn while panning: ${s1.glFrames - s0.glFrames}`);

  // ---- visibility 150 → 60 km: no mesh rebuild, terrain at ~100 km turns into sky
  const far = await page.evaluate(() => window.__game.depthPixels(90000, 110000));
  H.check(far.length > 20, `depth-grid cells (4×4 px) showing terrain at 90–110 km before: ${far.length}`);
  await page.evaluate(() => { const v = document.getElementById('vis'); v.value = 60; v.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(800);
  const s2 = await page.evaluate(() => window.__game.stats());
  H.check(s2.meshBuilds === s1.meshBuilds, `mesh builds unchanged (${s2.meshBuilds})`);
  const after = await page.evaluate((pts) => window.__game.depthAt(pts), far.slice(0, 400));
  H.check(after.filter(d => d === Infinity).length >= after.length * 0.98, `${after.filter(d => d === Infinity).length}/${after.length} of those pixels are sky now`);
  const img = await H.pixels(page), pts = far.slice(0, 400);
  const ref = await page.evaluate((ys) => ys.map(y => window.__game.skyRGB(y)), pts.map(p => p[1]));
  const skyish = pts.filter(([x, y], k) => img.px(x, y).every((v, i) => Math.abs(v - ref[k][i]) <= 8)).length;
  H.check(skyish >= pts.length * 0.95, `${skyish}/${pts.length} of them are drawn in the sky colour`);
  H.check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  return browser;
});
