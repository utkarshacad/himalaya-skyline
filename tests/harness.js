// Headless Chromium harness for Himalaya Skyline.
// Serves the repo over a local http server (the Cache API needs a real origin), routes the MapLibre CDN to
// tests/node_modules, and records console errors and Terrarium tile requests.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out');
const ML = path.join(__dirname, 'node_modules', 'maplibre-gl', 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

let server = null, base = '';
function serve() {
  if (server) return Promise.resolve(base);
  server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((res) => server.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}/`; server.unref(); res(base); }));
}

const LAUNCH_ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];

// open({ theme, viewport, noWebGL2, noMap, dpr, browser, context, blockTiles })
// noMap: MapLibre fails to load, so only the panorama's own tile fetches show up in `requests` → { page, browser, context, errors, requests }
async function open(opts = {}) {
  const url = await serve();
  const browser = opts.browser || await chromium.launch({ args: LAUNCH_ARGS });
  const context = opts.context || await browser.newContext({ viewport: opts.viewport || { width: 1330, height: 640 }, deviceScaleFactor: opts.dpr || 1 });
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e && e.stack || e)));
  page.on('request', (r) => { if (/terrarium/.test(r.url())) requests.push(r.url()); });
  await page.route(/maplibre-gl@[^/]+\/dist\/(.+)$/, (route) => {
    const f = path.join(ML, route.request().url().match(/dist\/([^?]+)/)[1]);
    if (opts.noMap) return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });   // loads, defines nothing
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'text/plain', body: fs.readFileSync(f) });
  });
  if (opts.blockTiles) await page.route(/terrarium/, (route) => (opts.blockTiles(route.request().url()) ? route.abort() : route.continue()));
  await page.addInitScript(({ theme, noWebGL2 }) => {
    try { localStorage.setItem('himalaya-skyline-prefs', JSON.stringify({ theme: theme || 'dark' })); } catch (e) {}
    if (noWebGL2) {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return type === 'webgl2' ? null : orig.call(this, type, ...rest); };
    }
  }, { theme: opts.theme, noWebGL2: !!opts.noWebGL2 });
  await page.goto(url + 'index.html');
  await page.waitForFunction(() => !!window.__game);
  return { page, browser, context, errors, requests };
}

// enter a viewpoint directly (no map fly-in) and wait until the visible view is fully drawn
async function enter(page, id, timeout = 90000) {
  const ok = await page.evaluate(async (id) => {
    const def = window.__game.VIEWPOINTS.find(v => v.id === id);
    const ok = await window.__game.enterViewpoint(def);
    if (ok) window.__game.showPlay();
    return ok;
  }, id);
  if (!ok) throw new Error('enterViewpoint failed for ' + id);
  await page.waitForFunction(() => window.__game.ready(), null, { timeout, polling: 200 });
}

async function shot(page, name) {
  fs.mkdirSync(OUT, { recursive: true });
  const f = path.join(OUT, name + '.png');
  await page.screenshot({ path: f });
  return f;
}

// decode a screenshot into { width, height, px(x, y) → [r, g, b] }
async function pixels(page) {
  const { PNG } = require('pngjs');
  const png = PNG.sync.read(await page.screenshot());
  return { width: png.width, height: png.height, data: png.data,
    px: (x, y) => { const i = (Math.round(y) * png.width + Math.round(x)) * 4; return [png.data[i], png.data[i + 1], png.data[i + 2]]; } };
}

// tiny assertion helpers that keep test output readable
let failures = 0;
function check(cond, msg) { if (cond) console.log('  ok   ' + msg); else { failures++; console.log('  FAIL ' + msg); } }
function done(browser) { return (browser ? browser.close() : Promise.resolve()).then(() => { console.log(failures ? `${failures} failure(s)` : 'PASS'); process.exit(failures ? 1 : 0); }); }
async function run(name, fn) {
  console.log(name);
  let browser = null;
  try { browser = await fn((b) => (browser = b)); } catch (e) { failures++; console.log('  FAIL threw: ' + (e && e.stack || e)); }
  await done(browser);
}

module.exports = { open, enter, shot, pixels, check, run, serve, LAUNCH_ARGS, OUT };
