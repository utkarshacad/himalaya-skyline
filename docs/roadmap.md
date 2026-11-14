# Roadmap and open questions

Last updated 14 November 2026.

## Done in renderer v2 (14 November 2026)

- [x] PeakFinder line-drawing look: crest lines, foreground detail, distance fade
- [x] Dark and light themes (panorama and home map)
- [x] 60 fps panning: render the 360° once, then slide strips
- [x] Visibility slider, fly-up, telescope with info bar, flag and favourite marks, slanted labels, round-button chrome

## Next up (waiting on Utkarsh)

- [ ] Play renderer v2 on real terrain and react to the look: line density, contours on or off, label band, fly-up speed.
- [ ] **B: stand anywhere.** Tap any point on the home map to render its skyline. The strip engine already supports this; it needs a "drop pin" flow and peak names for arbitrary places (see below).
- [ ] Peak names everywhere: a baked OSM `natural=peak` list ranked by prominence (Kirmse dataset), so "All" names and the telescope work beyond the quiz list.
- [ ] Try Mapterhorn (Copernicus GLO-30) terrain for sharper Himalayan peaks; check CORS from a browser.
- [ ] Optional camera polish: an auto "tour" pan across the named peaks, and a filter for marked peaks on the home map.

- [ ] Play v1 on real terrain and give feedback on the look.
- [ ] Theme tweaks after playing. He said "keep PeakFinder's exact theme, I'll change things afterwards".
- [ ] Decide whether to host on **GitHub Pages**. The repo needs to be public for free Pages.

## Planned game modes

He wants to try a combination and keep the ones he likes best.

- [x] **Name the Skyline**: label peaks from real viewpoints (v1).
- [ ] **Fill the Grid**: drop peaks, passes and ranges into the right belt × section cell.
- [ ] **Handrail**: follow a river from its glacier through its gorge, naming the ranges it cuts.
- [ ] **Ridge Route**: cross the Himalaya south to north through real passes. Reuses the UP Travle chain logic.
- [ ] **Pinpoint**: a peak is named; click where it is on the 2D map.
- [ ] **Trek-dle** (from the first pitch): guess a mystery trek from attribute feedback.

## Content

- [ ] Verify the peak coordinates flagged in `technical-design.md` against OSM or PeakVisor.
- [ ] More viewpoints, ideally filling every grid cell:
  - Trans-Himalaya: Leh / Shanti Stupa, Khardung La
  - Assam Himalaya: Sela Pass, Tawang
  - Shivalik: Dehradun ridges, Mussoorie
  - Treks: Kedarkantha summit, Kuari Pass, Goecha La, Roopkund
- [ ] Name more rivers in each viewpoint (anchor points in `VIEWPOINTS[].rivers`).
- [ ] Optionally load peak names live from OpenStreetMap (Overpass) for a "digital binoculars" reveal of every named peak.

## Open design questions

- Unlock the map section by section, west to east, or keep everything open from the start?
- Should the Himalaya grid tint the terrain (belts as colour bands) or stay a corner panel?
- A finer grid using the Himalayan Journal groups (Nanda Devi Group, Kamet Group, Gangotri Group…)?
- Mobile layout pass: touch targets, guess sheet, mini-map size.
