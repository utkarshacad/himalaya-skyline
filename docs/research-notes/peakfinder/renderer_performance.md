# PeakFinder-style Renderer Performance and Architecture (research notes, compiled 2026-11-14)

Network note: from this research session, peakfinder.com, peakfinder.org, en.wikipedia.org, oikofuge.com and megalithic.co.uk did not resolve (blocked by the sandbox network allowlist). Only github.com and search-engine snippets were reachable. So most PeakFinder-internal claims below come from search snippets of secondary sources and are marked as such. Anything not backed by a source is under Inferences (engineering judgement) or Gaps.

## 1. PeakFinder's engine, data format and fast loading

### Takeaway
I could not find a primary source (blog, talk, interview) describing PeakFinder's engine internals, such as C++/OpenGL vs WASM, threading or SIMD. The confirmed public facts: it renders the landscape in real time out to about 300 km, works fully offline from pre-downloaded regional terrain data (NASADEM/SRTM plus European LiDAR), and moved to a "new data model" that needs less data and auto-loads about a 150 km radius around the user. Its speed most plausibly comes from a compact precomputed custom terrain package rendered natively, not from streaming photoreal globe tiles the way Google Earth does.

### Cited Findings
- PeakFinder combines terrain data from multiple sources, including NASADEM, SRTM and European LiDAR datasets. It can be used offline after downloading data for a selected region in advance. Since 2022 it has offered a public web API that lets third-party websites generate mountain panoramas. The idea dates to a 2010 hiking trip in Switzerland. (Search snippet of Wikipedia; page not fetchable) — [Wikipedia: PeakFinder](https://en.wikipedia.org/wiki/PeakFinder)
- App-store-derived text: "realtime rendering of the surrounding landscapes in a range of 300km/200mil", plus a "digital telescope" for selecting less prominent peaks — [AppGrooves listing](https://appgrooves.com/app/peakfinder-ar-by-fabio-soldati)
- "PeakFinder has been upgraded with a new data model… less data is required… when updating, PeakFinder loads the data within a radius of 150km/100mil around your current location. Other areas can be loaded through the 'Offline mode' menu." (Unofficial APK mirror quoting release notes, v4.8.x era; treat as secondary) — [apk4free](https://apk4free.net/peakfinder-ar/)
- The developer, Fabio Soldati, is a Swiss computer scientist (ZHAW). The software works nearly worldwide, completely offline, and is based on digital terrain models plus an extensive summit directory — [Ursus Major archaeoastronomy PDF](https://www.ursusmajor.ch/downloads/peakfinderprogram-for-archaeoastronomy-2.1.pdf)
- App package sizes listed by third parties conflict (42.5 MB, 65.8 MB, 71 MB, 130 MB). These are app binaries, not terrain packages. No source gave per-region terrain package sizes — [mwm.ai](https://mwm.ai/apps/peakfinder/357421934), [game-unlimit](https://game-unlimit.com/en/peakfinder-mod-apk/)
- The web version (peakfinder.org/.com) is free and the mobile app is paid — [alti-mag](https://www.alti-mag.com/en/outdoor-activities/best-apps-identify-mountain-peaks)
- The web version lets you "fly to" any location and see contours generated from the DEM — [hikerapps blog](https://hikerapps.com/blog/peakfinder)
- A 2021 forum post said the web version "has changed… just like their mobile app now". This suggests the web build was unified with the mobile engine around 2021, but the snippet does not name the technology — [Megalithic Portal forum (snippet)](https://www.megalithic.co.uk/modules.php?op=modload&name=Forum&file=viewtopic&topic=8620&forum=1)

### Inferences
- The 2021 unification of web and mobile looks, combined with one-developer economics, is consistent with a single C++ core compiled to native (iOS/Android) and to WebAssembly + WebGL via Emscripten for the web. This is unconfirmed. It is the standard pattern for C++/OpenGL engines ([Webots WASM port write-up](https://medium.com/cyberbotics/porting-a-c-rendering-engine-to-webassembly-9c32d76c31f1)). Verify by opening peakfinder.com in a browser and checking for .wasm requests.
- Why it loads faster than Google Earth: it ships only a heightfield (no imagery, no 3D buildings), at modest resolution far away, in a custom compact binary for one region. It renders flat-shaded or line-drawn geometry with almost no textures. The "150 km radius" auto-load means the working set is bounded and known in advance.
- A plausible data budget for our re-implementation: 300 km radius ≈ 280,000 km². At about 90 m (SRTM3) near and coarser far away, a ring scheme fits in a few MB of quantized int16 heights, which is fast to fetch and decode.

### Gaps
- No primary statement on PeakFinder's language, graphics API, WASM use, threading or SIMD.
- No published PeakFinder data format, per-distance resolution, tile scheme or package sizes. The official site and blog were unreachable from this session.

## 2. Ridgeline/silhouette line generation on GPU

### Takeaway
There are two families: (a) image-space edge detection on a depth (and normal) buffer in a full-screen post pass, and (b) analytic or CPU horizon sweeps that track the running maximum elevation angle along each azimuth and mark "crests" where the terrain behind drops away. For a PeakFinder look in WebGL2, render terrain to a framebuffer with a linear-depth texture, then run a full-screen pass that flags depth discontinuities using a relative (log or ratio) threshold and fades line alpha with distance.

### Cited Findings
- Screen-space outline passes compare nearby depth and normal values to reveal silhouettes and hard surface transitions, in a single full-screen pass (luma.gl shader pass, WebGPU-era docs) — [luma.gl outlines](https://luma.gl/docs/api-reference/shadertools/shader-passes/outlines)
- Alan Zucconi's terrain tutorial (Unity) draws terrain contours with an edge detection algorithm applied after geometry rendering, on the camera image — [Alan Zucconi](https://www.alanzucconi.com/?p=9507)
- Sobel on depth is a common kernel — [Godot depth Sobel shader](https://godotshaders.com/shader/depth-based-edge-detection-with-sobel-operator-screenspace/). Running Sobel on depth, normal and color together catches creases that depth alone misses — [bevy_mod_edge_detection](https://github.com/TotalKrill/bevy_mod_edge_detection)
- Pitfall: in perspective, flat ground stretching to the horizon is falsely detected as an edge because depth changes quickly with distance. Mitigate with linearized depth or relative thresholds — [Godot depth edge notes](https://godotshaders.com/shader/depth-based-edge-detection-with-sobel-operator-screenspace/)
- A WebGL2 screen-space outline shader example — [gamedev.net shaderlab](https://gamedev.net/shaderlab/40-screen-space-outline/)
- Geometry-based alternative: silhouettes lie where front-facing and back-facing triangles meet, which needs adjacency data. The Little Grasshopper blog also covers terrain-specific silhouette tricks — [prideout.net](https://prideout.net/blog/old/blog/index.html@p=54.html). Classic hardware edge features: [McGuire & Hughes 2004, "Hardware-Determined Feature Edges"](https://cs.brown.edu/~jhughes/papers/McGuire-HDE-2004/paper.pdf)
- CPU/Worker sweep variant (browser PeakFinder clone, 2026, TypeScript/Vite, Canvas 2D):
  - Sweeps azimuth in 0.25° steps out to 100–200 km. Step size is about 15 m + 0.4 % of distance, starting at 60 m.
  - Applies curvature and refraction drop (R = 6371 km, k = 0.13). The skyline is the running max elevation angle.
  - Intermediate ridges are drawn lighter and fade with distance (6 brightness steps). A crest is a point where the ground behind drops ≥ 0.05° below it.
  - Crests are linked between neighbouring rays if they fall within 8 % + 150 m in distance and 0.6° in angle.
  - Viewer height is ground plus 2 m.
  - [nightskyfinder-app/peakfinder PLAN.md](https://github.com/nightskyfinder-app/peakfinder/blob/main/PLAN.md)
- panoramix (2017, Qt/OpenGL desktop) reads back the OpenGL depth buffer to decide which peak labels are visible — [gendx/panoramix](https://github.com/gendx/panoramix)

### Inferences
- Recommended shader:
  - Write `log(distance)` (or view-space distance) into an R32F/R16F colour attachment.
  - In the post pass, line = `abs(d_center - d_neighbor)/d_center > threshold` across 4 to 8 neighbours. Using a ratio rather than an absolute difference removes the false-horizon problem.
  - Line darkness = `smoothstep` on the jump magnitude × distance fade (`exp(-d/D)` or a mix toward a haze colour).
  - Upper sky/terrain boundary = the skyline, drawn thicker.
- Peak visibility test: sample the depth texture at the peak's projected pixel and compare with the peak's true distance, as panoramix does, or do a `readPixels`-free check via the GPU. Alternatively, ray-march the heightfield in a Worker once per observer position.
- Hybrid approach that keeps 60 fps: compute the skyline/crest polyline once per observer position in a Worker (sweep), then render pans and zooms as pure GPU transforms of cached geometry. Only an altitude or position change triggers a recompute.

### Gaps
- No published description of PeakFinder's actual line algorithm.
- No SIGGRAPH/Eurographics paper found that is specific to "panorama line drawing" of terrain, beyond the general NPR edge literature above.

## 3. Comparable products and open-source code

### Takeaway
Open-source references exist mainly on GitHub:
- horizonator (C/OpenGL, SRTM, equirectangular)
- panoramix (Qt/OpenGL, Mapbox contour tiles to Delaunay)
- nightskyfinder-app/peakfinder (2026 TS/Vite web app, Terrarium tiles, Worker sweep, Canvas 2D line drawing; the closest to a single-page browser PeakFinder clone)

I found no technical write-ups for PeakVisor, PeakLens, HeyWhatsThat or Udeuschle.

### Cited Findings
- **horizonator** (© 2012–2021, dkogan):
  - Equirectangular render (x = azimuth, y = elevation, same angular resolution on both axes), locally flat tangent-plane approximation, colour encodes distance.
  - Uses GLSL vertex, geometry and fragment shaders. Data is SRTM3 `.hgt` files loaded once around the viewer.
  - Renders every triangle, even distant tiny ones. A coarser far mesh is on the roadmap. SRTM1 gives about 9× more triangles.
  - [github.com/dkogan/horizonator](https://github.com/dkogan/horizonator)
- **panoramix** (© 2017): converts Mapbox vector contour lines to points, then builds a 2D Delaunay mesh. Has a small HTTPS tile cache and no render LOD; labels are drawn via QPainter after a depth readback — [github.com/gendx/panoramix](https://github.com/gendx/panoramix)
- **nightskyfinder-app/peakfinder** (2026):
  - Elevation from free AWS Terrarium PNG tiles, peaks from OSM Overpass `natural=peak`.
  - Distance-banded zoom: z12 ≤ 5 km, z11 ≤ 25 km, z10 ≤ 100 km, z9 ≤ 200 km. That is about 96 tiles for 100 km and 168 for 200 km.
  - Tile cache lives in Worker memory.
  - [PLAN.md](https://github.com/nightskyfinder-app/peakfinder/blob/main/PLAN.md), [repo](https://github.com/nightskyfinder-app/peakfinder)
- Pannellum is a WebGL panorama viewer whose projection is implemented in a fragment shader. It is useful as a viewer model but has no terrain — [mpetroff/pannellum](https://github.com/mpetroff/pannellum)

### Inferences
- The Terrarium tile source plus distance zoom bands is directly reusable for a Himalaya build. You could also pre-bake a single regional heightmap into the game file or a sidecar binary to avoid runtime tile fetches.

### Gaps
- PeakVisor, PeakLens, HeyWhatsThat, Udeuschle and CalTopo: no technical sources found. Searches returned unrelated results and their sites were not fetchable.

## 4. Performance techniques (LOD, rings, render-on-demand)

### Takeaway
For terrain LOD in WebGL2, the standard options are:
- CDLOD: a quadtree of a single reusable grid patch with vertex morphing and heights from a texture.
- Geometry clipmaps: nested rings.
- RTIN/Delatin meshes (Martini) built from heightmap tiles in milliseconds.

Combine these with distance-banded data resolution, a Worker for decoding and meshing, and render-on-demand.

### Cited Findings
- CDLOD (Strugar, 2010): a quadtree of regular grids, sourced directly from the heightmap like clipmaps. Uses a uniform LOD function based on precise 3D observer distance and smooth LOD transitions with no stitching. Gives more predictable screen-triangle distribution than nested clipmap grids and needs Shader Model 3.0 — [github.com/fstrugar/CDLOD](https://github.com/fstrugar/CDLOD)
- MARTINI (Mapbox): real-time RTIN mesh hierarchy from a (2^k+1)² grid, generated "in milliseconds". Takes a max-error parameter (e.g. 10 m). Based on Evans et al. 1997 — [github.com/mapbox/martini](https://github.com/mapbox/martini), [Observable demo](https://observablehq.com/@mourner/martin-real-time-rtin-terrain-mesh)
- Lack of far LOD is called out as horizonator's main cost: it renders every triangle, including distant ones — [horizonator](https://github.com/dkogan/horizonator)
- The browser clone keeps heavy terrain math in a Web Worker so the UI stays responsive, and uses coarser steps and tiles with distance — [PLAN.md](https://github.com/nightskyfinder-app/peakfinder/blob/main/PLAN.md)

### Inferences
- **Concrete plan for a single-file WebGL2 game:**
  1. Bake heights into one R16/R32F texture per ring (for example 5 rings, each double the extent at the same texel count, i.e. a clipmap-style ring set).
  2. Draw one shared grid mesh per ring, displaced in the vertex shader with `texture()`, using CDLOD-style morphing to hide seams.
  3. Apply earth curvature in the vertex shader: `z -= d²/(2R)·(1-k)`.
  4. Render only when the camera or observer changes (dirty flag + requestAnimationFrame). During pans only the view matrix changes, so cost is just the GPU draw.
  5. Decode PNG/Terrarium or quantized data in a Worker (`createImageBitmap` + OffscreenCanvas or manual decode) and transfer the ArrayBuffers.
  6. Progressive refinement: show the coarse far ring first, then stream finer near rings, and cache them in IndexedDB.
- Avoid CPU ray marching per frame. Keep per-frame work to the vertex shader plus one post-process line pass.

### Gaps
- No sourced benchmarks for CDLOD, clipmaps or Martini in WebGL on mobile.

## 5. Cinematic camera (inertia, fly-up, easing)

### Takeaway
I found no sourced material specific to PeakFinder's camera behaviour within the tool budget. The recommendations below are general practice, not citations.

### Cited Findings
- None from the sources fetched in this session.

### Inferences
- **Pan inertia:** keep angular velocity `ω`. On release, decay it each frame with `ω *= exp(-dt/τ)`, with τ ≈ 0.3–0.6 s, and stop below a small threshold. Use frame-rate-independent damping: `x += (target-x)*(1-exp(-dt*k))`.
- **Fly-up (raise observer altitude):** tween altitude with ease-in-out-cubic or quintic over 1.5–3 s, and tilt pitch slightly downward as altitude grows. Recompute the skyline only at the end, or progressively at a few altitude keyframes, crossfading the line layer.
- **Fly-over paths:** Catmull-Rom or centripetal spline through waypoints, parameterised by arc length so speed stays constant. Use a look-at target on a separate, lagged spline, and modulate FOV slightly (narrower at reveal moments).
- MapLibre's `flyTo` (van Wijk & Nuij zoom-pan path) is a known reference for smooth zoom-out/zoom-in transitions.

### Gaps
- No primary sources gathered on PeakFinder's camera behaviour or published easing parameters.
