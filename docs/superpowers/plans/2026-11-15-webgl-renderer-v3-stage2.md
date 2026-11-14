# Himalaya Skyline v3 — Stage 2: Art — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the GPU panorama to the approved art: flow lines pouring off the summits, a snow tone, mist pooled in valleys, the full Ink & Mist light theme, and rivers drawn and depth-tested on the GPU, all without any processor work while panning, zooming or flying.

**Architecture:** A worker traces flow lines **in world space** over all terrain within range, one azimuth sector at a time (nearest the heading first), and the result is cached in IndexedDB. `GLPano` gains a **line pipeline**: instanced screen-space quads drawn into a half-float accumulation target that shares the terrain's depth buffer, then compressed and blended in the existing composite pass. Rivers reuse the quad program but draw straight into the colour target. Snow and mist are new terms in the terrain fragment shader, fed by one new per-vertex attribute (the local valley floor).

**Tech Stack:** WebGL2 (GLSL ES 3.00, instancing, `EXT_color_buffer_half_float`), Web Workers, IndexedDB, Node + Playwright tests on headless Chromium (SwiftShader) with real Terrarium tiles.

**Spec:** `docs/superpowers/specs/2026-11-15-webgl-renderer-v3-design.md` — Stage 2 is §7.3, §7.5, §7.6, §8 item 2, §10.1, §10.3, §10.5. Targets: `docs/art/target-dark-summit-noir.png`, `docs/art/target-light-ink-and-mist.png`. Counter-example: `docs/art/lesson-soft-layer-too-strong.png`. Constants: `docs/art/reference-flowlines-spike.js`.

## Owner decisions for Stage 2 (14 November 2026)

1. **Gullies: "quieter still".** Where lines pile up in a gully it is barely brighter than the flanks around it. The summits carry the light. This is stricter than the target image, which still shows a few bright gully streaks; the target is right for **cap brightness** only.
2. **No flow lines in the light theme.** A test render of ink lines on the light wash was rejected. Light stays pure wash and outlines; the Flow lines setting is not offered there.
3. **Rivers: muted glacier blue** in both themes, pale sparkles.
4. **Light theme: no paper grain.** Clean flat paper tones (the owner preferred the cleaner look in a with/without test render).

## Global Constraints

