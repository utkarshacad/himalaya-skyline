// Review Focus 4: a revisit loads every terrain tile from the device cache, with zero tile requests.
const H = require('./harness');

H.run('cache: kausani twice in one browser context', async (keep) => {
  // noMap: the home map streams the same Terrarium URLs; leave it out so only the panorama's fetches count
  const { page, browser, errors, requests } = await H.open({ theme: 'dark', noMap: true });
  keep(browser);
  await H.enter(page, 'kausani');
  const first = requests.length;
  H.check(first > 50, `first visit fetched ${first} tiles`);
  await page.evaluate(() => window.__game.goHome());
  await page.waitForTimeout(1500);
  await H.enter(page, 'kausani');
  const second = requests.length - first;
  H.check(second === 0, `second visit made ${second} tile requests (want 0)`);
  H.check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  return browser;
});
