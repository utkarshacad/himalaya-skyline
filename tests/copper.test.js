// The accent is copper #b8734a everywhere (owner, Round 12 and 15 November 2026): no pink left in either theme.
const H = require('./harness');
const fs = require('fs'), path = require('path');
const PINK = /#ff3b77|#e0245e|255\s*,\s*59\s*,\s*119|224\s*,\s*36\s*,\s*94|#ff2d6f|pink/i;

H.run('copper: the accent is copper in both themes, no pink anywhere', async (keep) => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const hits = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => PINK.test(l) && !/PeakFinder pink|not pink/i.test(l));
  H.check(hits.length === 0, `no pink colour left in index.html` + (hits.length ? ': lines ' + hits.map(h => h[0]).join(', ') : ''));
  for (const theme of ['dark', 'light']) {
    const { page, browser, errors } = await H.open({ theme, noMap: true });
    keep(browser);
    const acc = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--accent').trim().toLowerCase());
    H.check(acc === '#b8734a', `${theme}: --accent is ${acc}`);
    await H.enter(page, 'kausani');
    // a selected peak label and an active round button use the accent
    const sel = await page.evaluate(() => {
      const b = document.querySelector('.rb'); b.classList.add('on');
      const c = getComputedStyle(b).backgroundColor; b.classList.remove('on'); return c;
    });
    H.check(sel === 'rgb(184, 115, 74)', `${theme}: an active round button is copper (${sel})`);
    H.check(errors.length === 0, `${theme}: no console errors`);
    await browser.close();
  }
});
