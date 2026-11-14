# Notes for Claude

- Read `docs/CONTEXT.md` first. It holds the decisions and preferences from the original session.
- The owner (Utkarsh) wants **clarifying questions** on skill-based work so he can decide where he has an information gap. He may also say "take control".
- The game is the single file `index.html` with no build step. Keep it self-contained. MapLibre is the only external library.
- Visual direction: **PeakFinder's look** (dark night-blue sky, white ridgelines, slanted white labels, orange highlight). Keep the chrome thin. **Never add a panel that permanently covers the map.**
- Rivers are a core feature: traced from terrain, and glinting.
- Before changing the renderer, read `docs/technical-design.md`. The same code in `#shared-src` runs in both the page and the worker, so declare shared globals with `var`.
- Test with headless Chrome by intercepting the Terrarium tile requests with synthetic tiles. Real tiles need a normal browser.
