# PeakFinder: Visual Design, UI and User-Facing Features (panorama view focus)

Research date: 2026-11-14. **Method caveat:** in this session only github.com / raw.githubusercontent.com could be fetched. peakfinder.com, peakfinder.org, apps.apple.com, play.google.com, wikipedia, oikofuge.com, johnnyjet.com, news.ycombinator.com and ipa4fun.com were unreachable (DNS blocked by the sandbox). Facts below come from (a) the official PeakFinder JS API README on Fabio Soldati's GitHub (Fabiz/PeakFinder-API, "Version 1.0"), downloaded in full, which is the strongest primary source here; and (b) search-engine summaries of store pages, the peakfinder.com mobile/about pages and reviews, which are less reliable and are marked as such. Items marked **[unverified recollection]** come from prior general knowledge of the app, not from a source fetched today. Treat them as hypotheses to check against screenshots.

## 1. Rendering style (terrain drawing, distance cues, sky, night, sun/moon)

### Takeaway
PeakFinder draws a stylised line drawing of the terrain from a DEM: silhouette and ridge lines over a flat fill, with a plain sky. The official API says "normally the sky is white" (light theme) and offers a dark theme, so the default look is dark ink on white, not white lines on black. Distance is conveyed by a visibility-range fade. Sun and moon "ecliptics" (orbit paths across the sky) are drawn as optional overlays.

