# Technical design

`index.html` is one file with no build step. MapLibre GL JS 5.24.0 loads from unpkg, falling back to jsDelivr. Everything else is inline.

## Data

- **Elevation:** AWS Terrain Tiles, Terrarium PNG encoding. Elevation = `R*256 + G + B/256 - 32768`. Tiles come from `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`, with a fallback host. CORS is open.
- **Peaks:** a hand-made list in `VIEWPOINTS` with approximate coordinates. At load time each peak is **snapped to the highest terrain cell within 1.6 km**, so its marker sits on the rendered summit. Published heights are shown; the snapped DEM height is used only for placing the marker.
- **Viewer:** snapped to the local high point within `snap` metres. `eyeAdd` metres are added for standing height.
- **Overview rivers:** Natural Earth 1:50m rivers, clipped to 72–97.5°E and 25.5–37.2°N, embedded as `NE_RIVERS` (about 14 KB).

## Loading a viewpoint

`buildLevels()` builds three mosaics around the viewer:

| Level | Zoom | Used for distances | Covers |
|---|---|---|---|
| 0 | z11 (~70 m) | < 12 km | 14 km |
| 1 | z10 (~140 m) | < 62 km | 66 km |
| 2 | z9 (~270 m) | < 235 km | 243 km |

- Corner tiles outside the circle are skipped. That's about 80–115 tiles, fetched 12 at a time.
- On the user's machine Kausani loaded **80 tiles in about 6 s**.
- The tile cache is cleared on each new viewpoint to cap memory.

## Panorama renderer (Web Worker)

The shared code lives in `<script id="shared-src">`. It's `eval`'d in the page and prepended to the worker source, which is created from a Blob.

- **Projection:** cylindrical. Column → azimuth, row → elevation angle, both linear in `ppr` (pixels per radian).
- **Per column:** march outward from 15 m to `maxD`, with step `max(minStep, d*k)` (`k` = 0.0042 at full quality, 0.009 while dragging).
  - Height drops with Earth curvature plus refraction: `d²·(1−0.13)/(2R)`.
  - **Front-to-back fill:** when a sample projects above the current top, fill down to the old top with a colour from distance haze, slope light and a little snow tint above 4,800 m, and record its **depth**.
  - When the newly visible terrain is much farther than the last (`d > lastD*1.1 + 250`), draw a **ridge line** at the old top. White, alpha fading with distance.
  - The skyline gets the strongest line.
- **Interaction:** a low-quality half-resolution render while dragging (about every 70 ms), then full quality when idle. The last frame is shifted and scaled instantly while the worker catches up.
- **Measured** on the user's machine, main-thread version: 1400×620 full quality in about **475 ms**, 700×480 in about 290 ms.

## Line of sight (which peaks become questions)

The worker `los` command marches each peak's ray. The peak is visible if no terrain rises above the sight line by more than 0.0006 rad.

## Rivers traced from terrain

The worker `rivers` command runs on the z10 mosaic within 48 km:
1. **Priority-flood** depression filling (binary heap, +0.01 m epsilon). The cell each cell was flooded from becomes its downstream (`parent`).
2. **Flow accumulation** in reverse pop order.
3. Cells with accumulation ≥ 450 (about 8 km² of catchment) become channel segments: `[lon, lat, elev, lon2, lat2, elev2, acc]`.

On Kausani this gave **10,739 segments in about 445 ms**. They sit exactly in the Garur and Gomati valleys on real terrain.

**In the panorama:** segments are projected and kept only if the depth buffer at their midpoint matches their distance (not hidden). Each frame draws them in river blue, with width by catchment size and distance, plus a slow travelling glint (`sin(t - phase(lon, lat))`). Named rivers are labelled at the visible segment nearest a hand-placed anchor point.

## Map home

- MapLibre style: dark background, a `color-relief` ramp, multidirectional hillshade, Natural Earth rivers, and detailed traced rivers for visited viewpoints (zoom ≥ 7).
- Terrain exaggeration 1.25. Sky and fog in PeakFinder night-blue.
- Fly-in: `flyTo` at zoom 12.6 and pitch 76, facing the main peak, run while the tiles stream.

## Persistence

Progress (solved peaks with points, and total score) is kept in `localStorage` under the key `himalaya-skyline`. Reads and writes are wrapped in try/catch.

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
