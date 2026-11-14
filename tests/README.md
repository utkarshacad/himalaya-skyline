# Tests

Headless Chromium (software WebGL via SwiftShader) driving the real `index.html` on real Terrarium tiles.

```bash
cd tests && npm i
node smoke.test.js          # one test
npm test                    # every *.test.js
```

- `harness.js` serves the repo on a local http server (the Cache API needs a real origin), routes the
  `maplibre-gl@*` CDN URLs to `node_modules/maplibre-gl/dist`, records console errors and tile requests.
- Screenshots go to `tests/out/` (git-ignored).
- Frame timing in headless runs is not meaningful (software rasteriser); check smoothness on a real device.