- One self-contained `index.html`, no build step; MapLibre the only external library. Shaders and worker code live in `<script type="text/plain">` blocks. Code shared by page and worker declares globals with `var`.
- Panning, zoom, visibility and fly height are uniform updates only: no tracing, no mesh build, no buffer upload, no `readPixels` while the view moves.
- Flow-line constants come from the spike. Composite compression starts at gain **0.8** (never 2.6). **No blur pass.**
- Both ends of every line taper: `smoothstep(0, .06, u) · smoothstep(0, .4, 1−u)`.
- Line colour never reaches pure white: the composite is capped (`flowMax` < 1).
- Flow lines exist in the **dark theme only**: on by default, and the On/Off choice is remembered. The light theme never draws or traces them.
- Cache: IndexedDB database `hs-v3`, object store `flow`, key `viewpointId@algoVersion`.
- Dark constants (Summit Noir): snow toward `#9aa2ad`; snowline `4900 − 450·(L − .5) − 260·tanh(0.6·conv)`; skyline alpha 0.58, ridges 0.55.
- Light constants (Ink & Mist): sky `#f6f3ec` → `#ece8de`; never pure white anywhere.
- Accent colours are not touched (copper is Stage 3). No pink, no yellow.
- Without WebGL2 the v2.4 strip renderer keeps working unchanged, including its canvas rivers.
- Each task ends with all tests passing (`cd tests && npm test`), a commit ending with the session attribution lines, and a push to `main` (the owner's instruction) with the session branch kept at the same commit.

## Review Focus

1. **Leaving or switching viewpoint while lines are still tracing:** late sectors from the old viewpoint must not appear in the new one or be stored under its key. → test in Task 5.
2. **A phone whose GPU cannot render to half-float:** the panorama must still draw (8-bit accumulation, or no lines), never a black or incomplete frame. → test in Task 6.
3. **Tiles missing on the first visit:** lines traced on holed terrain must not be cached for ever, and the tracer must emit no NaN. → tests in Tasks 4 and 5.
4. **IndexedDB missing, refused (private mode) or holding a damaged record:** trace again quietly; no error, no stall. → test in Task 5.
5. **WebGL context loss after lines and rivers are up:** after restore, terrain, lines and rivers all come back. → test in Task 8.

## File structure

Everything is in `index.html`; new blocks and sections:

| Block / section | Responsibility |
|---|---|
| `#mesh-src` (modify) | adds the valley-floor attribute; packs attributes to 16-bit |
| `#flow-src` (new, page + worker) | `flowSeeds`, `traceFlowSector`: the tracer, no DOM, no GL |
| `#glsl-terrain-fs` (modify) | snow, valley mist, light value into alpha |
| `#glsl-line-vs`, `#glsl-line-fs` (new) | screen-space quads for flow lines and rivers |
| `#glsl-edge-fs` (modify) | composite: compressed flow layer, then outlines |
| `GL_THEMES` (modify) | all art constants per theme (flow fields in dark only) |
| `GLPano` (modify) | accumulation target, line and river buffers, per-sector fade |
| `FlowStore`, `Flow` (new section "Flow lines") | IndexedDB, sector schedule, cancel, hand-off to `GLPano` |
| Tests | `tests/mesh.test.js` (modify), `tests/gl-art.test.js`, `tests/flow-trace.test.js`, `tests/flow-cache.test.js`, `tests/gl-lines.test.js`, `tests/gl-rivers.test.js`, `tests/acceptance.test.js`, `tests/compare.js` (new) |

---

### Task 1: Mesh — valley floor, 16-bit attributes, holes

**Files:**
- Modify: `index.html` — `buildPolarMesh` in `#mesh-src`, the `mesh` worker command, `buildMesh`, `GLPano.setMesh`, `#glsl-terrain-vs`
- Test: `tests/mesh.test.js`

**Interfaces:**
- Produces: `buildPolarMesh(levels, vp, o) → { cols, rows, r0, r1, rings, pos: Float32Array(n·3), attr: Int16Array(n·6) }`. Per vertex `attr = [nx·32767, ny·32767, conv·2000 (clamped), rel m (clamped ±32000), floor m, 0]`. A hole is `rel = −32768` (replaces `−1e9`).
- `floor` (valley floor): the mean of the **3 lowest** of 16 height samples on two rings of radius `R` and `R/2`, `R = max(1500, 0.08·d)`; never above the vertex's own height.
- Shader attributes: location 1 `aAttr` (4 normalised/integer shorts as floats: read with `vertexAttribPointer(1, 4, gl.SHORT, false, 12, 0)`), location 2 `aFloor` (`vertexAttribPointer(2, 2, gl.SHORT, false, 12, 8)`). The vertex shader rescales to the old units (`nx, ny` ÷ 32767, `conv` ÷ 2000) and outputs `vFloor`.
- `buildMesh` allocates the stitched arrays once and frees each band after copying (peak memory target: under 45 MB, was about 68 MB; log it in `stats.meshPeakMB`).

- [ ] **Step 1:** Extend `mesh.test.js`: `attr` is an `Int16Array` of `cols·rows·6`; for 20 random vertices `floor ≤ h` and `h − floor` is under 6,000 m; at the vertex nearest Dunagiri's summit `h − floor > 1500`; at the lowest vertex within 20 km `h − floor < 150`; with 30 % of tiles aborted, hole vertices carry `rel === −32768` and no value is NaN; `stats().meshPeakMB < 45`.
- [ ] **Step 2:** Run `node mesh.test.js` — FAIL (`attr` is a Float32Array).
- [ ] **Step 3:** Implement the packing, the floor attribute and the shader unpacking; update the hole test in `#glsl-terrain-fs` to `vAttr.w < -32000.0`.
- [ ] **Step 4:** Add to `gl-terrain.test.js` (Stage 1 test gap, "rendering a mesh with holes"): with 30 % of tiles aborted, the view draws, `errors` is empty, and no pixel in the frame is pure magenta/black-transparent (alpha 255 everywhere via `__game.glAlphaMin()`).
- [ ] **Step 5:** Run `npm test` — PASS. Commit + push: `feat: valley-floor attribute and 16-bit mesh attributes`.

### Task 2: Snow tone and valley mist (dark)

**Files:**
- Modify: `index.html` — `#glsl-terrain-fs`, `GL_THEMES.dark`, `GLPano.setTheme`, `GLPano.render`
- Test: `tests/gl-art.test.js` (new)

**Interfaces:**
- `GL_THEMES.<name>` gains: `snow` (hex), `snowK`, `snowLine` (m), `mistLo`, `mistHi` (now metres **above the valley floor**), `flowCol`, `flowGain`, `flowMax`, `gullyK`, `river` (hex), `glint` (hex). Dark values: `snow '#9aa2ad'`, `snowK .5`, `snowLine 4900`, `mistLo 120`, `mistHi 1100`.
- Terrain shader, after the existing light term `L`:
  - `sl = snowLine − 450·(L − .5) − 260·tanh(0.6·conv)`; `snow = smoothstep(sl − 300, sl + 1100, h)·(.55 + .45·L)·(1 − .55·fd)`; `c = mix(c, snow colour, snow·snowK)`.
  - `mist = (1 − smoothstep(mistLo, mistHi, h − floor))·smoothstep(.03, .25, fd)·.75 + smoothstep(.35, 1, fd)·.35`; `c = mix(c, mist colour, min(.85, mist·mistK))`.
  - `oCol.a = L` (the composite needs the light value; the composite writes its own alpha).
- `GLPano.setTheme(name)` converts every colour once into a cached `Float32Array` per uniform; `GLPano.render` allocates nothing per frame (no `rgb()` calls, no object spread for `last`: reuse one object). Test hook `__game.glAllocFree()` is not possible; instead assert by code path: `stats.themeBuilds` rises only on `setTheme`.
- Test hooks on `window.__game`: `terrainRGB(az, d) → [r,g,b]` (pixel where a world point projects, outlines and lines off), `setArt({ edges?, flow?, rivers? })` (switch layers for measurement).

- [ ] **Step 1:** Write `gl-art.test.js` (Pangarchulla, dark, outlines off): (a) the mean tone of a 9×9 box just under Dunagiri's summit is at least 25 luminance units brighter than a box on the same face about 1,800 m lower; (b) a lit slope at 5,200 m is brighter than a shaded one at the same height and distance (the snowline dips on lit ground); (c) the lowest visible valley point between 8 and 30 km is within 14 of the mist colour `#3a414b` in each channel and closer to it than a ridge point at the same distance; (d) repeat (c) at `kausani` (valley floors near 1,000 m, where Stage 1's absolute 2,400–4,300 m rule put mist on everything): a ridge top at 10–30 km is **not** within 14 of the mist colour; (e) after 60 pan frames `stats().themeBuilds` is unchanged.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement the shader terms, theme fields, the uniform cache and the hooks.
- [ ] **Step 4:** Run `gl-art`, `gl-terrain`, `gl-edges`, `gl-play` — PASS (update `gl-edges` only if its luminance margins moved; do not loosen below 20).
- [ ] **Step 5:** Commit + push: `feat: snow tone and valley mist`.

