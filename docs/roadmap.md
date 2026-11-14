# Roadmap and open questions

Last updated 14 November 2026.

## Next up (waiting on Utkarsh)

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
