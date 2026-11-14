# Technical design

`index.html` is one file with no build step. MapLibre GL JS 5.24.0 loads from unpkg, falling back to jsDelivr. Everything else is inline.

## Data

- **Elevation:** AWS Terrain Tiles, Terrarium PNG encoding. Elevation = `R*256 + G + B/256 - 32768`. Tiles come from `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`, with a fallback host. CORS is open.
- **Peaks:** a hand-made list in `VIEWPOINTS` with approximate coordinates. At load time each peak is **snapped to the highest terrain cell within 1.6 km**, so its marker sits on the rendered summit. Published heights are shown; the snapped DEM height is used only for placing the marker.
- **Viewer:** snapped to the local high point within `snap` metres. `eyeAdd` metres are added for standing height.
- **Overview rivers:** Natural Earth 1:50m rivers, clipped to 72–97.5°E and 25.5–37.2°N, embedded as `NE_RIVERS` (about 14 KB).

## Loading a viewpoint

`buildLevels()` builds four mosaics around the viewer. Near the end of each level's range the height fades into the next level over the last 20 %, so level changes don't show as shading bands.

| Level | Zoom | Used for distances | Covers |
|---|---|---|---|
| 0 | z12 (~33 m) | < 7 km | 9 km |
| 1 | z11 (~70 m) | < 20 km | 23 km |
| 2 | z10 (~140 m) | < 72 km | 76 km |
| 3 | z9 (~270 m) | < 235 km | 243 km |

- Corner tiles outside the circle are skipped. Tiles are fetched 12 at a time; the cache is cleared on each new viewpoint.
- The levels are copied into a **pool of 1–4 workers** (`hardwareConcurrency − 1`). The main thread keeps no copy.

## Panorama renderer (v2, November 2026)

The goal is PeakFinder's feel: a monochrome line drawing, and panning with no lag.

### Render once, pan by sliding images
- The full 360° is cut into **vertical strips 256 render-pixels wide**. Each is rendered in a worker and kept as an `ImageBitmap` plus a `Uint16` depth buffer in decametres (65535 = sky).
- Strips are queued nearest-to-the-view first and spread round-robin over the workers. A worker renders one strip per macrotask, so `cancel` messages get through between strips.
- **Panning only draws finished strips** at new offsets (`drawGen`). No worker work happens while dragging.
- A **generation** (`newGen`) is one full set of strips for a given zoom, pitch window, eye height, visibility range, theme and contour setting. A new one is started when:
  - zoom changes by more than 1.3× or less than 0.62×;
  - the view leaves the pitch window, which is 1.7× the screen height;
  - the visibility, theme, contours or fly-up height change;
  - the window is resized.
- While a new generation fills in, the previous one stays on screen, scaled.
- Render scale is `min(2, devicePixelRatio)`, lowered until the full 360° is at most 18 M pixels.
- **Measured** in headless Chromium (software GL, 3 workers, 1330×640):
  - Pangarchulla: the view was sharp **0.7 s** after the terrain arrived, and the whole 360° took **0.9 s**.
  - A synthetic pan held **16.7 ms** per frame (60 fps), median and p95.

### How a column is drawn (`renderStrip`)
- March outward from 12 m with step `max(8 m, d·0.0042)`. Apply Earth curvature plus refraction, `d²·(1−0.13)/(2R)`.
- Fill front to back. Each newly visible stretch gets a flat tone that combines:
  - near → far colour;
  - slope light (facing the viewer = lighter in dark, white in light);
  - a little snow above 4,900 m;
  - haze toward the horizon colour as distance approaches the visibility limit.
- **Crest lines:** while the ray is hidden, track the lowest angle reached (`minHid`). When terrain becomes visible again, the crest it was hidden behind gets a line if `dip = angTop − minHid > 0.0006 rad` and `dip·d > 5 m`.
  - Line weight is `0.2 + drop/110`, multiplied by a distance fade.
  - The fade goes to zero between 55 % and 100 % of the visibility range.
  - This replaces v1's rule (`d > lastD·1.1 + 250`), which drew nothing in the first 2–3 km and left a flat foreground wedge.