### Task 3: Ink & Mist light theme

**Files:**
- Modify: `index.html` — `GL_THEMES.light`, `#glsl-edge-fs` (white clamp), `#glsl-sky-fs` if the horizon band needs it
- Test: `tests/gl-art.test.js`

**Interfaces:**
- `GL_THEMES.light` starting values (tuned in Task 9 against the target): `skyTop '#f6f3ec'`, `skyHor '#ece8de'`, `near '#56534e'`, `far '#c9c4b9'`, `glow '#bcb7ad'`, `deep '#2f2d2a'`, `mist '#e6e2d8'`, `glowK .5`, `deepK .55`, `sun 1`, `curvK .5`, `haze .25`, `mistK 1`, `mistLo 120`, `mistHi 1100`, `snow '#d8d4ca'`, `snowK .25`, `snowLine 4900`, `line '#1d1c1a'`, `skyA .8`, `ridgeA .7`.
- Composite: clamp so no channel exceeds `0.972` (never pure white). No grain (owner decision 4).

- [ ] **Step 1:** Add to `gl-art.test.js` (Pangarchulla, light): top-centre sky within 6 of `#f6f3ec`; no pixel in the frame is `[255,255,255]`; near terrain (under 6 km) mean luminance is under 110 and terrain at 60–100 km is over 170 (ranges lighten with distance); the valley point from Task 2 (c) is within 16 of `#e6e2d8`; the skyline pixel is at least 40 darker than the sky above it; a 16×16 sky box is perfectly smooth (standard deviation under 0.5: no grain).
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `gl-art`, `gl-play`, `smoke` — PASS. Write `tests/out/stage2-light-wash.png`.
- [ ] **Step 5:** Commit + push: `feat: Ink & Mist light theme`.

### Task 4: Flow-line tracer (`#flow-src`)

**Files:**
- Create in `index.html`: `<script id="flow-src" type="text/plain">` (appended to the worker source in `makeWorker()` and evaluated on the page like `#shared-src`); worker command `flow`
- Modify: `makeWorker`, `ask` (worker hardening)
- Test: `tests/flow-trace.test.js` (new)

**Interfaces:**
- Consumes: `elevAt`, `geoFrom`, `azDist`, `K_DEG` from `#shared-src`.
- Constants (with `var`): `FLOW_ALGO = 1`, `FLOW_SECTORS = 16`, `FLOW_PPR = 1150` (reference pixels per radian: the default zoom), `FLOW_D0 = 150`, `FLOW_MAXD = 230000`, `FLOW_STRIDE = 8`, `FLOW_BUDGET = 900000` (vertices, all sectors and tiers).
- The tracer works on a **log-polar lattice**: cell `(ia, id)` with `ia = az·FLOW_PPR`, `id = ln(d / FLOW_D0)·FLOW_PPR`. One cell is `d / FLOW_PPR` metres in both directions, which is "spacing in metres, scaled by distance" (§7.5).
- `traceFlowSector(levels, vp, o) → { verts: Float32Array, nLines: number, edge: Int32Array }` with `o = { sector, az0, tier: 0|1, occ: Int32Array|null, budget }`:
  - Sector `s` covers azimuths `az0 + (s ± ½)·2π/16`. Seeds belong to the sector they start in; a line may run outside it.
  - **Seeds:** lattice points every 2 cells (tier 1: the same lattice offset by one cell). Keep a seed when `h > 3300` and `hash(ia, id) < 0.03 + 0.88·top`, `top = max(sm(3800, 7200, h)^1.2, sm(120, 650, rel))`, `rel` as the mesh's relief (8 samples at `max(1200, 0.06·d)`). Sort by height, highest first.
  - **Skip a seed** when `h < 5600 && rel < 250` and another line is within `0.6·sepAt(h)` cells; `sepAt(h) = 1.1 + 15·(1 − sm(3600, 7000, h))^1.3` (tier 1: half of it).
  - **Trace downhill:** step `2·d/FLOW_PPR` metres along the negative gradient (gradient spacing `max(25, 0.004·d)`), at most 500 steps. Stop when: the gradient is under 0.04; a height is missing; `d` leaves `[FLOW_D0, FLOW_MAXD]`; or the line is more than **350 m below its start** and another line is within `0.5·sepAt(h)` cells. Drop lines with fewer than 6 vertices. No visibility test (§10.1).
  - **Vertex** (8 floats): `east, north, height + 2, u, h0, rel0, conv, flag`. `u` = arc-length fraction 0→1. `conv` = the v2.4 curvature at the point. `flag = tier + (last vertex of its line ? 2 : 0)`.
  - `occ`: cells already taken by neighbouring sectors and by tier 0 (`[ia, id]` pairs); `edge`: this call's occupied cells within 6° of the sector's edges, in the same form.
  - Stops adding lines when `budget` vertices are reached (lowest seeds are the ones lost).
