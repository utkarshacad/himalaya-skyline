# Project context

This file records how Himalaya Skyline came about, so anyone (including a future Claude session) can pick it up without the original chat. It was written on 14 November 2026 at the end of the first working session.

## Who and why

- Utkarsh is building a browser-based Indian geography game suite. The first game is a Travle-style district chain game (UP Travle: UP, Punjab and J&K), hosted at `utkarshacad/up-travle`.
- He wanted a new game "related to mountains" to get **a good geographical sense of all the mountains and treks in India**. The goal is to learn the detailed geography of the region through the whole exercise, not just to trivia-test it.
- A personal hook: he is looking at the **Pangarchulla** trek for **December 2026**, his first trek, so Pangarchulla is one of the viewpoints.

## How we work

- He wants to be **asked clarifying questions** on skill-based tasks, so he can make the decisions where he has an information gap. He also sometimes says "take control" and lets Claude decide.
- He reacts to drafts and gives precise feedback.
- He likes visuals (diagrams, charts) in the chat.

## Decisions, in order

### Round 1: scope and direction

Claude pitched five concepts:
1. **Ridge Route**: Travle for mountains, chaining valleys through passes.
2. **Trek-dle**: a daily mystery trek with attribute feedback.
3. **Peak Pinpoint**: Globle-style click-on-map.
4. **Range Sorter**: sort peaks into ranges.
5. **Higher or Lower**: a streak game.

His answers:
- **Scope: the Himalaya only** for now.
- **Content focus:** undecided. He wants to learn the region's detailed geography.
- **Game modes:** make a **combination** and see which he likes best.
- **Map (most important):** it should be **somewhat 3D**, like how Google Earth shows terrain, but using stylised rendering instead of satellite photos to keep it light. It has to be **pretty and fun**.
- **Format: unlimited play**, not a daily puzzle.

### Round 2: first prototype (`prototypes/terrain-3d-prototype.html`)

- This was MapLibre 3D terrain with an elevation colour ramp, hillshade, sky and fog, about 30 markers, an Explore mode, a tour, and a Pinpoint teaser.
- First run: a black screen with `maplibregl is not defined` because the CDN was blocked in a preview pane. Fixed with a multi-CDN loader and a clear error card.
- **Verdict:** he **didn't like the look**, and **the top-left panel was always in the way**. He asked what the prototype was even trying to achieve. It was a tech test of 3D terrain, not a game yet.

### Round 3: research

He asked Claude to research how alpine courses teach mountains and how people remember the ranges, and to find out everything about the Himalayan ranges. Findings are in `research-himalaya.md` and `research-learning-and-peakfinder.md`.

### Round 4: what he loved

From the research and suggestions, he picked:
- **PeakFinder's whole look, feel and UI/UX.** "Absolutely brilliant and spot on", but it isn't gamified.
- **PeakFinder's 2D peak maps**, which can be gamified with a **Name the Skyline** mechanic.
- **PeakFinder's 3D fly-above view.**
- **The Himalaya as a memorable grid**: river-cut sections × mountain belts.
- **Rivers** as the thing this game adds over PeakFinder.
- He asked how PeakFinder is made and on which platform. See the research doc.

### Round 5: build decisions

- **Build our own renderer.** Don't embed PeakFinder's engine. The licence couldn't be confirmed, we'd depend on their servers, and we need control over hidden labels and rivers.
- **Viewpoints:** the four famous ones (one per section idea: Gulmarg, Kausani, Kala Patthar, Tiger Hill) **plus Pangarchulla** and the peaks around it.
- **Rivers both** on the 2D map and **glinting in the valleys** of the panorama. "The game should be pretty."
- **Theme: keep PeakFinder's exact theme** (dark night-blue sky, white ridgelines, slanted white labels, orange highlight). He'll change things afterwards.
- He asked whether Claude Code is used to build it. Yes: the game was written and tested in a Claude Code session.

### Round 6: v1 delivered (`index.html`)

- Home: map, Himalaya grid, viewpoint cards, a 3D fly-in.
- Play: the panorama renderer, quiz markers, autocomplete guessing, hints, scoring, fact cards, mini-map, compass, traced rivers with glints.
- Tested on real terrain in his browser (see `technical-design.md`).
- He then asked to push the project to its own GitHub repo with all the context. That's this repo.

### Round 7: the PeakFinder look, renderer v2 (14 November 2026)

