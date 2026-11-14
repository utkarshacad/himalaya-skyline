# Himalaya Skyline v3: WebGL renderer and art direction

Status: **approved by the owner** · 15 November 2026

## 1. Intent

The owner wants the panorama to be "a beautiful art piece": modern and high-tech, PeakFinder at heart, and smooth with no lag or blur. He reached the look through a series of rendered style boards. The current renderer (v2.x) cannot reach that look or that smoothness:

- **It runs on the processor.** Every zoom, visibility or height change waits for strips to be re-rendered, which shows up as lag and blur.
- **Its line work is per-pixel.** The approved flow-line art cannot be drawn live.

v3 moves drawing to the GPU (WebGL2) and adopts the approved art direction. The target images are in `docs/art/`.

## 2. Goals

1. **Dark theme "Summit Noir"** (target: `docs/art/target-dark-summit-noir.png`):
   - Charcoal night sky (#0b0d11 at the top to #2b313a at the horizon). Dark grey terrain with soft curvature light.
   - **Flow lines** start on high ground and run downhill:
     - Dense near summits, so every summit (foreground included) looks snow-capped. Higher peaks are brighter.
     - Thinning and fading down the flanks into a faint texture.
   - A **snow tone** in the terrain from about 4,900 m. The snowline dips on lit, convex ground and pulls back in shadow, so the caps blend into the dark grey slopes.
   - **Blue-grey ink-and-mist depth** on the back ranges and valleys.
   - **Dimmed outlines** (skyline about 0.58 alpha, ridges about 0.55).
2. **Light theme "Ink & Mist"** (target: `docs/art/target-light-ink-and-mist.png`):
   - Warm paper sky (#f6f3ec to #ece8de) with ink-wash ranges that lighten with distance and fine ink outlines.
   - Mist pools in valleys relative to the local valley floor, not absolute height. No flow lines by default.
3. **Flow-line quality rules (owner feedback):**
   - Lines are continuous.
   - No line ends abruptly: both ends taper.
   - Where lines pile up (gullies), they glow softly instead of clipping to hard white. The accumulation is compressed: `1 − e^(−k·sum)`.
   - Lines sit in the terrain as texture: slightly softened, dimmer in shadow.
4. **Smoothness:** panning, zoom, the visibility range and fly height all update live at 60 fps on a mid-range phone or laptop GPU. No render waits, no blur.
5. **Fly by dragging:** dragging on the fly control (or two-finger vertical drag on touch) lifts the eye continuously from 0 to +5,000 m. There are no 300 m steps.
6. **Cached data:** a viewpoint's terrain tiles and its traced flow lines download or compute once and are stored on the device. Revisits start instantly and work offline.
7. **UI restyle:**
   - Typography: Cormorant Garamond for names and titles, IBM Plex Mono for figures.
   - Accent: copper (#b8734a) replaces pink everywhere.
   - Viewpoint icons on the home map and grid: engraved triangles (small hatched triangle; copper dot when done).
   - Peak labels in PeakFinder format: a slanted pill reading "Name 7,066 m", with a leader line to the summit, on a common band. The selected label is a copper pill.
8. **Keep all game features:**
   - Name the Skyline quiz, scoring, hints, fact cards.
   - Telescope, marks, visibility slider, theme switch, mini-map, compass.
   - Rivers with glint, the fly-in and fly-out transitions, the Himalaya grid drawer.

## 3. Non-goals (for v3)

- "Stand anywhere" (roadmap item B). The design should not block it.
- Labelling every OSM peak.
- A native or installable app (a later PWA step).
- New viewpoints.

## 4. Anti-goals: these would count as failure even if the code works

- Any visible stutter or blur while panning, zooming or flying.
- Concentric "trippy" contours, jagged or disjointed lines, lines ending abruptly, hard white streaks.
- Pink or yellow accents, chunky UI, or any panel that permanently covers the view.
- Losing the PeakFinder feel: crisp skyline, readable ridges.

## 5. Constraints

- **One `index.html`**, no build step, hosted on GitHub Pages.
  - MapLibre is the only external library.
  - Google Fonts is allowed for the two typefaces.
- **WebGL2 is required for v3.** Browsers without it keep the v2.4 renderer as a fallback; the old code path is kept.
- **Terrain source unchanged:** AWS Terrarium tiles at z9–z12.
- **Mobile:** Android Chrome and iOS Safari, from 2020-era devices up. The GPU budget must allow a phone at device-pixel-ratio 2–3 to hold 60 fps.

## 6. Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **1. Full WebGL renderer, flow lines traced once per viewpoint as 3D polylines on the terrain** | Biggest build. Everything live at 60 fps, and lines stay glued to slopes while flying. | **Chosen by the owner** |
| 2. Keep the processor renderer and add flow lines as a post-process | Least new code, but lines re-trace after every zoom or height change (about a minute in the spikes). Fails the smoothness goal. | Rejected |
| 3. WebGL terrain, flow lines as a flat screen overlay | Easier than 1, but lines slide off the slopes while flying and look pasted on. | Rejected |

## 7. Design

### 7.1 Data and caching
- Tile fetching stays as in v2 (`loadTile`).
- The **Cache API** (`caches.open('hs-tiles-v1')`) stores raw PNG responses, keyed by URL. It is checked first.
- **IndexedDB** (`hs-v3`, store `flow`) stores the traced flow-line buffers per `viewpointId + algorithmVersion`, as Float32Array blobs.
- A "Downloading Pangarchulla: 63 of 112 tiles" state appears only on a first visit.

### 7.2 Terrain mesh: a polar grid around the viewer
- The viewpoint is fixed and only the eye height changes, so a **polar grid** centred on the viewer gives even screen density at every distance:
  - azimuth columns: ~2,048 for 360°;
  - radial rows: ~600, spaced geometrically from 12 m to the visibility limit.
- A worker samples the existing level mosaics (with the v2.2 level blending) and builds a vertex buffer in a local east-north-up frame (metres). The vertex shader adds Earth curvature and refraction (`d²·(1−0.13)/2R`).
- Per-vertex attributes:
  - position;
  - normal, from the gradient;
  - curvature (`conv` at 2.5× spacing, as in v2.4);
  - "relief above surroundings" (`rel`, the spike's `relAt`), used for snow caps and mist.
- About 1.2 M vertices with 32-bit indices: fine for WebGL2.
- **Projection is cylindrical in the vertex shader,** with screen x = azimuth and y = elevation angle, matching labels, the telescope and the v2 maths. Each polar-grid triangle is small enough for linear interpolation to stay accurate.

### 7.3 Shading (fragment shader)
- The tone combines:
  - near-to-far colour;
  - sun hillshade (weak in dark);
  - curvature glow;
  - snow tone (§2);
  - distance haze;
  - mist.
- Mist strength uses height above the local valley floor (a per-vertex attribute: a blurred minimum height), so it works at every viewpoint.
- All theme constants are uniforms. Theme switching is instant.

### 7.4 Outlines
- Terrain renders depth into a texture. A full-screen pass draws a line where linear depth jumps between a pixel and the pixel below.
- Line weight grows with the size of the jump (as in v2's `drop`) and fades near the visibility limit. The skyline is strongest.
- Alpha is themed and dimmed.

### 7.5 Flow lines
**Tracing,** in a worker, once per viewpoint (then cached):
- Seeds go on high ground. Probability rises with absolute height (3,800 → 7,200 m) and with relief above surroundings (120 → 650 m).
- Lines are traced downhill along the gradient in world space.
- Lines may bunch freely within 350 m below their start, then stop when within the spacing of another line.
- Spacing is defined in metres and scaled by distance to keep screen spacing even (screen spacing 1.1 px at the summits to 16 px low down, at the default zoom).
- Hidden stretches continue up to 30 steps.
- Per-vertex data: position, the line's start height `h0`, `rel0`, and arc-length fraction `u`.

**Rendering:**
1. Lines draw as thin anti-aliased quads into a half-float accumulation target with additive blending, depth-tested against the terrain depth texture plus a small bias.
2. Alpha combines:
   - summit factor: `peakK(h0, rel0)`;
   - descent fade: `down^1.6`;
   - taper: `smoothstep(0, .06, u) · smoothstep(0, .4, 1−u)`;
   - distance fade;
   - near-peak softening.
3. A composite pass compresses the sum with `1 − exp(−2.6·v)`, multiplies it by local light (0.5 + 0.5L), softens it with a small blur, and blends toward snow white.

The constants come from `docs/art/reference-flowlines-spike.js`, which produced the target image.

### 7.6 Rivers
- The smoothed polylines from v2.1 go through the same line pipeline:
  - one halo pass;
  - one core pass;
  - a sparkle pass animated with a time uniform.
- Depth testing against the terrain replaces v2's per-strip visibility check.

### 7.7 Camera and interaction
- **Drag to pan:** heading changes with momentum (v2 behaviour).
- **Zoom:** pinch or wheel, eased toward a target field of view.
- **Fly:** drag the fly control vertically. The eye height follows the finger with light easing, from 0 to 5,000 m. A double-tap returns to the ground.
- **Every change is a uniform update,** with no re-tracing. The mesh and lines are in world space, so parallax is exact.
- **The visibility slider** is a uniform: haze and the cut-off move live.

### 7.8 UI and game layer
- The DOM overlays from v2 stay: labels, quiz markers, info bar, telescope, settings card, mini-map, compass, ruler, grid drawer.
- They are restyled per §2.7.
- The telescope's terrain read-out reads depth with a 1×1 `readPixels` at the crosshair, only when the view settles.
- The fly-in and fly-out keep v2.1's eye-level landing. The ranges sweep in by animating the visibility uniform from 0 to its target, which replaces the 9-frame mask.

### 7.9 Fallback and errors
- Without WebGL2, or after a context loss that doesn't recover, the v2.4 renderer runs unchanged.
- If a tile fails to load, the existing failure card is shown.

## 8. Delivery in three stages (each pushed and playable)

1. **WebGL core.** Covers:
   - polar mesh, cylindrical projection;
   - Summit Noir shading without flow lines, outlines;
   - caching, drag-to-fly, live zoom and visibility;
   - all v2 game features ported, and the fallback.
2. **Art.** Covers:
   - flow lines (tracing, caching, accumulation, compression);
   - snow tone and mist;
   - the Ink & Mist light theme;
   - rivers in the line pipeline.
3. **Look and feel.** Covers fonts, copper, engraved-triangle icons, PeakFinder-format labels, and polish against the target images.

## 9. Testing

- Headless Chromium (software WebGL) on real Terrarium tiles checks correctness: screenshots per viewpoint and theme compared side by side with the `docs/art` targets, game-flow scripts, no console errors.
- Frame timing in headless runs is **not** meaningful, because the software rasteriser is slow. The owner checks smoothness on real devices through the live GitHub Pages link after each stage.

## 10. Settled during review

Items marked *(builder's call)* were decided by Claude; the owner can override them.

1. **Flow lines across view changes** *(builder's call)*:
   - Tracing covers **all terrain within the visibility range**, not only what is visible from the ground, so slopes revealed when flying up have lines.
   - Spacing is set in metres for a reference zoom, with **two density tiers**: a base tier and a fine tier. The fine tier fades in once zoomed past ~1.6× and fades out when zoomed out, so screen density stays close to the target at every zoom.
   - The 30-step hidden-stretch rule is dropped; world-space lines are depth-tested at draw time instead.
2. **Copper accent and warm-paper light theme:** explicitly chosen by the owner in the style-board rounds (copper over glacier blue, sage and no-accent; Ink & Mist over Engraving). CLAUDE.md and docs/CONTEXT.md are updated **in the same change**, so later sessions don't revert to pink or white paper.
3. **Settings card** *(builder's call)*: the contour toggle is replaced by a **Flow lines** toggle, remembered per theme (on in dark, off in light). Contours are retired in v3.
4. **Offline:** the owner asked for data to "download once so I can smoothly move across and explore each time we test". Instant revisits with cached terrain and lines (Cache API + IndexedDB) meet that. A cold start with no network is **not** required; that belongs to the later PWA step.
5. **First visit while lines trace** *(builder's call)*: the panorama appears immediately without lines. Lines fade in sector by sector, nearest the current heading first, as the worker finishes them. On revisits they load from IndexedDB.
6. **Caption in the targets** *(builder's call)*: shown as an arrival title, about 3 s after the fly-in, then fading to nothing. Its text is the large Cormorant name plus a mono line with height, section and heading. It is never permanent.
7. **v2.4 fallback** *(builder's call)*: shares the restyled CSS (fonts, copper, labels) because that comes free, but keeps its own rendering and 300 m fly steps. No second drag-to-fly path.

## 11. Left to the builder

- Exact grid resolution and the mesh-memory trade-off, especially for mobile.
- Shader constant fine-tuning against the targets.
- Line-quad width in pixels at device-pixel-ratio 3.
- Cache eviction policy (keeping everything is fine for five viewpoints).
- Code layout inside `index.html` (new `<script type="text/plain">` blocks for shaders and workers, matching the v2 pattern).