- Worker command: `{ cmd: 'flow', id, sector, az0, tier, occ, budget }` → `{ cmd: 'flow', id, sector, tier, verts: ArrayBuffer, nLines, edge: ArrayBuffer }` (buffers transferred).
- Worker hardening (Stage 1 deferred item): `makeWorker` sets `w.onerror`; `ask(w, msg, transfer, timeoutMs = 60000)` rejects on worker error or timeout and clears its callback. Callers of `ask` in `buildMesh` let the rejection reach `enterViewpoint`'s failure card.

- [ ] **Step 1:** Write `flow-trace.test.js` using a hook `__game.traceForTest(viewpointId, { sector, tier }) → { verts, nLines }` (runs the worker command for the sector facing Dunagiri): (a) `nLines > 300`; (b) no NaN in `verts`; (c) in every line `u` rises strictly from 0 to 1 and height never rises by more than 3 m between vertices (downhill); (d) every line has at least 6 vertices; (e) over 60 % of lines start above 4,500 m; (f) seeds per km² above 5,500 m are at least 5× those between 3,300 and 4,000 m; (g) **spacing:** for 200 random vertices more than 350 m below their line's start, no vertex of another line lies within `0.4·sepAt(h)` cells; (h) tier 1 with tier 0's cells as `occ` returns lines none of which starts within `0.25·sepAt` of a tier-0 vertex; (i) with 30 % of tiles aborted the call returns and has no NaN (Review Focus 3); (j) `budget: 2000` returns at most 2,000 vertices; (k) `ask` to a worker that throws rejects within its timeout (`__game.askBrokenWorker()` rejects, the page logs no uncaught error).
- [ ] **Step 2:** Run — FAIL (`traceForTest` undefined).
- [ ] **Step 3:** Implement `#flow-src`, the worker command, the hook and the `ask` hardening. Occupancy is a typed grid over the sector plus a 6° margin, not a `Map`.
- [ ] **Step 4:** Run `flow-trace`, `mesh`, `smoke` — PASS. Log the time for one sector, both tiers (expect under 4 s in the sandbox).
- [ ] **Step 5:** Commit + push: `feat: flow-line tracer in a worker`.

### Task 5: Flow store and sector schedule

**Files:**
- Modify: `index.html` — new section "Flow lines" (`FlowStore`, `Flow`), `buildLevels` (count missing tiles), `enterViewpoint`, `goHome`, `stopWorkers`
- Test: `tests/flow-cache.test.js` (new)

**Interfaces:**
- Consumes: worker command `flow` (Task 4).
- `FlowStore.get(key: string) → Promise<{ sectors: ArrayBuffer[] } | null>`; `FlowStore.put(key, { sectors }) → Promise<void>`. Database `hs-v3`, store `flow`. Every failure (no IndexedDB, blocked open, quota, read error) resolves `null` / resolves quietly. `get` returns `null` unless the record has exactly 16 buffers, each a multiple of `FLOW_STRIDE·4` bytes.
- `Flow.start(cur, heading) → void`: key `cur.def.id + '@' + FLOW_ALGO`. On a cache hit, hands all 16 sectors over at once. Otherwise:
  - `az0` = `heading` (sector 0 is centred on the opening view).
  - Sectors run in two waves so neighbours never trace at the same time: even sectors first, then odd, each wave ordered by angular distance from the heading and spread over the worker pool. An odd sector receives its two neighbours' `edge` cells as `occ`. Tier 1 for a sector runs straight after its tier 0, with tier 0's cells in `occ`.
  - Each finished sector (both tiers concatenated) is handed to `Flow.onSector(sector, verts: Float32Array, fromCache: boolean)`.
  - When all 16 are in and `cur.tilesMissing === 0`, `FlowStore.put`.
