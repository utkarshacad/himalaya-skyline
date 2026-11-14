// Task 7: without WebGL2 the v2.4 strip renderer runs and the game still works; and a lost WebGL
// context (phone backgrounded, GPU reset) comes back without freezing the page (Review Focus 1).
const H = require('./harness');

async function quizOnce(page) {
  for (const b of await page.$$('#labels .q')) if (await b.isVisible()) {
    await b.click();
    const name = await page.evaluate(() => window.__game.guessTarget && window.__game.guessTarget.name);
    await page.fill('#g-input', name); await page.press('#g-input', 'Enter');
    await page.waitForTimeout(200);
    return { name, info: await page.textContent('#info-nm'), prog: await page.textContent('#pl-progress') };
  }
  return null;
}

H.run('fallback: no WebGL2, then context loss', async (keep) => {
  let { page, browser, errors } = await H.open({ theme: 'dark', noMap: true, noWebGL2: true });
  keep(browser);
  await H.enter(page, 'kausani');
  const st = await page.evaluate(() => window.__game.stats());
  H.check(!(await page.evaluate(() => window.__game.glActive())), 'GL panorama is off without WebGL2');
  H.check(st.newGen >= 1, `strip renderer active (generations: ${st.newGen})`);
  const q = await quizOnce(page);
  H.check(q && q.info.startsWith('First try · ' + q.name) && /^1\//.test(q.prog), `quiz works: "${q && q.info}" ${q && q.prog}`);
  H.check(await page.evaluate(() => !!document.getElementById('fly-up') && getComputedStyle(document.getElementById('fly-up')).display !== 'none'), 'fallback keeps the stepped fly buttons');
  await H.shot(page, 'stage1-fallback');
  H.check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close();

  ({ page, browser, errors } = await H.open({ theme: 'dark', noMap: true }));
  keep(browser);
  await H.enter(page, 'pangarchulla');
  await page.evaluate(() => { window.__lc = document.getElementById('gl').getContext('webgl2').getExtension('WEBGL_lose_context'); window.__lc.loseContext(); });
  await page.waitForTimeout(500);
  H.check(!(await page.evaluate(() => window.__game.ready())), 'not ready while the context is lost');
  await page.evaluate(() => window.__lc.restoreContext());
  const t0 = Date.now();
  await page.waitForFunction(() => window.__game.ready(), null, { timeout: 10000 });
  H.check(true, `ready again ${((Date.now() - t0) / 1000).toFixed(1)} s after the context came back`);
  H.check(await page.evaluate(() => window.__game.glActive()), 'still on the GL panorama');
  await page.addStyleTag({ content: '#labels, .corner, #vpbar, #compass { display: none !important; }' });
  await page.waitForTimeout(300);
  const img = await H.pixels(page), top = img.px(img.width / 2, 2);
  H.check(Math.abs(top[0] - 11) <= 6 && Math.abs(top[1] - 13) <= 6 && Math.abs(top[2] - 17) <= 6, `sky drawn again after restore (${top})`);
  const agree = await page.evaluate(async () => { const x = Math.round(innerWidth / 2); return [window.__game.glSkylineRows([x])[0], (await window.__game.cpuSkylineRows([x]))[0]]; });
  H.check(agree[0] != null && Math.abs(agree[0] - agree[1]) <= 3, `terrain drawn again after restore: skyline row ${agree[0]} vs CPU ${agree[1] && agree[1].toFixed(1)}`);
  await H.shot(page, 'stage1-restored');
  H.check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  return browser;
});