### Cited Findings
- The PanoramaPanel option `bgcolor` is described as "A custom color for the background/sky. Normally the sky is white. For another color use the format '#rrggbb' (e.g. #87CEEB for sky color)." — [Fabiz/PeakFinder-API README](https://github.com/Fabiz/PeakFinder-API)
- `theme`: "'dark' for dark-theme, otherwise 'light' theme will be shown". `settings.theme()` is 0 for light and 1 for dark, on both the panorama and map panels. — [PeakFinder-API README](https://github.com/Fabiz/PeakFinder-API)
- `settings.projection()` is 0 for perspective and 1 for cylindrical, so a flattened cylindrical 360° projection is offered as well as a normal perspective view. — [PeakFinder-API README](https://github.com/Fabiz/PeakFinder-API)
- `settings.showGrid()` shows or hides a "coordinate grid" (azimuth/altitude grid overlay). — [PeakFinder-API README](https://github.com/Fabiz/PeakFinder-API)
- `settings.showSun()` / `showMoon()` get or set "display of the sun ecliptic" / "moon ecliptic". Astro calls return rise/set times and moon illumination (e.g. `{"moon":{"illum":"74.7%"}...}`). The older string format was '↑05:54, ↓21:17' and, for the moon, '↑07:13, ↓22:33, 3.4%'. These strings hint at the compact rise/set readout style used in the UI. — [PeakFinder-API README](https://github.com/Fabiz/PeakFinder-API)
- The app is described as giving "realtime rendering of the surrounding landscapes in a range of 300km/200mil". The API caps visibility at 320 km. — search summaries of [App Store listing](https://apps.apple.com/us/app/peakfinder/id357421934) / [peakfinder.com/mobile](https://www.peakfinder.com/mobile/); [API README](https://github.com/Fabiz/PeakFinder-API)
- PeakFinder's own About page (via search snippet): "Today PeakFinder uses the same technology as in computer games. With this, you can virtually fly through the mountain landscapes." — [PeakFinder About](https://www.peakfinder.com/about/peakfinder/)
- A reviewer describes the output as a "hand-drawn-style panoramic sketch" with every visible summit labelled. Another calls the on-phone rendering "beautifully clear". — search summaries of [reviewed.app](https://reviewed.app/app/peakfinder/) and [The Oikofuge](https://oikofuge.com/peakfinder/)
- A user review (via search summary) praises "the visibility distance setting, which realistically 'fades' the mountains out from the limit of your visibility." — App Store reviews, via [search summary](https://apps.apple.com/au/app/peakfinder/id357421934)
- Camera mode is described as an "overlay [of] the image of your camera with the panorama drawing". — [peakfinder.com/mobile](https://www.peakfinder.com/mobile/) (search snippet)
- Recent changelog (via search summary): a "new elevation model" with "more terrain details while the data size stays the same". 4.8.67 (Apr 2026) added photo-editor controls to fine-tune the mountain silhouette overlay. 4.8.73 (May 2026) added an option to show distance above summit labels. — [ipa4fun version history](https://www.ipa4fun.com/history/180953/), [Play listing](https://play.google.com/store/apps/details?id=org.peakfinder.area.alps) (snippets only)
- The API utilities `hasMultiThreadingSupport()` and `hasSimdSupport()` suggest the web renderer is a compiled WebAssembly/WebGL engine with optional threads and SIMD. This is an inference from the API names; the stack is not stated. — [PeakFinder-API README](https://github.com/Fabiz/PeakFinder-API)
- An independent open-source reimplementation (Akylas/alpimaps PR #149) has a commit titled "draw peakfinder.com's look, with a hillshade that follows the sun". It uses a "flat white surface, pure black ink" palette, silhouettes from an inverse-depth Laplacian (near side), the skyline as "a heavier stroke than an interior fold", ridge ink from DEM curvature, a hillshade whose sun azimuth decides which slopes shade, and a far-distance ink floor so "the far ranges lighten". This is a **third party's interpretation**, not PeakFinder's code. — [alpimaps PR #149](https://github.com/Akylas/alpimaps/pull/149)
- An unofficial APK mirror claims there is a "technical drawing" mode for stylised silhouettes plus a more realistic mode. This is unverified and low reliability. — [modyolo.com](https://modyolo.com/peakfinder.html)

### Inferences
- Default look to reproduce: near-white sky and land, with black or dark-grey ink lines. The skyline is the heaviest stroke. Interior ridge and fold lines are thinner. Nearer ranges are darker and crisper, and farther ranges lighten toward the visibility limit, which acts like aerial perspective drawn in ink. Possibly a subtle sun-dependent hillshade. Dark theme inverts this to light ink on a dark background.
- Sun and moon appear as thin arc paths across the sky with positions marked for the chosen date and time, and rise/set times shown compactly.

### Gaps
- Exact line weights, the brightness falloff curve and the dark-theme colours could not be verified because screenshots and official help pages were unreachable.
- **[unverified recollection]** The app has a dark/night appearance, and the in-app panorama is light grey with dark lines by default.

## 2. Labels, leader lines, decluttering, selected-peak info, crosshair/telescope

### Takeaway
Peaks are labelled with name and elevation, and newer versions can also show distance. Tapping a label opens a POI info sheet. A "telescope" (virtual binoculars) reticle selects hard-to-see peaks and reports azimuth, altitude, distance and elevation. A "minimal elevation" slider hides names of lower peaks, which is a declutter control.

### Cited Findings
- `settings.minimalElevation()` is the "minimal elevation for the displayed peak names", range 0–10000 m. It sits in the sliders panel alongside date, time and visibility range. — [PeakFinder-API README](https://github.com/Fabiz/PeakFinder-API)
- The `'poiinfo show'` event fires when the "user has clicked to a peak name or uses the telescope". The `disableinfosheets` option "disables showing the poi infosheet or the viewpoint infosheet when the users click on a peak label or the viewpoint". So both peak labels and the viewpoint have info sheets. — [PeakFinder-API README](https://github.com/Fabiz/PeakFinder-API)
- The telescope object has `show()`, `hide()`, `centerAzimut()`, `centerAltitude()`, `centerDistance()` and `centerElevation()`. The URL params `teleazi`/`telealt` place it. — [PeakFinder-API README](https://github.com/Fabiz/PeakFinder-API)
- The store text mentions a "digital telescope for selecting less visible peaks" and a "'Show me'-function for visible peaks". — search summaries of [apkcombo mirror of the listing](https://apkcombo.com/peakfinder/org.peakfinder.area.alps/)
- When centred on a peak, the binoculars/telescope show "name, elevation and distance". — search summary (source page not identified precisely)
- "Touching a mountain name brings up additional information about this peak." — [peakfinder.com/mobile](https://www.peakfinder.com/mobile) (snippet)
- 4.8.73 (May 2026) added an option to show distance above summit labels in addition to elevation. — [ipa4fun history](https://www.ipa4fun.com/history/180953/) (snippet)
- A Hacker News user noted PeakFinder "got better/shorter peak labels" (circa 2019–2020). — [HN thread](https://news.ycombinator.com/item?id=22008435) (snippet)
- In the third-party reimplementation, label layout modes are "top/band/skyline", and the band follows "peakfinder.com's row behaviour". The band "becomes the highest the row may go rather than where it sits". Long names can optionally wrap. — [alpimaps PR #149](https://github.com/Akylas/alpimaps/pull/149)

### Inferences
- Label scheme: names sit in a row or band above the skyline, with thin leader lines down to the summit point. Labels cull or declutter by minimum elevation and by overlap. The text style is compact (name plus height), with optional distance.
- The telescope is a centre reticle (circle or crosshair) with a live readout of the target's azimuth, altitude, distance and elevation.

### Gaps
- **[unverified recollection]** Labels are drawn rotated or slanted (steep diagonal text) with a leader line. I could not confirm the angle or the exact overlap/declutter rules.
- The behaviour of labels during pan and zoom (fade or reflow) is undocumented in the sources I could reach.

## 3. Sliders panel (compass correction, visibility range, date/time, min elevation)

### Takeaway
A slider button at the bottom left opens sliders for compass correction, visibility range, date/time (sun and moon) and minimum label elevation. Visibility range is a maximum render distance from 0 to 320 km. Users describe it as fading out mountains beyond the limit, and it thereby reduces both the terrain drawn and the peaks labelled.

### Cited Findings
- The panorama view is described as follows: "On the bottom left you'll find a button with sliders. With these sliders you may correct the compass direction, set the visibility range, and change date/time of the solar and lunar orbit." — [peakfinder.com/mobile](https://www.peakfinder.com/mobile) (search snippet)
- `showSliders()`: "visibility of the slider button in the lower left corner. Hiding it also closes the sliders it opens (date, time, visibility range, minimal elevation)." — [PeakFinder-API README](https://github.com/Fabiz/PeakFinder-API)
- `visibilityRange()` is set in metres, "valid range: 0..320000 (320km, 200mil)". — [PeakFinder-API README](https://github.com/Fabiz/PeakFinder-API)
- For manual compass alignment you tap the bottom of the screen and move the slider left or right. To set the date you tap the slider button and then the calendar/clock button. — search summaries of help and review pages
- A review describes the visibility setting as one that "realistically 'fades' the mountains out". — App Store review (snippet)

### Inferences
- Visibility range is primarily the far clip distance with a fade near the limit. Peaks beyond it would not be labelled. Whether it also changes the number of ridge layers is not documented, but a shorter range necessarily removes the farther layers.

### Gaps
- No source states whether labels beyond the range are hidden or merely dimmed, nor the fade curve.

## 4. Marks (favourites, flags, home, filter)

### Takeaway
"Marks" let users tag peaks and places. The official page names favourite mountains, visited mountains and mountains to climb, plus Home. Marks sync with an account. I could not verify specific icon shapes or a "filter by marks" UI.

### Cited Findings
- From PeakFinder's app page: users can mark mountains and places they like, such as favourites, mountains already visited or mountains they want to climb. Home can also be marked, to see whether it is visible from a summit. With an account, marks sync across devices and the website; without one they stay on the device. — [peakfinder.com/mobile](https://www.peakfinder.com/mobile/) (search summary; the page may be old)
- The same page snippet references a "telescope for marks". — [peakfinder.com/mobile](https://www.peakfinder.com/mobile) (snippet)
- PeakOrama, a third-party app built on the PeakFinder API, says setting marks is not supported there, which implies marks are app-only and not exposed in the public API. — search summary of [alternativeto PeakOrama](https://www.alternativeto.net/software/peakorama/about/)

### Gaps
- The exact icon set (flag / heart / star / bookmark / home), the "filter by marks" control, and how marked peaks are highlighted in the panorama could not be confirmed.

## 5. Camera: pan/zoom, elevation offset ("raise viewpoint"), fly journeys, camera AR

### Takeaway
The view is controlled by azimuth, altitude (pitch, ±25°) and FOV (8–90°), all animatable. An "elevation offset control" on the left raises the virtual eye above the ground and can be animated smoothly, for example up 1000 m and back. Changing viewpoint triggers a "journey" animation that walks, flies or teleports depending on distance. A bird icon lets users "fly" on a mountain. Camera mode overlays the drawing on the live camera image.

### Cited Findings
- `azimut(val, animationduration)`, `altitude(val, animationduration)` and `fieldofview(val, animationduration)` each get or set the view, with an optional animation duration in seconds. With no duration there is no animation. The demo animates to azimuth 209° over 2 s, altitude 1° over 1 s and FOV 45° over 2 s after loading Finsteraarhorn. — [PeakFinder-API README](https://github.com/Fabiz/PeakFinder-API)
- URL parameters: `azi` 0–360, `alt` -25 to 25, `fov` 8–90, `ele`, `off` (elevation offset), and `date` (ISO 8601) for sun and moon. The same parameters work with the `peakfinder://` app deep link. — [PeakFinder-API README](https://github.com/Fabiz/PeakFinder-API)
- `elevationOffset(val, animationduration)` is set in metres. The example `basicexample_canvas_elevationoffset.html` runs `await panel.elevationOffset(1000, 5.0)` and then `await panel.elevationOffset(0, 5.0)`, a 5-second rise and descent. `showElevationOffsetControl()` toggles "the elevation offset control on the left hand side". — [README](https://github.com/Fabiz/PeakFinder-API); [example file](https://github.com/Fabiz/PeakFinder-API/blob/main/basicexample_canvas_elevationoffset.html)
- `loadViewpoint(..., {animation})`: "'fly' (the default) uses the PeakFinder journey animation - it walks, flies or teleports depending on the distance to the current viewpoint. 'teleport' skips the animation." The 'viewpointjourney finished' event fires once "all data for a new viewpoint has been loaded". — [PeakFinder-API README](https://github.com/Fabiz/PeakFinder-API)
- `showZoomButtons()` toggles "+/- zoom buttons in the upper left corner". — [PeakFinder-API README](https://github.com/Fabiz/PeakFinder-API)
- From the app page: "If you then press on the bird, you can 'fly' on this mountain." — [peakfinder.com/mobile](https://www.peakfinder.com/mobile/) (snippet)
- An older third-party guide mentions a toolbar icon that opens a window to "adjust the height of the viewpoint above ground". — [Global Creations "Name That Peak!"](https://explore.globalcreations.com/theblog/featured/name-that-peak/) (snippet; old)
- The map panel (2D/3D map with `pitch`, `bearing`, and `flyTo`/`easeTo` with durations) has styles 'toner' (default), 'bright', 'monochrome-light', 'toner-flatwood' and 'relief', plus an elevation band overlay that colours terrain below or above limits (default colours rgba(42,198,255,0.63) / rgba(255,42,98,0.63)). — [PeakFinder-API README](https://github.com/Fabiz/PeakFinder-API)

### Inferences
- For a game: model the camera as (azimuth, pitch clamped ±25°, FOV 8–90°), with eased tweens on every parameter. Add a vertical "raise eye" control on the left edge that tweens height in metres. A viewpoint change uses a distance-dependent transition: a short walk for nearby points, an arcing flight for medium distances, and a cut or teleport for far ones.

### Gaps
- Drag inertia and pinch-zoom feel are not documented. **[unverified recollection]** Panning is smooth with momentum and pinch changes FOV.

## 6. Web version vs app; web API

### Takeaway
peakfinder.com runs the same panorama engine in the browser. It is embeddable via URL, iframe (`/embed/`) or a canvas JS API (`peakfinder.1.0.min.js`), with panorama and map panels. The app adds sensor-driven camera AR, offline data, photo snapshots and editing, and marks.

### Cited Findings
- There are three embedding methods (URL, iframe, canvas JS) and two panel types (PanoramaPanel and MapPanel). Ten UI locales are supported: en, de, fr, it, es, pt, ja, ko, zh-Hans and zh-Hant. — [PeakFinder-API README](https://github.com/Fabiz/PeakFinder-API)
- The web version lets you "fly to" any location rather than relying on GPS. — search summary of [alti-mag](https://www.alti-mag.com/en/outdoor-activities/best-apps-identify-mountain-peaks)
- A public web API has been available since 2022 (per Wikipedia via search summary). — [Wikipedia: PeakFinder](https://en.wikipedia.org/wiki/PeakFinder)
- The app works fully offline worldwide and lists 650k peaks (older text) or more than 1,000,000 peaks (newer). It uses compass and motion sensors. Snapshots can be edited and exported with names. — store listing via search summaries; [CA State Parks blog](https://learning.parks.ca.gov/blog/catalyst-issues/2025-summer/whats-up-peak-finder/)

## 7. What reviewers praise or criticise

### Cited Findings
- Praise: clarity of the drawing ("beautifully clear"), realistic visibility fade, offline operation, a 4.7/5 rating from about 12K ratings on the US App Store, and a $4.99 one-time price. — search summaries of [Oikofuge](https://oikofuge.com/peakfinder/), [App Store](https://apps.apple.com/us/app/peakfinder/id357421934)
- Criticism: cumbersome photo export (HN 2019–20, possibly outdated), some users preferring PeakVisor's look, and compass orientation failures on some devices (a Pixel 7 Pro review). — [HN](https://news.ycombinator.com/item?id=22008435), [Google Play](https://play.google.com/store/apps/details?id=org.peakfinder.area.alps&hl=en_US&gl=US) (snippets)

### Gaps
- No direct reviewer quotes on frame-rate or smoothness were found. No Soldati interview on rendering was found. Origin story: the idea came on a 2010 hike when two companions disagreed about a mountain name (PeakFinder About, via snippet).