- `Flow.cancel()`: bumps an epoch; results from an older epoch are dropped (not delivered, not stored). Called from `goHome`, at the top of `enterViewpoint`, and from `stopWorkers`.
- `Flow.state() → { done: number, total: 16, fromCache: boolean, tracing: boolean }`; `stats.flowTraces` counts worker `flow` calls.
- `buildLevels` records `levels.missing` (tiles that never arrived); `CUR.tilesMissing` carries it.
- Leftover state (Stage 1 deferred item): `enterViewpoint` and `goHome` reset `GLPano.grid`, `rivers.anchors`, `Flow`, and the line buffers (Task 6's `GLPano.clearLines()`; until Task 6 exists `Flow.onSector` only stores the arrays).

- [ ] **Step 1:** Write `flow-cache.test.js`: (a) first visit to `pangarchulla`: `Flow.state().done` reaches 16 and the first sector delivered is sector 0; `stats().flowTraces === 32`; (b) `goHome`, enter again in the same context: all 16 arrive with `fromCache` true and `flowTraces` unchanged; (c) **switch mid-trace** (Review Focus 1): enter `kausani`, and as soon as `done ≥ 1` enter `pangarchulla`; no sector delivered afterwards has vertices farther than 1 m outside what `pangarchulla` itself produces (compare total vertex count with (a)), and the store holds no `kausani@1` record; (d) **damaged record** (Review Focus 4): overwrite `pangarchulla@1` with `{ sectors: [new ArrayBuffer(7)] }`, enter again: lines are traced afresh, `errors` empty; (e) **no IndexedDB**: with `indexedDB` stubbed to throw on `open` (init script), the first visit completes 16 sectors and `errors` is empty; (f) **missing tiles** (Review Focus 3): with 30 % of tiles aborted, 16 sectors arrive but the store has no record; (g) Stage 1 test gap "a revisit with tiles aborted": after a clean first visit, a second visit with every tile request aborted still loads from the tile cache and the flow store with zero tile requests reaching the network.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `FlowStore`, `Flow`, the missing-tile count and the state resets. `Flow.start` is called from `enterViewpoint` after the mesh is set (GL mode only, and only when flow lines are on for the theme or become on later: see Task 7).
- [ ] **Step 4:** Run `flow-cache`, `cache`, `gl-play`, `fallback` — PASS.
- [ ] **Step 5:** Commit + push: `feat: flow lines cached on the device, traced nearest the heading first`.

### Task 6: Line pipeline on the GPU

**Files:**
- Create in `index.html`: `#glsl-line-vs`, `#glsl-line-fs`
- Modify: `GLPano` (targets, buffers, render), `#glsl-edge-fs` (composite), `Flow.onSector` wiring
- Test: `tests/gl-lines.test.js` (new)

**Interfaces:**
- Consumes: `Flow.onSector` (Task 5), vertex layout from Task 4, theme fields from Task 2.
- `GLPano.setFlowSector(sector: number, verts: Float32Array, fadeIn: boolean)`: uploads one buffer + VAO per sector. Instanced: each instance is a segment whose two ends are the same buffer bound twice, one vertex apart (`vertexAttribDivisor 1`), drawn as a 4-vertex strip. A segment starting at a vertex with `flag ≥ 2` collapses. `fadeIn` starts a 600 ms fade for that sector (`performance.now()` based; `needDraw` stays true while a fade runs). `GLPano.clearLines()` deletes them all. `GLPano.flowOn: boolean`.
- **Accumulation target:** `R16F` when `EXT_color_buffer_half_float` (or `EXT_color_buffer_float`) is present and `checkFramebufferStatus` is complete; otherwise `R8` with every line alpha written at ¼ strength and the composite multiplying back by 4 (`GLPano.flowMode: 'half' | 'byte' | 'off'`). It is the same size as the main target and **shares its depth renderbuffer**, depth test `LEQUAL`, depth writes off, blend `ONE, ONE`. If the main framebuffer itself is incomplete, or the size exceeds `MAX_TEXTURE_SIZE`, the buffer scale is halved and retried once; then `GLPano.ok = false` and `onGiveUp()` (Stage 1 deferred item).
- **Line vertex shader:** projects both ends exactly as the terrain shader; expands the quad by `0.75·s/2 + 1` buffer pixels across the segment (`s` = buffer scale); depth `(d·0.997 − 25) / uFar`; drops segments behind the viewer (`|dx| > 2.2`) and beyond `uMaxD`.
- **Line fragment alpha** (colour is applied in the composite):
  - `peakK = .05 + .2·sm(4300, 7400, h0) + .14·sm(120, 650, rel0)`
  - `down = sm(h0 − clamp(3·rel0, 900, 2800), h0, h)`
  - `a = .38·peakK·(.1 + .9·down^1.6) · (1 − min(1, 1.15·d/uMaxD)) · (.25 + .75·sm(2000, 25000, d))`
  - `· smoothstep(0, .06, u)·smoothstep(0, .4, 1 − u)` (taper)
  - `· (1 − uGullyK·sm(0, 1, −tanh(.6·conv)))` (owner decision 1; `gullyK .7`)
  - `· tierK`: tier 0 → `clamp(z, .45, 1)`; tier 1 → `smoothstep(1.3, 1.9, z)`; `z = ppr / FLOW_PPR`
  - `· coverage` (1 at the centre line, 0 at the quad edge) `· uFade` (sector fade)
- **Composite** (`#glsl-edge-fs`, before the outlines): `f = flowMax·(1 − exp(−flowGain·v))·(.5 + .5·L)`, `c = mix(c, flowCol, f)`. Dark: `flowCol '#eceff4'`, `flowGain .8`, `flowMax .8`. The light theme has no flow fields and skips the accumulation pass. No blur.
- Draw order per frame: sky → terrain → (rivers, Task 8) → flow accumulation (only the sectors within the view ± margin, only when `flowOn`) → composite.
- `stats.lineUploads` counts `setFlowSector` calls; `stats.lineDraws` the sector draws in the last frame.

- [ ] **Step 1:** Write `gl-lines.test.js` (Pangarchulla, dark, outlines off, waiting for `Flow.state().done === 16` and fades finished): (a) the Dunagiri cap box from Task 2 (a) is at least 30 brighter with lines on than off (`setArt({flow})`); (b) **no hard white:** the brightest terrain pixel in the frame is under 228 in every channel, and under 0.05 % of terrain pixels exceed 205; (c) **quiet gullies:** find the 20 most concave on-screen mesh points between 3 and 40 km (`__game.concavePoints(20)`); their mean luminance is no more than 12 above the mean of points 6 px to either side; (d) **depth test:** a line vertex known to be behind a nearer ridge (`__game.hiddenLinePoint()`: a vertex whose `depthAt` is under 0.9 of its distance) shows identical pixels with lines on and off; (e) **fly:** at `eyeOff = 3000` the frame still has lines (cap box brighter on than off) and `stats().flowTraces`, `lineUploads`, `meshBuilds` are unchanged from before the climb; (f) **tiers:** at 2.2× zoom the count of lit line pixels in the cap box is higher with tier 1 than when `__game.setArt({ fine: false })`; at 1× zoom toggling `fine` changes nothing; (g) **pan:** 120 pan frames leave `flowTraces`, `lineUploads`, `meshBuilds` unchanged and `errors` empty; (h) **Review Focus 2:** with `getExtension` stubbed to return `null` for both float-buffer extensions, `GLPano.flowMode === 'byte'`, the frame draws, the cap box is still brighter on than off, `errors` empty; with `checkFramebufferStatus` stubbed to report incomplete for the accumulation target, `flowMode === 'off'` and the terrain still draws; (i) **progressive:** on a first visit, a screenshot taken when `done` is between 1 and 15 already shows the terrain (`ready()` true) and no console errors.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement the programs, the target with its fallbacks, the buffers, the composite and the hooks.
- [ ] **Step 4:** Run `npm test` — PASS. Write `tests/out/stage2-dark-lines.png`.
- [ ] **Step 5:** Commit + push: `feat: flow lines drawn on the GPU`.

### Task 7: "Flow lines" setting (dark theme)

**Files:**
- Modify: `index.html` — settings card markup (`#seg-contours` → `#seg-flow`, label "Flow lines"), `PREFS`, the theme and segment handlers, `Flow.start` gating
- Test: `tests/gl-play.test.js`, `tests/fallback.test.js`

**Interfaces:**
- `PREFS.fl = true` (the dark theme's choice); `flowOn() → boolean` is `PREFS.theme === 'dark' && PREFS.fl`. `PREFS.ct` stays only for the v2.4 fallback, fixed at its per-theme defaults (off in dark, on in light), with no control: contours are retired in v3 (§10.3).
- Picking On/Off sets `GLPano.flowOn` (a uniform-level switch, instant). If lines were never traced for this viewpoint, turning it on calls `Flow.start` and they fade in.
- The row is hidden in the light theme and without WebGL2 (`body[data-theme=light] .t-flow, #play:not(.gl) .t-flow { display: none }`). Switching to light sets `GLPano.flowOn = false` and does not start a trace; switching back to dark restores the remembered choice.

- [ ] **Step 1:** Extend `gl-play.test.js`: the settings card has a "Flow lines" row and no "Contours" row; dark starts On; turning it Off in dark, switching to light and back shows Off in dark (remembered), and it survives a reload; in light the row is not visible, the frame is identical to one taken with `setArt({ flow: false })`, and entering a fresh viewpoint in light leaves `stats().flowTraces` at 0 (owner decision 2); switching that viewpoint to dark then traces and fades the lines in; toggling it does not change `stats().meshBuilds`. Extend `fallback.test.js`: with `noWebGL2` the row is not visible and the quiz flow still passes.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` — PASS.
- [ ] **Step 5:** Commit + push: `feat: Flow lines setting for the dark theme`.

### Task 8: Rivers on the GPU

**Files:**
- Modify: `index.html` — `GLPano` (river buffer, three draws), `#glsl-line-vs/-fs` (river mode), `enterViewpoint`, `glRivers` (anchors only), `drawRivers` (canvas path only when `!GLPano.ok`), `GLPano.onRestore`, `GL_THEMES` river colours
- Test: `tests/gl-rivers.test.js` (new), `tests/fallback.test.js`, `tests/gl-fly.test.js`

**Interfaces:**
- `GLPano.setRivers(verts: Float32Array /* lon, lat, h, acc ×n */, lines: {o, n}[], riverT: number, vp: {lat, lon})`: builds one buffer of `[east, north, h + 4, s, acc, flag]` (`s` = arc length in metres from the line's start; `flag 2` on a line's last vertex) and a VAO for the same instanced quad program. `GLPano.clearRivers()`.
- Drawn into the **colour target** after the terrain: depth test on against the terrain depth with the v2 tolerance (`depth = (d·0.93 − 150) / uFar`), depth writes off, normal alpha blending, colour mask `RGB` only (alpha keeps `L`).
- Three draws, same widths and strengths as v2.1's canvas rivers: `big = log10(acc/riverT + 1)`, `near = clamp(8000/d, .3, 1.4)`, `w = max(.55, (.45 + .95·big)·near·zoomK)` css px, `zoomK = clamp(ppr/1100, .7, 2.2)`, `fade = max(0, 1 − (d/uMaxD)^.8)·min(1, .45 + .35·big)`; vertices with `d < 150` or `d > uMaxD` collapse.
  - halo: width `3.2w + 1.5`, alpha `.13·fade`;
  - core: width `w`, alpha `.82·fade`;
  - sparkle: width `w + .4`, alpha `.55·fade` where `fract((s·ppr/d − uTime·.018·min(1.4, .6 + .4·big)) / 65.5) < 1.5/65.5`, only for `big ≥ .25`; skipped under reduced motion. While sparkles run the frame redraws continuously (the tick already runs every frame for rivers).
- Colours (owner decision 3): dark `river '#7e9ab2'`, `glint '#dce8f2'`; light `river '#5c7a94'`, `glint '#fbfaf6'`.
- `glRivers()` keeps choosing the name-pill anchors from the settle depth grid; it no longer sets per-vertex visibility for drawing. In GL mode nothing is drawn on `#fx` for rivers.
- Context restore (Review Focus 5): `GLPano.onRestore` re-sets the mesh, then `GLPano.setRivers` from the kept `rivers` arrays, then `Flow.start` (which reads the store).

- [ ] **Step 1:** Write `gl-rivers.test.js` (Kausani, dark; flow lines and outlines off): (a) with rivers on vs off (`setArt({rivers})`), at least 150 pixels differ and the changed pixels are bluer than before (`b − r` rises by ≥ 8 on average); (b) **no pop-in:** pan 40° in 30 frames without letting the view settle, then screenshot immediately: river pixels are present in the newly revealed third of the screen (Stage 1 needed a settle); (c) **hidden stays hidden:** a river vertex with terrain in front (`depthAt < 0.85·d`) draws no changed pixel; (d) **fly:** at `eyeOff = 2500` more river pixels are visible than at 0, with no `readPixels` in between (`stats().depthReadPixels` unchanged during the climb frames); (e) **sparkle moves:** two screenshots 400 ms apart differ in under 2 % of river pixels and in at least 10 pixels; with `prefers-reduced-motion` they are identical; (f) river name pills still appear after a settle; (g) light theme: river pixels are within 30 of `#5c7a94` at the core of the widest river; (h) Review Focus 5: lose and restore the context: after `ready()`, (a) holds again and, with flow lines on, the Task 6 cap-box check holds again. Extend `fallback.test.js`: without WebGL2, rivers still draw on `#fx` (non-empty canvas). Extend `gl-fly.test.js` (Stage 1 test gap, "the fly-in with the map"): run the real fly-in (`selectVp` + enter, map loaded) and assert that during the sweep no river or flow pixel shows beyond the sweep radius (sample a far range point: it equals the map-through-transparent state, alpha 0 via `__game.glAlphaAt`), and that after the intro `ready()` is true with no errors.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` — PASS.
- [ ] **Step 5:** Commit + push: `feat: rivers drawn and depth-tested on the GPU`.

### Task 9: Tune against the targets, acceptance, docs

**Files:**
- Create: `tests/compare.js` (side-by-side sheet), `tests/acceptance.test.js`
- Modify: `index.html` (`GL_THEMES` values, tracer constants if needed → bump `FLOW_ALGO`), `docs/technical-design.md`, `docs/CONTEXT.md`, `CLAUDE.md`, `docs/roadmap.md`
- Test: `tests/acceptance.test.js`

**Interfaces:**
- `node tests/compare.js` → `tests/out/compare-dark.png`, `tests/out/compare-light.png`: the target on the left, the live render on the right, at the target's framing (1400×760, hfov 64°, heading = Dunagiri's azimuth + 0.05, pitch 0.035, visibility 150 km, labels and chrome hidden). Also `tests/out/tour-<viewpoint>-<theme>.png` for all five viewpoints.
- Tuning rules: change one constant at a time, starting from `flowGain 0.8`; never add a blur; if a tracer constant changes, bump `FLOW_ALGO` so cached lines are retraced. Look at: cap brightness against the target (caps read as snow, with slope texture still visible inside them, unlike the "too strong" image); flanks a faint texture; no specks from short stray lines (raise the minimum line length before touching brightness); gullies quiet; light theme masses, mist and outline weight against the light target.
- Foreground summits below 3,300 m (Kausani, Tiger Hill) get no lines under the spike's seed gate; record how the tour images look and raise it with the owner rather than changing the gate silently.

- [ ] **Step 1:** Write `acceptance.test.js` at the target framing, dark, everything on: (a) mean luminance of the Dunagiri cap box is within 22 of the same box in `target-dark-summit-noir.png`; (b) mean luminance of a flank box (the broad slope right of centre, target pixels 1000–1150 × 520–600) is within 18 of the target; (c) no terrain pixel above 228; under 0.05 % above 205; (d) **no abrupt ends:** from `__game.lineEnds(300)` (screen positions of 300 visible line ends), the mean absolute luminance difference between each end pixel and the terrain-only render at that pixel is under 3; (e) **no specks:** connected bright components (luminance > 150, area ≤ 4 px) below 4,200 m number fewer than 15; (f) light theme at the same framing: sky box within 8 of the target's sky box, the three terrain boxes (near, middle, far) each within 22 of the target, no pure-white pixel; (g) **panning stays uniform-only:** over 240 pan + zoom + fly frames `flowTraces`, `lineUploads`, `meshBuilds`, `themeBuilds` and `depthReadPixels` do not change, and `stats().lineDraws ≤ 16`.
- [ ] **Step 2:** Run — expect FAIL on the brightness bands before tuning.
- [ ] **Step 3:** Tune with `compare.js` until `acceptance.test.js` passes and the sheets read like the targets.
- [ ] **Step 4:** Run `npm test` — PASS, all files.
- [ ] **Step 5:** Docs: `technical-design.md` ("Panorama renderer v3": Stage 2 sections for the tracer, store, line pipeline, snow and mist, light theme, GPU rivers, the fallbacks); `CONTEXT.md` (Round 13: the four owner decisions and what shipped); `CLAUDE.md` (flow-line pointers, `FLOW_ALGO` bump rule, Flow lines setting); `roadmap.md`. Commit + push: `feat: Stage 2 art tuned to the targets — Stage 2 complete`.
- [ ] **Step 6:** Send the owner `compare-dark.png`, `compare-light.png`, the tour images and the live link https://utkarshacad.github.io/himalaya-skyline/ for the smoothness check on a phone.

---

## Deferred Stage 1 items: where they land

| Item | Where |
|---|---|
| Contours toggle does nothing in GL mode | Task 7 (replaced by Flow lines) |
| No worker `onerror` or `ask()` timeout | Task 4 |
| Mesh memory peak about 68 MB | Task 1 |
| Per-frame allocations in `GLPano.render` | Task 2 |
| No `MAX_TEXTURE_SIZE` or framebuffer-status fallback | Task 6 |
| Small leftover state between viewpoints | Task 5 |
| Test gap: rendering a mesh with holes | Task 1 |
| Test gap: a revisit with tiles aborted | Task 5 |
| Test gap: the fly-in with the map | Task 8 |
| Fly track: a tap then a drag counts as a double-tap | **Not in Stage 2** (nothing here touches the fly control); Stage 3 polish |

## Copper accent, brought forward (owner, 15 November 2026)

Done between Task 6 and Task 7: copper `#b8734a` replaces the pink accent everywhere in both themes and the v2.4 fallback: selected peaks, marks (flag, favourite), active buttons and chips, sliders, the fly handle, focus rings, and the home map. Test: no pink (`#ff3b77`, `#e0245e`, or their rgba forms) remains in the page's CSS or inline styles, and the accent custom property computes to `#b8734a` in both themes.

## Stage 3 — Look and feel (outline; owner additions 15 November 2026)

- Cormorant Garamond + IBM Plex Mono; copper `#b8734a` replaces pink everywhere (including the v2.4 fallback CSS).
- PeakFinder-format labels: slanted pill "Name 7,066 m", leader line, common band; selected = copper pill.
- Engraved-triangle viewpoint icons (map + grid), copper dot when done.
- Arrival caption (about 3 s, then fades).
- **Edge turning (new, owner):** holding the far left or right edge of the panorama turns the view slowly that way, easing to a stop on release. The zones are invisible; a faint copper chevron (‹ ›) fades in at that edge on hover (desktop) or while pressed (phone). Nothing stays on the map.
- Fly-track tap-then-drag fix; polish against the targets on real devices.
