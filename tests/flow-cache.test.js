// Task 5: flow lines are traced once, sector by sector nearest the heading, and kept in IndexedDB hs-v3/flow.
const H = require('./harness');
const lost = (url) => { const m = url.match(/terrarium\/(\d+)\/(\d+)\/(\d+)/); return !!m && (+m[2] * 7 + +m[3] * 13 + +m[1]) % 4 === 1; };
const waitDone = (page, t = 240000) => page.waitForFunction(() => { const s = window.__game.Flow.state(); return s.done === 16 && !s.tracing; }, null, { timeout: t, polling: 250 });
const keys = (page) => page.evaluate(() => window.__game.FlowStore.keys());
const log = (page) => page.evaluate(() => window.__game.flowLog.slice());
const realErrors = (errors) => errors.filter(e => !/Failed to load resource|ERR_FAILED/.test(e));

H.run('flow-cache: trace once, store, reuse', async (keep) => {
  let { page, browser, context, errors, requests } = await H.open({ theme: 'dark', noMap: true });
  keep(browser);
  await H.enter(page, 'pangarchulla');
  await waitDone(page);
  let L = await log(page), st = await page.evaluate(() => window.__game.stats());
  H.check(L.length === 16 && new Set(L.map(e => e.sector)).size === 16, `first visit: all 16 sectors arrived (${L.length})`);
  H.check([0, 2, 14].includes(L[0].sector) && L.every(e => !e.fromCache), `the first sector to arrive faces the opening view (sector ${L[0].sector}), traced fresh`);
  H.check(st.flowTraces === 16, `16 worker traces (${st.flowTraces})`);
  const total = L.reduce((s, e) => s + e.verts, 0);
  H.check(total > 20000, `${total} line vertices in all`);
  H.check((await keys(page)).includes('pangarchulla@1'), 'stored under pangarchulla@1');

  await page.evaluate(() => window.__game.goHome()); await page.waitForTimeout(1200);
  await page.evaluate(() => { window.__game.flowLog.length = 0; });
  await H.enter(page, 'pangarchulla'); await waitDone(page, 30000);
  L = await log(page); const st2 = await page.evaluate(() => window.__game.stats());
  H.check(L.length === 16 && L.every(e => e.fromCache), `revisit: 16 sectors from the store (${L.filter(e => e.fromCache).length})`);
  H.check(st2.flowTraces === st.flowTraces, `revisit traced nothing (${st2.flowTraces - st.flowTraces} traces)`);
  H.check(L.reduce((s, e) => s + e.verts, 0) === total, 'the stored lines are the traced ones');

  // switch viewpoint while the first is still tracing: nothing of kausani leaks into pangarchulla or the store
  await page.evaluate(() => { window.__game.goHome(); window.__game.flowLog.length = 0; });
  await page.waitForTimeout(1200);
  await H.enter(page, 'kausani');
  await page.waitForFunction(() => window.__game.Flow.state().done >= 1 || !window.__game.Flow.state().tracing, null, { timeout: 120000, polling: 50 });
  await page.evaluate(() => { window.__game.flowLog.length = 0; });
  await H.enter(page, 'pangarchulla'); await waitDone(page, 60000);
  await page.waitForTimeout(3000);                                  // let any stale kausani work finish
  L = await log(page);
  H.check(L.length === 16 && L.every(e => e.key === 'pangarchulla@1'), `after the switch only pangarchulla's 16 sectors arrived (${L.map(e => e.key).filter(k => k !== 'pangarchulla@1').length} stray)`);
  H.check(!(await keys(page)).includes('kausani@1'), 'no half-traced kausani record in the store');

  // a damaged record is ignored and replaced
  await page.evaluate(() => window.__game.FlowStore.put('pangarchulla@1', { sectors: [new ArrayBuffer(7)] }));
  await page.evaluate(() => { window.__game.goHome(); window.__game.flowLog.length = 0; }); await page.waitForTimeout(1200);
  const t0 = (await page.evaluate(() => window.__game.stats())).flowTraces;
  await H.enter(page, 'pangarchulla'); await waitDone(page);
  L = await log(page);
  H.check(L.length === 16 && L.every(e => !e.fromCache) && (await page.evaluate(() => window.__game.stats())).flowTraces - t0 === 16, 'a damaged record is traced afresh');
  H.check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));

  // a revisit with the network gone: terrain from the tile cache, lines from the store, no tile request reaches the network
  await page.evaluate(() => { window.__game.goHome(); window.__game.flowLog.length = 0; }); await page.waitForTimeout(1200);
  const before = requests.length; let reached = 0;
  await page.route(/terrarium/, (route) => { reached++; route.abort(); });
  await H.enter(page, 'pangarchulla'); await waitDone(page, 30000);
  L = await log(page);
  H.check(reached === 0 && requests.length === before, `offline revisit: ${reached} tile requests reached the network`);
  H.check(L.length === 16 && L.every(e => e.fromCache), 'offline revisit: lines came from the store');
  H.check(errors.length === 0, 'offline revisit: no console errors');
  await browser.close();

  // no IndexedDB at all (private mode in some browsers): lines are still traced, quietly
  ({ page, browser, errors } = await H.open({ theme: 'dark', noMap: true, init: () => { try { Object.defineProperty(window, 'indexedDB', { get() { throw new Error('IndexedDB disabled'); } }); } catch (e) {} } }));
  keep(browser);
  await H.enter(page, 'pangarchulla'); await waitDone(page);
  H.check((await log(page)).length === 16, 'no IndexedDB: 16 sectors still arrive');
  H.check(errors.length === 0, 'no IndexedDB: no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close();

  // a quarter of the tiles missing: lines arrive, but are not stored for ever
  ({ page, browser, errors } = await H.open({ theme: 'dark', noMap: true, blockTiles: lost }));
  keep(browser);
  await page.evaluate(() => window.__game.FlowStore.clear());
  await H.enter(page, 'pangarchulla'); await waitDone(page);
  H.check((await log(page)).length === 16, 'missing tiles: 16 sectors arrive');
  H.check(!(await keys(page)).includes('pangarchulla@1'), 'missing tiles: nothing is stored');
  H.check(realErrors(errors).length === 0, 'missing tiles: no errors apart from the aborted loads');
  return browser;
});