- **Skyline:** the strongest line, fading only near the visibility limit.
- **Sun hillshade:** each newly visible sample also reads the terrain gradient (2 extra height samples, spaced at the current level's resolution). Slopes facing a north-west sun 40° up get lighter; slopes facing away get darker. The effect fades with distance.
- **Height contours (optional, v2.2):** the interval is **adaptive**: it doubles (50, 100, 200 … m) wherever lines would come closer than `contMinPx` pixels (8 in dark, 4.5 in light). Near slopes and far peaks get the same calm density, and the newest level fades in. Each line is **anti-aliased** across the two pixels it falls between. Contours fade over the last half of the visibility range.
- (v2.1 note) Contours are drawn in a per-pixel pass after the march. Each terrain pixel's height is rebuilt from its depth, as `eye + d·tan(alt) + d²·CURV`. A contour pixel is marked where its 50 m band differs from the pixel below or to the right on the same surface, with a bold line every 250 m, out to 24 km. Where contours would crowd into one pixel they fade out, so distant slopes stay clean.

### Themes
`THEMES.dark` follows PeakFinder's dark theme and `THEMES.light` its light theme (white ground, ink lines). Colours go to the worker as RGB arrays. CSS custom properties on `body[data-theme]` theme the labels, the telescope and the home map (`applyMapTheme`).

### Shading (v2.4): PeakFinder's curvature glow
PeakFinder's look is not sunlight: ridges and spurs glow, faces and gullies sink. Each visible sample reads 4 extra heights at 2.5× the level spacing and computes `conv = (4h − ΣN,E,S,W) / spacing`. Then `tanh(conv·curvK)·curv` pulls the tone toward `glow` on convex ground and toward `shadow` in concave ground. The sun hillshade remains as a weaker layer (`shade` .32 in dark). Ridge lines get a one-pixel halo above them (`halo`). The dark palette is charcoal (`bg #1f1f21`). Contours are a per-theme preference: off in dark, on in light.

### Fly-up (v2.4): WebGL depth warp
- A WebGL2 canvas sits above the panorama during a climb. The current picture (texture A) and its distance at a mesh vertex every 3 px (R32F texture) are drawn as a grid mesh.
- The vertex shader moves each point to `atan(d·tan(alt) − Δeye, d)`, so near ridges drop fast and far ranges barely move. That is true parallax at 60 fps from the first frame, with no wait. The depth test keeps nearer terrain in front.
- One worker renders a single real frame at the target height (B, about 0.9 s here in software). B is warped back the other way and cross-faded in from 30 % to 90 % of the climb, so ground revealed behind ridges ends up exact. If B is late, the clock waits only at the 35 % mark.
- At the end the canvas fades out over the full-quality strips. Without WebGL2 the older frame film (`flyStepFilm`) is used.
- Headless Chromium in the sandbox uses a software rasterizer, so frames there are slow. On a real GPU the warp itself costs well under a millisecond.

### Fly-up (v2.1, now the fallback)
- PeakFinder's "elevation offset". Steps are 0, +300, +800, +1,600, +3,000 and +5,000 m.
- On a step, the current picture is frozen as frame 0. Workers then render **20 frames at full screen resolution** (capped at 1,400 columns) at eased heights. v2.1 used 26 frames at 0.4×, which looked like the screen blurring between steps.
  - The frames are queued before the full-quality strips and at top priority.
  - The film starts when 4 frames are ready, about 0.25 s.
- The **film clock only advances while the next frame exists**, so a slow frame pauses the climb instead of jumping it.
- The frames cross-fade over about 2.4–3 s. The film ends with a 320 ms fade into the full-quality view.
- While playing, the home map is fully hidden (`#home.gone`). Compositing it behind the film, with a CSS filter running, made frames take about 600 ms each.
- Labels follow the animated eye height. Quiz visibility is still decided from the ground.

### Interaction
- Dragging is 1:1, and momentum decays with τ = 260 ms, independent of frame rate.
- Wheel and buttons ease the zoom toward a target (τ = 90 ms); pinch is direct.
- Arrow keys turn with eased animation; Shift + ↑/↓ flies up or down.
- A single `requestAnimationFrame` loop redraws only when something moved. It also draws the river glints.

### Chrome
- Round icon buttons in the corners:
  - map / back;
  - compass rose, which toggles the mini-map;
  - fly-up chevrons;
  - sliders (visibility 20–230 km, theme, peak names Quiz/All/Marked, contours);
  - zoom;
  - telescope.
- A thin degree ruler runs along the bottom.
- The bottom pill shows the viewpoint. The **info bar** replaces it for:
  - a tapped label;
  - a just-solved peak (with its fact);
  - telescope readings: terrain height and distance from the depth buffer, or "Unnamed peak · Name it".
- **Marks:** favourite (♥) and flag (⚑) per peak, saved in `SAVE.marks` and shown on labels and the mini-map.
- **Labels:** slanted −52°, "Name 7,120 m", on one band above the highest labelled summit, with thin leader lines. They are decluttered left to right, keeping the higher peak.

### Fly-in and fly-out (v2.1)
1. The map's `flyTo` (about 6.5 s, during terrain loading) ends above the viewpoint.
2. The panorama renders invisibly underneath, with `view.hfov` set to the map's horizontal FOV and pitch −2°.
3. `#home.grade` greys the map with a CSS filter. The map then eases to an **eye-level camera** built with `calculateCameraOptionsFromCameraLngLatAltRotation(viewpoint, eye altitude, heading, 90° + pitch, roll 0)`. Roll must be given: `undefined` crashes MapLibre 5.24.
4. **Sweep:** 9 alpha-masked copies of the current view are cut by depth (nearest ranges first, sky last) and cross-faded over the map for 2 s.
5. The map fades out and the camera tilts up to the starting pitch.

Leaving plays it in reverse: the map jumps to the same eye-level camera, already grey, the panorama dissolves into it, then the map regains colour and flies out. Terrain exaggeration is now 1.0, so the map and panorama heights match.

## Line of sight (which peaks become questions)

The worker `los` command (run on worker 0, from the ground eye height) marches each peak's ray. The peak is visible if no terrain rises above the sight line by more than 0.0006 rad.

## Rivers traced from terrain

(v2.1) Channel cells are chained into **downstream polylines**: walk from each channel head until meeting an already-walked river. Each line is smoothed twice with 1-2-1 weights and once with Chaikin, then drawn as quadratic curves. Drawing (v2.2) takes three passes: a soft wide halo at 13 % that melts the river into its valley, a thin core, and sparse sparkles that travel downstream. All three fade with distance, like the terrain. The old output, one segment per D8 cell, made sharp zigzags.


The worker `rivers` command runs on the z10 mosaic within 48 km:
1. **Priority-flood** depression filling (binary heap, +0.01 m epsilon). The cell each cell was flooded from becomes its downstream (`parent`).
2. **Flow accumulation** in reverse pop order.
3. Cells with accumulation ≥ 450 (about 8 km² of catchment) become channel segments: `[lon, lat, elev, lon2, lat2, elev2, acc]`.

On Kausani this gave **10,739 segments in about 445 ms**. They sit exactly in the Garur and Gomati valleys on real terrain.

**In the panorama:** segment angles are computed once per generation and bucketed by strip. As each strip arrives, its segments are tested against that strip's depth buffer and kept if not hidden. Each frame draws them in river blue, with width by catchment size and distance, plus a slow travelling glint (`sin(t - phase(lon, lat))`). Named rivers are labelled at the visible segment nearest a hand-placed anchor point.

## Map home

- MapLibre style: dark background, a `color-relief` ramp, multidirectional hillshade, Natural Earth rivers, and detailed traced rivers for visited viewpoints (zoom ≥ 7).
- Terrain exaggeration 1.25. Sky and fog in PeakFinder night-blue.
- Fly-in: `flyTo` at zoom 12.6 and pitch 76, facing the main peak, run while the tiles stream.

## Persistence

Progress (solved peaks with points, total score, and marks) is kept in `localStorage` under the key `himalaya-skyline`. Display preferences (theme, visibility, label mode, contours) are under `himalaya-skyline-prefs`. Reads and writes are wrapped in try/catch.

## Testing done

- **Headless Chrome with synthetic terrain** (puppeteer, tile requests intercepted): full flow tested (home → fly in → panorama → guess → reveal → fact card → drag) with no console errors.
- **Real terrain in the user's browser:**
  - Nanda Devi decodes at **7,798 m** at z11 (true 7,816 m).
  - The Kausani skyline correctly shows Trisul, Nanda Devi, Nanda Devi East, Nanda Kot and Panchachuli.
  - Traced rivers sit in the valleys.
- **Viewpoint snaps checked on z12 terrain:**

| Viewpoint | Raw | Snap | Result |
|---|---|---|---|
| Gulmarg | 3,853 m | 300 m | 3,994 m (Apharwat gondola top ≈ 3,980) |
| Kala Patthar | 5,608 m | 300 m | 5,659 m (true 5,644) |
| Pangarchulla | 4,549 m | any | about 4,558 m (true 4,575–4,590) |
| Tiger Hill | 2,474 m | 300 m | 2,554 m (true 2,567) |
| Kausani | 1,703 m | 900 m | 1,878 m (ridge ≈ 1,890) |

- **Not yet tested:** the complete game end to end on real terrain.

## Known limitations

- Some peak coordinates are approximate. Snapping can land on a neighbouring summit, especially for Ghori Parbat, Pandim, Nanda Ghunti and Amarnath Peak. Verify against OSM or PeakVisor.
- Far peaks use z9 terrain (about 270 m), which rounds summits down by up to a couple of hundred metres. Positions are still right.
- The game needs internet. It can't run as a claude.ai artifact, because the CSP blocks outside tile servers.
- The theme follows PeakFinder from memory and screenshots and needs tuning.
