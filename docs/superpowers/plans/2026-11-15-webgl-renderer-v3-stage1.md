# Himalaya Skyline v3 — Stage 1: WebGL core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the processor strip renderer with a WebGL2 renderer that draws the Summit Noir terrain (shading + dimmed outlines, no flow lines yet) live at 60 fps, adds cached tiles and drag-to-fly, keeps every v2 game feature, and falls back to v2.4 without WebGL2.

**Architecture:** A worker samples the existing level mosaics into a **polar grid mesh** around the viewer (world ENU metres + per-vertex normal, curvature, relief). A new `GLPano` module draws it with a **cylindrical-projection vertex shader** (x = azimuth, y = elevation angle — same maths as v2's `project()`), shades it in the fragment shader from theme uniforms, then runs a depth-edge pass for outlines. Pan/zoom/visibility/eye height are uniforms only. DOM overlays (labels, quiz, telescope, rivers on `#fx`) keep using `project()`; visibility tests read a downsampled depth grid from the GPU when the view settles.

**Tech Stack:** WebGL2 (GLSL ES 3.00), Web Workers, Cache API, existing MapLibre 5.24 home map; tests are Node + Playwright (pre-installed) driving headless Chromium with software WebGL on real Terrarium tiles.

**Spec:** `docs/superpowers/specs/2026-11-15-webgl-renderer-v3-design.md` (approved). Targets: `docs/art/target-dark-summit-noir.png`, `docs/art/target-light-ink-and-mist.png`.

## Global Constraints

- The game stays one self-contained `index.html`, no build step; MapLibre the only external library (Google Fonts allowed later in Stage 3). Shaders and worker code go in `<script type="text/plain">` blocks like `#shared-src` / `#worker-src`; shared globals in `#shared-src` are declared with `var`.
- WebGL2 required for v3; without it (or after an unrecoverable context loss) the v2.4 renderer runs unchanged.
- Terrain: AWS Terrarium z9–z12, levels as in v2.3 (`z12 <7 km`, `z11 <20 km`, `z10 <72 km`, `z9 <235 km`), with the 20 % level blending in `elevAt`.
- Curvature + refraction: `drop = d²·(1−0.13)/(2·6371000)` — identical to `CURV` in `#shared-src`.
- Dark theme constants (Summit Noir, from the target): sky `#0b0d11` → `#2b313a`; ground near `#0f1114` → far `#2a2f37`; curvature light toward `#8d939c`; outlines: skyline alpha 0.58, ridges 0.55 × strength; mist colour `#3a414b`; snow toward `#9aa2ad` from ≈4,900 m (snow + flow lines are Stage 2 — Stage 1 ships terrain tone, light and outlines only).
- Fly range 0 – 5,000 m above the viewpoint eye; no stepped jumps in v3.
- Panning, zoom, visibility and fly must never trigger mesh rebuilds or re-traces (uniform updates only).
- Accent stays as-is (copper restyle is Stage 3).
- Commit messages end with the session attribution lines; push to `main` after each task.

## Review Focus

1. **WebGL context loss** (tab backgrounded on a phone, GPU reset): the page must not freeze — restore the GL state on `webglcontextrestored`, or fall back to v2.4. → test in Task 7.
2. **Resize / phone rotation** mid-view: canvas, depth target and projection must follow without a reload. → test in Task 4.
3. **Missing tiles** (network drop on first visit): mesh must still build with holes treated as sky, no NaN vertices poisoning the draw. → test in Task 3.
4. **Revisit offline-ish** (tiles cached, network flaky): second visit must load from cache with zero tile requests. → test in Task 2.
5. **High-DPR phones** (dpr 3): render-target size must be capped so memory stays bounded and framerate holds. → test in Task 4.

---

### Task 1: Test harness

**Files:**
- Create: `tests/package.json`, `tests/harness.js`, `tests/smoke.test.js`, `tests/README.md`

**Interfaces:**
- Produces: `harness.open({ theme?, viewport?, noWebGL2? }) → Promise<{ page, browser, errors: string[], requests: string[] }>` (routes `maplibre-gl@*` to `tests/node_modules/maplibre-gl/dist/*`, records console errors and Terrarium tile request URLs); `harness.enter(page, viewpointId) → Promise<void>` (calls `enterViewpoint` + `showPlay`, waits until the renderer reports ready via `window.__game.ready()`); `harness.shot(page, name)` (writes `tests/out/<name>.png`).
- Produces in `index.html`: `window.__game.ready()` → `true` once the visible view is fully drawn (v2: `G && visibleReady(G)`; v3: `GLPano.ready`).

- [ ] **Step 1:** Write `tests/smoke.test.js`: open dark theme, enter `pangarchulla`, assert `errors` is empty, `__game.ready()` true within 60 s, and a screenshot is written.
- [ ] **Step 2:** Run `cd tests && npm i && node smoke.test.js` — expected FAIL (`__game.ready is not a function`).
- [ ] **Step 3:** Implement `harness.js` and add `ready()` to `window.__game` in `index.html`. Launch args: `--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`; `noWebGL2` stubs `HTMLCanvasElement.prototype.getContext` to return `null` for `'webgl2'` via `addInitScript`.
- [ ] **Step 4:** Run `node smoke.test.js` — expected PASS, `tests/out/smoke.png` exists. Add `tests/out/` and `tests/node_modules/` to `.gitignore`.
- [ ] **Step 5:** Commit + push: `test: headless harness for the panorama`.

### Task 2: Tile cache (Cache API)

**Files:**
- Modify: `index.html` — `loadTile(z, x, y)` (line ~929)
- Test: `tests/cache.test.js`

**Interfaces:**
- Produces: `loadTile` unchanged signature `(z, x, y) → Promise<Float32Array(65536)>`; now checks `caches.open('hs-tiles-v1')` by request URL first, stores the PNG `Response` on network success; falls back silently if the Cache API is unavailable (file:// in some browsers).

- [ ] **Step 1:** Write `cache.test.js`: in one browser context, enter `kausani`, `goHome`, enter `kausani` again; assert the second visit's Terrarium request count is `0` (requests made after the first `ready()`), and `errors` empty. (Review Focus 4.)
- [ ] **Step 2:** Run — expected FAIL (second visit re-requests ~110 tiles).
- [ ] **Step 3:** Implement the cache lookup/store in `loadTile`; keep the in-memory `tileCache` map.
- [ ] **Step 4:** Run `node cache.test.js` — PASS; `node smoke.test.js` — PASS.
- [ ] **Step 5:** Commit + push: `feat: cache terrain tiles on the device`.

### Task 3: Polar mesh builder (worker)

**Files:**
- Modify: `index.html` — new `<script id="mesh-src" type="text/plain">` appended to the worker source in `makeWorker()`; new worker command `'mesh'`
- Test: `tests/mesh.test.js`

**Interfaces:**
- Consumes: `elevAt(levels, lon, lat, d)`, `K_DEG` from `#shared-src`.
- Produces (worker → page message `{cmd:'mesh', cols, rows, pos, attr, index, rings}`):
  - `buildPolarMesh(levels, vp, { cols: 2048, rows: 600, d0: 12, maxD: 235000 })` → `{ pos: Float32Array(cols*rows*3) /* east m, north m, height m */, attr: Float32Array(cols*rows*4) /* nx, ny, conv, rel */, index: Uint32Array, rings: Float32Array(rows) /* ring distances */ }`.
  - Ring distance `rings[r] = d0 · (maxD/d0)^(r/(rows−1))` (geometric). Column `c` azimuth `= 2π·c/cols`; the mesh wraps (last column connects to the first).
  - `conv` exactly as v2.4 (`(4h − Σ4 neighbours)/e2`, `e2 = 2.5·e`, `e` = level spacing 70/140/280/560 m by distance band 7/20/72 km); `rel` = height minus the mean of 8 samples at radius `max(1200, 0.06·d)` (spike's `relAt`); normal from the same `e`-spaced gradient.
  - Missing heights (`NaN`) are written as `h = −1e4` and flagged `attr.w = −1e9` so the shader discards them (Review Focus 3).

- [ ] **Step 1:** Write `mesh.test.js` (runs the worker in the page via a test hook `__game.buildMeshForTest(viewpointId) → {cols, rows, rings, sampleH(c,r), sampleConv(c,r)}`): assert `cols*rows` vertex count; `rings[0]≈12`, `rings[rows−1]≈235000`, ratio between consecutive rings constant to 1e-6; for 20 random (c,r) the vertex height equals `elevAt` at that polar point within 0.5 m; no `NaN` in `pos`; with 30 % of tile requests aborted (route abort), the mesh still builds and contains flagged holes but no `NaN`.
- [ ] **Step 2:** Run — expected FAIL (`buildMeshForTest` undefined).
- [ ] **Step 3:** Implement `buildPolarMesh` and the `'mesh'` worker command (transfer the buffers); add the test hook.
- [ ] **Step 4:** Run `node mesh.test.js` — PASS. Log build time for Pangarchulla (expect < 3 s on the sandbox).
- [ ] **Step 5:** Commit + push: `feat: polar terrain mesh built in a worker`.

### Task 4: `GLPano` renderer — terrain + shading

**Files:**
- Modify: `index.html` — new `<script id="glsl-terrain-vs">`, `<script id="glsl-terrain-fs">` (type `text/plain`), new section "GL panorama" in the main script
- Test: `tests/gl-terrain.test.js`

**Interfaces:**
- Consumes: Task 3 mesh message.
- Produces:
  - `GLPano.init(canvas: HTMLCanvasElement) → boolean` (false if no WebGL2; sets `GLPano.ok`).
  - `GLPano.setMesh(mesh)`; `GLPano.setTheme(name: 'dark'|'light')`; `GLPano.render({ heading, pitch, hfov, eye, maxD, W, H, dpr })`; `GLPano.ready: boolean`.
  - Vertex shader maps a vertex to `az = atan(east, north)`, `d = hypot(east, north)`, `alt = atan(h − d²·CURV − eye, d)`; clip `x = angDiff(az, heading)·ppr / (W/2)`, `y = (alt − pitch)·ppr / (H/2)`, `ppr = W/hfov`; `z = d / (maxD + 20000)` mapped to clip depth; vertices beyond `maxD` or flagged holes collapse (discard in FS).
  - Triangles straddling the ±π seam: render the mesh twice with heading offsets of 0 and ±2π folded into `angDiff` per vertex using the column azimuth of the triangle's first vertex (pass `colAz` as a per-vertex attribute) so no triangle spans the screen.
  - Fragment shading (dark constants from Global Constraints): base `mix(near, far, pow(fd, .7))`; curvature light `tanh(conv·0.55)` toward `#8d939c` × 0.18 (stronger on convex), sun term weak (0.3 of v2); haze toward horizon by `pow(fd,1.6)·0.7`; mist `(1 − smoothstep(2400, 4300, h))·smoothstep(.03,.25,fd)·.75 + smoothstep(.35,1,fd)·.35` toward `#3a414b`. Sky drawn as a full-screen gradient first.
  - Render target capped at `min(dpr, 2)` and ≤ 4.2 M pixels (Review Focus 5).

- [ ] **Step 1:** Write `gl-terrain.test.js`: enter `pangarchulla` dark; read pixels via `page.screenshot` + PNG decode (use `pngjs` dev dep): (a) top-centre pixel within 6 of `#0b0d11`; (b) **skyline agreement** — for 9 azimuths across the view, the first terrain row from the top in the GL image is within 3 px of the CPU skyline row computed with the v2 march (`__game.cpuSkylineRow(az)` hook built on `lineOfSight`/march code); (c) resize the viewport 1330×640 → 800×900 and assert (b) still holds and no errors (Review Focus 2); (d) at `deviceScaleFactor: 3` the GL drawing buffer is ≤ 4.2 M pixels (`__game.glBufferPixels()`).
- [ ] **Step 2:** Run — expected FAIL.
- [ ] **Step 3:** Implement `GLPano` (program setup, VAO with `pos/attr/colAz`, Uint32 index draw, depth texture via framebuffer for Task 5), sky pass, resize handling.
- [ ] **Step 4:** Run `node gl-terrain.test.js` — PASS; write `tests/out/stage1-dark.png` and compare visually to `docs/art/target-dark-summit-noir.png` (expected: same masses/shading, no flow lines/snow yet).
- [ ] **Step 5:** Commit + push: `feat: WebGL2 terrain renderer with Summit Noir shading`.

### Task 5: Outline pass (depth edges)

**Files:**
- Modify: `index.html` — `<script id="glsl-edge-fs">`, `GLPano` second pass
- Test: `tests/gl-edges.test.js`

**Interfaces:**
- Produces: `GLPano.render` draws a full-screen pass reading the linear-depth texture; line where `dLower/dUpper − 1 > 0.06 && dLower − dUpper > 250 m·(d/10 km)` (pixel below vs above, i.e. near terrain occluding far terrain), weight `min(1, 0.15 + Δ/140)` × `(1 − 0.45·√(d/maxD))·(1 − smoothstep(.55·maxD, maxD, d))`, ridge alpha × 0.55, skyline (terrain under sky) alpha 0.58, 1 px + 0.3-alpha second pixel; colour white (dark) / `#0d0e10` (light).

- [ ] **Step 1:** Write `gl-edges.test.js`: at the 9 skyline points from Task 4, the skyline pixel luminance exceeds both the sky pixel 3 px above and the terrain pixel 4 px below by ≥ 25; count of edge pixels in the view > 2,000 (ridges drawn, not just the skyline).
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement the edge pass.
- [ ] **Step 4:** Run — PASS; `smoke.test.js` PASS.
- [ ] **Step 5:** Commit + push: `feat: depth-edge outlines`.

### Task 6: Wire GLPano into play — live pan/zoom/visibility, overlays, telescope

**Files:**
- Modify: `index.html` — `enterViewpoint` (request mesh after LOS/rivers), `showPlay`, `drawPano`, `tick`, `newGen` (skip when `GLPano.ok`), `depthAtAng` (v3 branch), telescope `updateScope`, `stripRivers`/river visibility
- Test: `tests/gl-play.test.js`

**Interfaces:**
- Consumes: `GLPano.*` (Task 4/5), `project(az, d, h)` unchanged.
- Produces:
  - `GLPano.readDepthGrid(step = 4) → { w, h, step, data: Float32Array }` (metres, `Infinity` for sky) via a `readPixels` of the linear-depth target, called only on view settle (`onSettle`).
  - `depthAtAng(g, az, alt)` in v3 reads that grid (the `g` argument is ignored when `GLPano.ok`), so labels, rivers (per-vertex visibility recomputed on settle) and the telescope work unchanged.
  - Panning/zoom/visibility call `GLPano.render` from `tick`; the visibility slider sets `maxD` only (no `newGen`).

- [ ] **Step 1:** Write `gl-play.test.js`: enter `kausani`; run the existing quiz flow (open first `?`, wrong guess shakes, right guess → info bar text starts with the praise and peak name, progress `1/7`); scope on → info bar reads `Terrain` or a peak; 120 synthetic pan frames → no errors and `newGenCalls` counter (`__game.stats().newGen`) stays 0; move the visibility slider 150 → 60 km → `stats().meshBuilds` unchanged and far-range pixels at 100 km become sky colour.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement the wiring + `__game.stats()`.
- [ ] **Step 4:** Run `gl-play.test.js`, `smoke`, `cache` — PASS.
- [ ] **Step 5:** Commit + push: `feat: play view runs on GLPano`.

### Task 7: Drag-to-fly, fly-in/out, fallback, context loss

**Files:**
- Modify: `index.html` — fly control markup (`.fly`: replace chevron step buttons with a vertical drag track + handle and height read-out), pointer handlers, `playIntro` (sweep = animate `maxD` uniform 0 → target over 2 s instead of reveal frames), `goHome`, startup branch (`GLPano.init` → else v2.4), `webglcontextlost/restored` handlers
- Test: `tests/gl-fly.test.js`, `tests/fallback.test.js`

**Interfaces:**
- Produces: `setEyeOffset(m: number)` clamps to `[0, 5000]`, eased toward the target each frame (`τ = 120 ms`), updates label projection via `eyeOff`; drag maps the handle travel (track height) linearly to 0–5,000 m; double-tap/double-click on the track → 0. Keyboard Shift+↑/↓ = ±250 m.

- [ ] **Step 1:** Write `gl-fly.test.js`: drag the handle up 60 % of the track → `eyeOff` rises monotonically to ≈3,000 m (±150) with no frame where it decreases, `stats().meshBuilds` unchanged, skyline row at the view centre moves down; double-click → back to 0. Write `fallback.test.js`: `noWebGL2: true` → strip renderer active (`stats().newGen ≥ 1`), quiz flow works, no errors; and a context-loss case: call `WEBGL_lose_context.loseContext()` then `restoreContext()` → `ready()` true again within 10 s and no errors (Review Focus 1).
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement drag-to-fly, the GL intro/exit sweep, the fallback branch and context-loss handling (on unrecoverable loss: switch to v2.4 for the session).
- [ ] **Step 4:** Run all tests (`for f in *.test.js; do node $f || exit 1; done`) — PASS.
- [ ] **Step 5:** Update `docs/technical-design.md` (v3 renderer section), `docs/CONTEXT.md` (round: v3 Stage 1 shipped), `CLAUDE.md` (accent copper / light warm paper per spec §10.2; v3 GL architecture pointer; test command). Commit + push: `feat: drag-to-fly, GL fly-in, fallback and context loss — Stage 1 complete`.

---

## Stage 2 — Art (outline; detailed plan written when Stage 1 ships)

- Flow-line tracer in a worker over all terrain within range (spec §7.5, §10.1): seeds by height and relief, downhill tracing, bunching within 350 m, two density tiers, sector order nearest the heading first; cache in IndexedDB `hs-v3/flow` keyed `viewpointId@algoVersion`.
- Line pipeline: AA quads → half-float accumulation (additive, depth-tested) → composite `1 − e^(−2.6v)` × (0.5 + 0.5L), small blur; taper `smoothstep(0,.06,u)·smoothstep(0,.4,1−u)`; tier fade by zoom.
- Snow tone (snowline ≈4,900 m − 450(L−.5) − 260·tanh(0.6·conv)), mist relative to local valley floor.
- Ink & Mist light theme uniforms; rivers moved into the line pipeline (halo, core, sparkle).
- Settings: "Flow lines" toggle per theme (on dark / off light).
- Acceptance: side-by-side renders match `docs/art/*` targets; no line ends abruptly; no hard-white gully streaks.

## Stage 3 — Look and feel (outline)

- Cormorant Garamond + IBM Plex Mono; copper `#b8734a` replaces pink everywhere (incl. v2.4 fallback CSS).
- PeakFinder-format labels: slanted pill "Name 7,066 m", leader line, common band; selected = copper pill.
- Engraved-triangle viewpoint icons (map + grid), copper dot when done.
- Arrival caption (~3 s, then fades).
- Polish pass against targets on real devices via the live link.
