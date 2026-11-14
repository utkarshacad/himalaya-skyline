# Himalaya Skyline

*A gamified version of PeakFinder.*

A browser game for learning the geography of the Himalaya the way mountaineers do: stand at a real viewpoint, look at the skyline, and name the peaks.

It draws the mountains in the style of the PeakFinder app, as clean ridgelines rendered live from real elevation data, and adds two things PeakFinder doesn't have: a game, and rivers that glint in the valleys.

## Play

Open `index.html` in Chrome or Edge with an internet connection. Double-clicking the file works, and so does hosting it on GitHub Pages. The elevation data streams from a public server, so the game won't load inside preview panes that block outside data.

1. **Home map.** A dark relief map of the Himalaya with major rivers and five viewpoints. The *Himalaya grid* in the corner places each viewpoint in its river-cut section (column) and mountain belt (row).
2. **Fly in.** Pick a viewpoint and press *Fly in*. The map swoops down in 3D while the terrain loads.
3. **Name the Skyline.** You see the full 360° panorama. Drag to look around and scroll or pinch to zoom. Every peak you can actually see from that spot carries a **?** marker. Click one and type its name.
   - Scoring: 3 points on the first try, 2 on the second, 1 after a hint. *Show me* reveals the answer for 0 points.
   - Each answer opens a short fact card.
   - The mini-map in the corner shows your view cone, the traced rivers, and the peaks.

### Viewpoints in v1

| Viewpoint | Grid cell | Peaks on the list |
|---|---|---|
| Apharwat, Gulmarg | Punjab Himalaya · Lesser (Pir Panjal) | Nanga Parbat, Haramukh, Kolahoi, Amarnath Peak |
| Kausani | Kumaon Himalaya · Lesser | Trisul, Nanda Devi, Nanda Devi East, Nanda Kot, Panchachuli, Chaukhamba, Nanda Ghunti, Kamet, Dunagiri |
| Pangarchulla summit | Kumaon Himalaya · edge of the Greater | Nanda Devi, Trisul, Dunagiri, Changabang, Hathi Parbat, Ghori Parbat, Kamet, Mana Peak, Neelkanth, Chaukhamba, Nanda Ghunti |
| Kala Patthar | Nepal Himalaya · Greater | Everest, Lhotse, Nuptse, Pumori, Changtse, Ama Dablam, Makalu, Cho Oyu, Taboche, Cholatse, Khumbutse |
| Tiger Hill, Darjeeling | Nepal Himalaya (west of the Teesta) · Lesser | Kangchenjunga, Kabru, Jannu, Pandim, Everest, Lhotse, Makalu, Chomolhari |

Only peaks with a clear line of sight from the viewpoint become questions.

## Repository layout

| Path | What it is |
|---|---|
| `index.html` | The game, a single self-contained file. MapLibre loads from a CDN. |
| `docs/CONTEXT.md` | How the project came about: goals, every decision made so far, and the reasons for each. **Start here.** |
| `docs/research-himalaya.md` | The Himalaya as a grid: belts, faults, river sections, peaks, sources. |
| `docs/research-learning-and-peakfinder.md` | How mountain courses teach peak recognition, and how PeakFinder is built. |
| `docs/technical-design.md` | How the renderer, rivers, line-of-sight and loading work, plus test results. |
| `docs/roadmap.md` | Open questions and what to build next. |
| `prototypes/terrain-3d-prototype.html` | The first MapLibre 3D prototype, kept for reference. Its look was rejected. |
| `CLAUDE.md` | Working notes for future Claude sessions on this repo. |

## Data and credits

- **Elevation:** Mapzen / AWS Terrain Tiles (Terrarium encoding; SRTM, GMTED, ETOPO1), streamed at runtime.
- **Rivers:** traced live from the terrain using flow accumulation. The overview map uses Natural Earth 1:50m rivers (public domain).
- **Map engine:** [MapLibre GL JS](https://maplibre.org/) 5.24.0 (BSD-3).
- **Peak positions:** approximate coordinates from public sources, snapped to the highest nearby terrain cell. Heights shown are the published heights.
- **Visual reference:** [PeakFinder](https://www.peakfinder.com/) by Fabio Soldati. This project is an independent re-implementation of the visual idea and uses no PeakFinder code or data.
