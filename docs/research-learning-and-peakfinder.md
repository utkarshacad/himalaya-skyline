# How people learn mountains, and how PeakFinder works

Research notes from 13–14 November 2026.

## How mountain courses teach peak recognition

- **Indian institutes teach peaks from a viewpoint.** HMI Darjeeling's 28-day Basic Mountaineering Course has classroom sessions on "Himalayas" and map reading. The peak learning happens at base camp (Chowrikhang, about 14,600 ft), as **briefings on the surrounding peaks** while students look at them. NIM Uttarkashi lists map reading and navigation in its objectives.
- **Climbers match a view to a labelled panorama.** They use panorama drawings, apps like PeakFinder or PeakVisor, or tilt Google Earth to copy the view from a summit. People find a flat topo map alone hard, because it's difficult to picture which peaks hide behind others.
- **Navigation courses teach landforms and "handrails".** The UK Mountain Leader "Navigator's Dozen" includes:
  - contour interpretation
  - slope aspect
  - catching features
  - handrails: following a long linear feature such as a river or ridge
  - aiming off
  - attack points
- **Clubs give mountains a filing system.** Ranges are divided into numbered groups bounded by rivers and passes. See `research-himalaya.md`.
- **3D alone isn't enough to learn a layout.** In one study of 120 students (Frontiers in Psychology, 2020), walking with a 2D map beat exploring a 3D street-view version for building an overall picture. The game therefore pairs the panorama with a mini-map and a 2D home map.

### What this means for the game

| Way people learn | Game mode |
|---|---|
| Base-camp briefings and panorama matching | **Name the Skyline** (built in v1) |
| Range and section filing systems | **Fill the Grid** (planned) |
| Handrails | **Handrail**: follow a river through its gorge (planned) |
| Route finding over passes | **Ridge Route** (planned) |
| Map recall | **Pinpoint**: click where a peak is (planned) |

## PeakFinder

- **Who:** Fabio Soldati of Zurich, publishing as PeakFinder GmbH. The idea came in 2010, after a family argument on a Swiss hike over a mountain's name. He built the first version in Buenos Aires and started with the Alps before going worldwide.
- **Platforms:** native iOS and Android apps (which work offline), a web version at peakfinder.com, and a public JavaScript API.
- **Rendering:** he describes it as "the same technology as in computer games", meaning a real-time 3D engine over an elevation model.
  - The web version appears to run that engine through **WebAssembly**, since its API checks for WebAssembly SIMD and multithreading support.
  - The map panel uses **MapLibre-style** layers.
- **The signature look:** it doesn't drape photos or colours over the terrain. It computes the ridgelines visible from your exact spot and draws them as clean lines with labelled peaks.
- **Elevation data:** Viewfinder Panoramas (de Ferranti's gap-filled SRTM, the best source for the Himalaya), Copernicus GLO-30, NASADEM, national LiDAR, ArcticDEM and others. The early web version used about 90 m resolution for speed.
- **Peak names:** OpenStreetMap, GeoNames, Bivouac, Andean mountains 5000 and national club databases.
- **API:** you can embed the panorama on a page (iframe or canvas) and control it with code:
  - set a viewpoint
  - set azimuth, altitude and field of view
  - switch themes and projections
  - show sun and moon paths
  - a map panel with GeoJSON overlays and elevation colour bands
  The licence text couldn't be read.

### Why we built our own

The alternative was to embed PeakFinder's engine and put the game on top. We built our own instead, for three reasons:
- the licence is unknown, and a published game would need permission;
- the game would depend on their servers;
- we need full control to hide labels for quizzing and to add rivers and grid tints.

The core technique is well understood: ray-march sight lines across a DEM and draw the occlusion edges as lines.

## Sources

- [HMI Basic Mountaineering Course](https://hmidarjeeling.com/courses/basic-course/)
- [NIM Basic Mountaineering Course](https://www.nimindia.net/basic-mountaineering-course-bmc)
- [Identifying named peaks from a summit (Codidact)](https://outdoors.codidact.com/posts/44809)
- [The Navigator's Dozen (Ben Nevis MCofS)](https://www.ben-nevis.com/mcofs/navigation/navigators-dozen.php)
- [Spatial learning study (Frontiers in Psychology, 2020)](https://www.frontiersin.org/articles/10.3389/fpsyg.2020.01322/pdf)
- [About PeakFinder](https://www.peakfinder.com/about/peakfinder)
- [PeakFinder resources and data sources](https://peakfinder.com/about/resources)
- [PeakFinder API (GitHub)](https://github.com/Fabiz/PeakFinder-API) and [demo](https://fabiz.github.io/PeakFinder-API)
- [hikr.org review of PeakFinder web](https://hikr.org/post56413.html)
- [Swiss Spectator on PeakFinder](https://www.swiss-spectator.ch/peakfinder/)
