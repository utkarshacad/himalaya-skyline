// Shared helpers for the art tests: quiet the DOM overlays, read pixels, find points by distance and height.
const H = require('./harness');
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const cdist = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const HIDE = '#labels, .corner, #vpbar, #compass, #guess, #info, #fx, .rtag, #scope { display: none !important; }';
async function quiet(page) { await page.addStyleTag({ content: HIDE }); }
// set render layers, redraw, wait for the frame
async function art(page, o) { await page.evaluate((o) => { window.__game.setArt(o); window.__game.onViewChanged(); }, o); await page.waitForTimeout(350); }
// mean colour of a (2r+1)² box
function box(img, x, y, r = 4) {
  const s = [0, 0, 0]; let n = 0;
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const X = Math.round(x + i), Y = Math.round(y + j); if (X < 0 || Y < 0 || X >= img.width || Y >= img.height) continue; const p = img.px(X, Y); s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; n++; }
  return s.map(v => v / n);
}
// every depth-grid cell that is terrain: { x, y, d, h, az } in css pixels / metres
const grid = (page) => page.evaluate(() => window.__game.gridInfo());
// the screen position of a named peak's summit and of the same face about `drop` metres lower (straight down the screen)
async function capAndFlank(page, name, drop = 1800) {
  const g = await grid(page);
  const pk = await page.evaluate((name) => { const p = window.__game.CUR.peaks.find(q => q.name === name), s = window.__game.project(p.az, p.d, p.hs); return { x: s.x, y: s.y, d: p.d, h: p.hs }; }, name);
  const col = g.filter(c => Math.abs(c.x - pk.x) < 3 && c.y > pk.y && c.d > pk.d * 0.6 && c.d < pk.d * 1.3).sort((a, b) => a.y - b.y);
  const cap = col.find(c => c.h < pk.h - 120) || col[0], flank = col.find(c => c.h < pk.h - drop);
  return { pk, cap, flank };
}
module.exports = { H, lum, hex, cdist, quiet, art, box, grid, capAndFlank };
