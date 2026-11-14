// Smoke: the dark theme loads Pangarchulla, draws the view, and logs no errors.
const fs = require('fs');
const H = require('./harness');

H.run('smoke: pangarchulla, dark', async (keep) => {
  const { page, browser, errors } = await H.open({ theme: 'dark' });
  keep(browser);
  const t0 = Date.now();
  await H.enter(page, 'pangarchulla', 60000);
  H.check(await page.evaluate(() => window.__game.ready()), `__game.ready() true after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const f = await H.shot(page, 'smoke');
  H.check(fs.existsSync(f), 'screenshot written: ' + f);
  H.check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  return browser;
});
