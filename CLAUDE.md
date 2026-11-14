# Notes for Claude

- Read `docs/CONTEXT.md` first. It holds the decisions and preferences from the original session.
- The owner (Utkarsh) wants **clarifying questions** on skill-based work so he can decide where he has an information gap. He may also say "take control".
- The game is the single file `index.html` with no build step. Keep it self-contained. MapLibre is the only external library.
- Visual direction: **PeakFinder's look**, in both of its themes: **dark** (charcoal ground, white ridge lines) and **light** (white ground, ink lines), with slanted labels and a **pink** highlight (never yellow). The look matters most to the owner. Use round icon buttons in the corners. **Never add a panel that permanently covers the map**; panels open on demand.
- Smoothness is a hard requirement: panning must never re-render. See "Render once, pan by sliding images" in `docs/technical-design.md`.
- Rivers are a core feature: traced from terrain, and glinting.
- Before changing the renderer, read `docs/technical-design.md`. The same code in `#shared-src` runs in both the page and the worker, so declare shared globals with `var`.
- Test with headless Chromium. In the cloud sandbox the real Terrarium tiles (s3.amazonaws.com) load, but the MapLibre CDNs are blocked: `npm i maplibre-gl@5.24.0` and route the CDN URLs to the local copy with Playwright. Use synthetic tiles only if the tile host is blocked.
