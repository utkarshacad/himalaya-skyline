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

## Things he has rejected or disliked

- The first prototype's look: MapLibre colour ramp, editorial panel.
- **Any always-visible panel that covers the map.** Keep the chrome thin and out of the way.
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
