// THROWAWAY spike: render 4 art directions of the real Pangarchulla view for the owner to choose from.
const { chromium } = require('playwright');
const fs = require('fs'); const SP = __dirname;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 760 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  p.on('console', m => { if (m.type() === 'log') console.log('LOG', m.text()); });
  await p.route(/maplibre-gl@.*\.js/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(SP + '/node_modules/maplibre-gl/dist/maplibre-gl.js') }));
  await p.goto('file:///home/user/himalaya-skyline/index.html');
  await p.waitForTimeout(2500);
  await p.evaluate(() => {
    const l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;1,9..144,400&family=Space+Grotesk:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400;1,6..72,500&family=Cormorant+Garamond:ital,wght@0,500;1,500&family=Libre+Caslon+Text:ital,wght@0,400;1,400&family=IBM+Plex+Mono:wght@400&display=swap';
    document.head.append(l);
  });
  await p.waitForTimeout(2500);
  const out = await p.evaluate(async () => {
    await document.fonts.ready;
    for (const f of ['500 14px "Space Grotesk"', 'italic 400 14px Newsreader', 'italic 500 14px "Cormorant Garamond"', '400 14px "Libre Caslon Text"', '300 14px Fraunces', 'italic 400 14px Fraunces', '400 12px "IBM Plex Mono"']) await document.fonts.load(f);
    const def = VIEWPOINTS.find(v => v.id === 'pangarchulla');
    const { vp, levels } = await prepareViewpoint(def);
    const W = 1400, H = 760, hfov = 64 * Math.PI / 180, ppr = W / hfov, maxD = 150000;
    const main = vp.peaks.find(q => q.name === 'Dunagiri') || vp.peaks[0];
    const heading = main.az + 0.05, pitch = 0.035, altTop = pitch + (H / 2) / ppr, eye = vp.eye;
    const N = W * H, D = new Float32Array(N).fill(Infinity), SH = new Float32Array(N), CV = new Float32Array(N), HT = new Float32Array(N), CR = new Float32Array(N);
    const LX = -0.5417, LY = 0.5417, LZ = 0.6428;
    for (let x = 0; x < W; x++) {
      const az = heading + (x + 0.5 - W / 2) / ppr, s = Math.sin(az), c = Math.cos(az);
      let top = H, lastD = 0, angTop = 0, prevVis = false, minHid = Infinity, d = 12;
      while (d < maxD) {
        const lat = vp.lat + d * c / K_DEG, cl = Math.cos(lat * Math.PI / 180), lon = vp.lon + d * s / (K_DEG * cl);
        const h = elevAt(levels, lon, lat, d);
        if (h === h) {
          const ang = Math.atan2(h - d * d * CURV - eye, d);
          let yi = Math.ceil((altTop - ang) * ppr);
          if (yi < top) {
            if (yi < 0) yi = 0;
            const e = d < 7000 ? 70 : d < 20000 ? 140 : d < 72000 ? 280 : 560;
            const hE = elevAt(levels, lon + e / (K_DEG * cl), lat, d), hN = elevAt(levels, lon, lat + e / K_DEG, d);
            let sh = 0, cv = 0;
            if (hE === hE && hN === hN) { const gx = (hE - h) / e, gy = (hN - h) / e; sh = (-gx * LX - gy * LY + LZ) / Math.sqrt(gx * gx + gy * gy + 1) - LZ; }
            const e2 = e * 2.5, a1 = elevAt(levels, lon + e2 / (K_DEG * cl), lat, d), a2 = elevAt(levels, lon - e2 / (K_DEG * cl), lat, d), a3 = elevAt(levels, lon, lat + e2 / K_DEG, d), a4 = elevAt(levels, lon, lat - e2 / K_DEG, d);
            if (a1 === a1 && a2 === a2 && a3 === a3 && a4 === a4) cv = (4 * h - a1 - a2 - a3 - a4) / e2;
            for (let y = yi; y < top; y++) { const i = y * W + x; D[i] = d; SH[i] = sh; CV[i] = cv; }
            if (!prevVis && top < H) { const dip = angTop - minHid, drop = dip * lastD; if (dip > 0.00045 && drop > 3) CR[top * W + x] = Math.min(1, 0.15 + drop / 140); }
            top = yi; angTop = ang; lastD = d; prevVis = true; minHid = Infinity;
            if (top <= 0) break;
          } else { prevVis = false; if (ang < minHid) minHid = ang; }
        }
        d += Math.max(8, d * 0.0035);
      }
      if (top < H && top > 0) CR[top * W + x] = 2;   // 2 = skyline
    }
    for (let y = 0; y < H; y++) { const tn = Math.tan(altTop - (y + 0.5) / ppr); for (let x = 0; x < W; x++) { const i = y * W + x, d = D[i]; HT[i] = d === Infinity ? NaN : eye + d * tn + d * d * CURV; } }
    // helpers
    const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    function contour(i, base, minPx, w) {           // anti-aliased contour coverage at pixel i, line width w px
      const x = i % W, y = (i / W) | 0; if (y >= H - 1 || x >= W - 1) return 0;
      const d = D[i]; if (d === Infinity) return 0;
      let g = 0; for (const j of [i + W, i + 1]) { if (D[j] !== Infinity && Math.abs(D[j] - d) < Math.max(60, d * 0.04)) g = Math.max(g, Math.abs(HT[j] - HT[i])); }
      if (!(g > 1e-3)) return 0;
      let I = base; while (I / g < minPx) I *= 2; if (I > 3200) return 0;
      const f = HT[i] / I, dist = Math.abs(f - Math.round(f)) * I / g;
      let fade = 1; if (I > base && Math.round(f) % 2 !== 0) fade = Math.min(1, I / (g * minPx) - 1);
      return (1 - sm(w * 0.5, w * 0.5 + 1, dist)) * fade;
    }
    const light = (i) => Math.max(0, Math.min(1, 0.5 + SH[i] * 1.4 + Math.tanh(CV[i] * 0.55) * 0.45));
    // visible labelled peaks
    const vis = await new Promise((res) => { const ok = vp.peaks.map(q => lineOfSight(levels, vp, q.az, q.d, q.hs)); res(ok); });
    const peaks = vp.peaks.filter((q, k) => vis[k] && q.d < maxD).map(q => {
      const alt = Math.atan2(q.hs - q.d * q.d * CURV - eye, q.d);
      return { ...q, x: W / 2 + angDiff(q.az, heading) * ppr, y: H / 2 - (alt - pitch) * ppr };
    }).filter(q => q.x > 20 && q.x < W - 20).sort((a, b) => a.x - b.x);

    const STYLES = [
      { id: 'FINAL6-dark', name: 'Dark · Summit Noir', sub: 'flow lines thicken toward the summits', fontL: 'italic 500 18px "Cormorant Garamond"', fontT: 'italic 500 44px "Cormorant Garamond"', fontC: '400 12px "IBM Plex Mono"',
        sky: ['#0b0d11', '#2b313a'], text: '#eef0f3', mute: '#9a8f86', pill: 'rgba(28,29,32,.82)',
        px(i, fd) { const L = light(i); let c = mix(hex('#0f1114'), hex('#2a2f37'), Math.pow(fd, 0.7)); c = mix(c, hex('#8d939c'), L * 0.18 * (1 - fd * 0.7)); c = mix(c, hex('#07080a'), (1 - L) * 0.3 * (1 - fd));
          const sl = 4900 - 450 * (L - 0.5) - 260 * Math.tanh(CV[i] * 0.6);                  // snowline dips on lit, convex ground
          const snow = sm(sl - 300, sl + 1100, HT[i]) * (0.55 + 0.45 * L) * (1 - fd * 0.55);
          c = mix(c, hex('#9aa2ad'), snow * 0.5);
          const mist = (1 - sm(2400, 4300, HT[i])) * sm(0.03, 0.25, fd) * 0.75 + sm(0.35, 1, fd) * 0.35; return mix(c, hex('#3a414b'), Math.min(0.85, mist)); },
        line: '#ffffff', lineK: 1, flow: true },
    ];
    const urls = {};
    for (const S of STYLES) {
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
      const img = ctx.createImageData(W, H), a = img.data;
      const s0 = hex(S.sky[0]), s1 = hex(S.sky[1]), ln = hex(S.line);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x; let c;
        if (D[i] === Infinity) c = mix(s0, s1, y / (H * 0.62));
        else c = S.px(i, Math.min(1, D[i] / maxD));
        if (CR[i] > 0) { const fd = D[i] === Infinity ? 0.5 : Math.min(1, D[i] / maxD); const al = CR[i] === 2 ? 0.58 : 0.55 * CR[i] * S.lineK * (1 - 0.5 * Math.sqrt(fd)); c = mix(c, ln, Math.min(1, al)); }
        if (S.grain) { const n = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1; c = c.map(v => v + (n - 0.5) * 7); }
        a[i * 4] = c[0]; a[i * 4 + 1] = c[1]; a[i * 4 + 2] = c[2]; a[i * 4 + 3] = 255;
      }
      // thicken lines one pixel below for crispness
      for (let y = H - 2; y >= 0; y--) for (let x = 0; x < W; x++) { const i = y * W + x; if (CR[i] > 0) { const j = (i + W) * 4, al = (CR[i] === 2 ? 0.28 : 0.15) * Math.min(1, CR[i]) * S.lineK; for (let k = 0; k < 3; k++) a[j + k] += (ln[k] - a[j + k]) * al; } }
      ctx.putImageData(img, 0, 0);
      if (S.flow) {
        // evenly spaced streamlines (Jobard–Lefer): seed on visible terrain, trace downhill and uphill as far as
        // the slope allows, stop near any other line, so lines are long and continuous like contour art
        const near = (x, y, id, r) => { const r2 = r * r; for (let yy = Math.max(0, Math.floor(y - r)); yy <= Math.min(H - 1, Math.ceil(y + r)); yy++) for (let xx = Math.max(0, Math.floor(x - r)); xx <= Math.min(W - 1, Math.ceil(x + r)); xx++) { const o = owner[yy * W + xx]; if (o >= 0 && o !== id && (xx - x) ** 2 + (yy - y) ** 2 <= r2) return true; } return false; };
        const grad = (la, lo, dd) => { const e = Math.max(25, dd * 0.004), cl = Math.cos(la * Math.PI / 180);
          const h = elevAt(levels, lo, la, dd), hx = elevAt(levels, lo + e / (K_DEG * cl), la, dd), hy = elevAt(levels, lo, la + e / K_DEG, dd);
          return h === h && hx === hx && hy === hy ? [h, (hx - h) / e, (hy - h) / e, cl] : null; };
        const proj = (la, lo, h) => { const [az, d] = azDist(vp.lat, vp.lon, la, lo); const alt = Math.atan2(h - d * d * CURV - eye, d);
          return [W / 2 + angDiff(az, heading) * ppr, H / 2 - (alt - pitch) * ppr, d]; };
        // Lines pour out of the summits: seeded densely on high ground (more the higher it is), traced downhill only,
        // allowed to bunch at the top (snow-cap glow) and stopped where they crowd lower down, so they thin out.
        const owner = new Int32Array(N).fill(-1);
        const sepAt = (h) => 1.1 + 15 * Math.pow(1 - sm(3600, 7000, h), 1.3);
        const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
        const relAt = (x, y, d, h) => {
          const az = heading + (x - W / 2) / ppr, la = vp.lat + d * Math.cos(az) / K_DEG, cl = Math.cos(la * Math.PI / 180), lo = vp.lon + d * Math.sin(az) / (K_DEG * cl);
          const R = Math.max(1200, d * 0.06); let s = 0, n = 0;
          for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, -.7], [.7, -.7], [-.7, .7]]) { const v = elevAt(levels, lo + a * R / (K_DEG * cl), la + b * R / K_DEG, d); if (v === v) { s += v; n++; } }
          return n ? h - s / n : 0;
        };
        const seeds = [];
        for (let y = 1; y < H; y += 2) for (let x = 1; x < W; x += 2) {
          const i = y * W + x, h = HT[i];
          if (!(D[i] < 75000 && D[i] > 150 && h > 3300)) continue;
          const rel = relAt(x, y, D[i], h), top = Math.max(Math.pow(sm(3800, 7200, h), 1.2), sm(120, 650, rel));
          if (hash(x, y) < 0.03 + 0.88 * top) seeds.push([x, y, D[i], h, rel]);
        }
        seeds.sort((p, q) => q[3] - p[3]);
        const lines = []; let id = 0;
        for (const [sx, sy, sd, sh, srel] of seeds) {
          if (sh < 5600 && srel < 250 && near(sx, sy, -2, sepAt(sh) * 0.6)) continue;
          const az = heading + (sx - W / 2) / ppr;
          let la = vp.lat + sd * Math.cos(az) / K_DEG, lo = vp.lon + sd * Math.sin(az) / (K_DEG * Math.cos(vp.lat * Math.PI / 180));
          const myId = id++, pts = []; let hid = 0;
          for (let k = 0; k < 900; k++) {
            const dd = Math.hypot((la - vp.lat) * K_DEG, (lo - vp.lon) * K_DEG * Math.cos(la * Math.PI / 180));
            const g = grad(la, lo, dd); if (!g) break;
            const [h, gx, gy, cl] = g, gm = Math.hypot(gx, gy);
            if (gm < 0.04) break;
            const [x, y, d] = proj(la, lo, h + 2), xi = Math.round(x), yi = Math.round(y);
            if (xi < 0 || yi < 0 || xi >= W || yi >= H) break;
            if (D[yi * W + xi] < d * 0.97 - 40) { if (++hid > 30) break; pts.push(null); }
            else {
              hid = 0;
              if (h < sh - 350 && near(x, y, myId, sepAt(h) * 0.5)) break;   // bunch freely near the summit, thin out below
              pts.push([x, y, d, yi * W + xi, h]);
            }
            const stepM = dd * 1.2 / ppr;
            la -= gy / gm * stepM / K_DEG; lo -= gx / gm * stepM / (K_DEG * cl);
          }
          const vis = pts.filter(Boolean);
          if (vis.length < 6) continue;
          for (const p of vis) owner[p[3]] = myId;
          lines.push({ pts, h0: sh, rel0: srel });
        }
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (const L of lines) {
          const runs = []; let run = [];
          for (const p of L.pts) { if (p && (!run.length || (Math.abs(p[0] - run[run.length - 1][0]) < 10 && Math.abs(p[1] - run[run.length - 1][1]) < 10))) run.push(p); else { if (run.length > 2) runs.push(run); run = p ? [p] : []; } }
          if (run.length > 2) runs.push(run);
          const peakK = 0.05 + 0.2 * sm(4300, 7400, L.h0) + 0.14 * sm(120, 650, L.rel0);   // every summit caps; higher ones brighter              // higher summits glow brighter
          for (const r of runs) for (let j = 1; j < r.length; j++) {
            const p0 = r[j - 1], p1 = r[j], fd = p1[2] / maxD;
            const down = sm(L.h0 - Math.max(900, Math.min(2800, L.rel0 * 3)), L.h0, p1[4]);                     // fades as the line descends
            const a = 0.38 * peakK * (0.1 + 0.9 * Math.pow(down, 1.6)) * (1 - Math.min(1, fd * 1.15)) * (0.25 + 0.75 * sm(2000, 25000, p1[2]));   // softer caps on near peaks   // cap bright, flanks a faint texture
            if (a < 0.004) continue;
            ctx.strokeStyle = `rgba(236,239,244,${a})`; ctx.lineWidth = 0.75;
            ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        console.log('streamlines', lines.length);
        // redraw ridge lines on top so the silhouettes stay crisp
        ctx.fillStyle = '#e6e9ee';
        for (let i = 0; i < N; i++) if (CR[i] > 0) { const fd = D[i] === Infinity ? 0.5 : Math.min(1, D[i] / maxD); ctx.globalAlpha = CR[i] === 2 ? 0.55 : Math.min(0.55, 0.55 * CR[i] * (1 - 0.5 * Math.sqrt(fd))); ctx.fillRect(i % W, (i / W) | 0, 1, 1.4); }
        ctx.globalAlpha = 1;
      }
      // PeakFinder-format labels: slanted "Name 7,120 m" on a band, leader lines down to the summit
      const band = Math.min(...peaks.map(q => q.y)) - 46;
      let lastX = -99;
      for (const q of peaks) {
        if (q.x - lastX < 22) continue; lastX = q.x;
        const base = Math.min(q.y - 16, band);
        ctx.strokeStyle = q.name === 'Dunagiri' ? '#c8835a' : S.text; ctx.globalAlpha = 0.75; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(q.x + 0.5, base); ctx.lineTo(q.x + 0.5, q.y - 4); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.save(); ctx.translate(q.x - 4, base - 4); ctx.rotate(-48 * Math.PI / 180);
        ctx.font = S.fontL; const nm = q.name; const wN = ctx.measureText(nm).width;
        ctx.font = S.fontC.replace('12px', '11px'); const ht = ' ' + q.h.toLocaleString('en-IN') + ' m'; const wH = ctx.measureText(ht).width;
        const sel = q.name === 'Dunagiri';
        if (S.pill || sel) { ctx.fillStyle = sel ? '#b8734a' : S.pill; ctx.beginPath(); ctx.roundRect(-6, -14, wN + wH + 16, 22, 11); ctx.fill(); }
        ctx.fillStyle = sel ? '#fff7ee' : S.text; ctx.font = S.fontL; ctx.fillText(nm, 2, 2);
        ctx.fillStyle = sel ? '#f3dcc6' : S.mute; ctx.font = S.fontC.replace('12px', '11px'); ctx.fillText(ht, 4 + wN, 2);
        ctx.restore();
      }
      // magazine caption
      ctx.fillStyle = S.text; ctx.font = S.fontT; ctx.fillText('Pangarchulla', 48, 76);
      ctx.fillStyle = S.mute; ctx.font = S.fontC; ctx.fillText('4,575 M  ·  KUMAON HIMALAYA  ·  LOOKING NE TOWARD DUNAGIRI', 50, 102);
      ctx.fillStyle = S.mute; ctx.font = S.fontC; ctx.fillText(S.name.toUpperCase() + '  —  ' + S.sub, 50, H - 28);
      urls[S.id] = cv.toDataURL('image/png');
    }
    return urls;
  });
  for (const [k, v] of Object.entries(out)) fs.writeFileSync(SP + `/style-${k}.png`, Buffer.from(v.split(',')[1], 'base64'));
  console.log('done', Object.keys(out).join(' '));
  await b.close();
})();