- He shared PeakFinder screenshots (dark theme, target-circle telescope, sliders, marks) and later a **light theme** screenshot. He wants **both themes** in the game.
- What he called essential:
  - the **view of the mountains** as a line drawing;
  - a **visibility slider** that controls how many ranges show;
  - **butter-smooth, lag-free** panning;
  - **cinematic camera** movement;
  - **flags and favourites** on peaks;
  - free exploration where **terrain height and water come first and little else is loaded**;
  - the **fly-up** feature, "really important to the feel".
- Exploration scope: **A first** (curated viewpoints explored deeply), **built so B can follow** (stand anywhere on the map).
- **"The entire look of the game is what is most essential right now."** He approved all the critique fixes and said "I trust you".
- Research and critique: `research-peakfinder-look-and-tech.md`. v1's real-terrain render showed a flat dark foreground wedge, few ridge layers, a blue fill instead of grey line-art, and laggy panning.
- Built (renderer v2):
  - the 360° renders once into strips across a worker pool, so panning slides images at 60 fps;
  - crest-line detection and z12 near terrain;
  - optional height contours;
  - dark and light themes, with the home map themed too;
  - visibility slider and fly-up film;
  - telescope with info bar, marks, PeakFinder-style labels, and round-button chrome;
  - the mini-map moved behind the compass rose.
- Animation taste, as far as known: cinematic and smooth (eased camera, momentum, fly-in and fly-up). Terrain Travle's playful layer (sparks, mascot) has **not** been brought into Skyline; ask before adding it.

### Round 8: feedback on renderer v2 (14 November 2026)

He asked for:
1. smoother rivers;
2. a fly-in that merges into the panorama instead of feeling like a separate game mode (he chose **both** eye-level landing and ranges sweeping in);
3. and 8. **pink accents like PeakFinder** everywhere instead of yellow;
4. overlap fixes (waiting on his screenshot);
5. a fly-up that isn't laggy;
6. the compass to snap to true north, a separate mini-map button, and a **greyscale** mini-map;
7. a light theme with stronger contrast;
9. more visible and denser contours, plus a shaded look.

All but 4 were done in v2.1 (see `technical-design.md`).

### Round 9: feedback on v2.1 (14 November 2026)

He sent screenshots. What he asked for, and what was done in v2.2:
1. **Light-theme contours missing on far peaks:** the contour interval is now adaptive.
2. **The sliders panel looked tacky, with buttons too big:** it's now a small frosted card with text chips, a thin slider, and a sun/moon theme switch at the bottom.
3. **Dark theme had too many contours; wanted PeakFinder's clean shaded mountains:** contours are sparser and fainter, shading is smoother, and ridge lines are finer.
4. **The Himalaya grid looked tacky:** it's now a hairline schematic with the boundary rivers along the bottom.
5. **The settings panel covered the fly-up control:** the panel opens beside its button and the fly-up control hides while it's open.
6. **Viewpoints as small line-art mountains instead of pink dots:** done on both the map and the grid.
7. **The screen blurred between fly-up steps:** film frames are now full resolution.
8. **Rivers didn't blend in:** they now have a halo, a thinner core, distance fade and quieter sparkles.

He said "I will be away"; the work was pushed for him to check on his phone.

## Things he has rejected or disliked

- The first prototype's look: MapLibre colour ramp, editorial panel.
- **Any always-visible panel that covers the map.** Keep the chrome thin and out of the way. (v1's permanent mini-map broke this; v2 hides it behind the compass rose.)
- **Lag.** Panning or loading that stutters, as in Google Earth.
- Yellow or orange accents. Use PeakFinder pink (`#ff3b77` dark, `#e0245e` light).
- A pale, washed-out light theme.
- Rivers with sharp, jagged edges, or rivers that sit on top of the terrain instead of in it.
- Big chunky controls ("tacky"). Prefer small, minimal, frosted UI with text chips.
- Dense or jagged contour lines in the dark theme.
- Blur during camera moves.
- From his other project (UP Travle), the topographic survey map aesthetic. It was rejected there, so avoid it here too.

## Corrections made along the way

- Tiger Hill is **west of the Teesta**, so in Burrard's scheme it sits in the **Nepal Himalaya** section, not the Assam Himalaya. An early mock-up had it wrong.
- Kausani, Gulmarg and Kala Patthar coordinates needed snapping to the real ridge or summit. The values were checked on real terrain (see the technical doc).

## Still undecided

See `roadmap.md`. The main open items:
- Which of the other game modes to add (Fill the Grid, Handrail, Ridge Route, Pinpoint).
- Whether the map unlocks section by section.
- Final theme tweaks.
- Publishing on GitHub Pages.
