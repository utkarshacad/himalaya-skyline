# Data sources for a lightweight PeakFinder-style Himalaya renderer (terrain + water + peak names)

Scope: Indian/Nepal Himalaya, bbox ~72–98°E, 25–37°N (Uttarakhand/Nanda Devi–Pangarchulla, Kashmir, Sikkim, Everest). Only the data side: elevation, hydrography, peak names, and label/visibility selection.

Research-environment note: in this session direct fetches to registry.opendata.aws, mapterhorn.com, protomaps.com, hydrosheds.org, andrewkirmse.com and viewfinderpanoramas.org were blocked by the sandbox network allowlist (DNS failure). Findings for those come from search-result snippets of the official pages or from mirrors/GitHub, which I could fetch. Anything taken from search snippets rather than a full page read is marked "(snippet)". Confirm those against the primary page before relying on them.

## 1. Elevation sources and formats usable in the browser

### Takeaway
For a browser renderer, the two practical options are **AWS/Mapzen Terrarium PNG tiles** (what the project uses now: free, no key, SRTM-based, zoom 0–15) and **Mapterhorn** (free Terrarium-encoded 512 px WebP in PMTiles, built from Copernicus GLO-30 up to z12). In the Himalaya, Copernicus GLO-30 is the better DEM: it is newer, it is TanDEM-X based, and it has documented void filling. SRTM-derived tiles inherit SRTM's steep-terrain voids. MapTiler terrain-rgb-v2 is good quality, but it needs an API key and its free plan is non-commercial only. Raw COGs (Copernicus on AWS, AW3D30, NASADEM, Viewfinder) are for building your own tiles offline, not for streaming to the client.

### Cited Findings
**AWS / Mapzen Terrain Tiles (Terrarium)**
- Terrarium decode formula: `elev_m = (R*256 + G + B/256) - 32768`. Terrarium and Normal PNG tiles come at 256, 260, 512 and 516 px in Web Mercator; GeoTIFF tiles are 512 px; Skadi tiles are 1°×1° HGT in WGS84 — [tilezen/joerd formats.md](https://github.com/tilezen/joerd/blob/master/docs/formats.md)
- Zoom range is 0–15, and tiles at high zoom are oversampled from coarser source data — [FME Terrain Tiles on AWS reader params](https://docs.safe.com/fme/2017.1/html/FME_Desktop_Documentation/FME_ReadersWriters/terraintilesaws/terraintilesaws_reader.htm) (snippet)
- Sources are 3DEP/NED in the US (~10 m) and SRTM elsewhere (~30 m on land, except high latitudes), with parts interpolated from lower-resolution datasets — [FME docs](https://docs.safe.com/fme/2017.1/html/FME_Desktop_Documentation/FME_ReadersWriters/terraintilesaws/terraintilesaws.htm) (snippet); [OpenTopoData Mapzen page](https://www.opentopodata.org/datasets/mapzen/) (snippet)
- Attribution is required for both analysis and display. Required credits include "SRTM and GMTED2010 courtesy of the U.S. Geological Survey", with ETOPO1 credited to NOAA in some wordings — [tilezen/joerd attribution.md](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) (snippet); [elevatr docs](https://www.github.com/jhollist/elevatr/blob/041d88e5dbbc6c5157e3eef43bb7fb1a4074ee9e/man/get_aws_terrain.Rd) (snippet)
- AWS registry entry: [registry.opendata.aws/terrain-tiles](https://registry.opendata.aws/terrain-tiles). The usual public endpoint is `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`. That URL pattern comes from prior knowledge; I could not re-fetch it in this session.

**Mapterhorn**
- Open terrain project distributing PMTiles archives. The global layer is Copernicus GLO-30 (30 m) for z0–12. Where national high-res data exists (e.g. swissALTI3D), it adds z13+ tiles — [Protomaps blog: Mapterhorn](https://protomaps.com/blog/mapterhorn-terrain/) (snippet); [source.coop/mapterhorn](https://source.coop/mapterhorn/mapterhorn) (snippet)
- Encoding: Terrarium in 512×512 WebP. MapLibre source: `type: raster-dem, encoding: 'terrarium', tileSize: 512`. Planet archive: `https://download.mapterhorn.com/planet.pmtiles`. Tile URL pattern: `download.mapterhorn.com/{name}.pmtiles/{z}/{x}/{y}.webp` — [DEV.to Mierune article](https://dev.to/mierune/building-a-3d-map-application-using-mapterhorn-terrain-data-elo) (snippet); [terrain-viewer docs](https://terrain-viewer.iconem.com/docs/features/terrain-sources/) (snippet)
- GDAL's PMTiles driver reads vector tiles only. Use a PMTiles-aware client (pmtiles.js) or extract the tiles — [GIS.SE mirror](https://backiee.wasmer.app/https_gis_stackexchange_com/questions/495515/tile-type-webp-not-handled-by-the-driver) (snippet)
- Funded by NLnet; presented at SotM 2026 — [NLnet project page](https://nlnet.nl/project/Mapterhorn/); [SotM 2026 talk](https://2026.stateofthemap.org/sessions/UQF7NY)
- Asia had no high-res national sources as of the Japan note (Dec 2025): only the GLO-30 global layer — [Zenn/Mierune](https://zenn.dev/mierune/articles/try-120-mapterhorn) (snippet). For the Himalaya, Mapterhorn therefore means GLO-30 up to z12.

**MapTiler terrain-rgb-v2**
- Max zoom 14, WebP, 30 m global and 5 m in specific areas — [MapTiler Terrain RGB docs](https://docs.maptiler.com/schema-raster/terrain-rgb/) (snippet)
- Needs an API key. The Free plan is limited to non-commercial use and R&D — [MapTiler Cloud terms](https://www.maptiler.com/cloud/terms/) (snippet); [pricing](https://www.maptiler.com/cloud/pricing/) (snippet). A third party claims a limit of 100k tile loads per month, which I could not verify — [GeoDataViewer](https://geodataviewer.pages.dev/datasets/dem/maptiler-terrain-tiles)

**Copernicus GLO-30 / GLO-90**
- Free worldwide licence except Armenia and Azerbaijan for GLO-30. Modified data must carry the notice "Copernicus WorldDEM-30 © DLR e.V. … provided under COPERNICUS by the European Union and ESA" — [Sentinel Online announcement](https://sentinels.copernicus.eu/-/copernicus-dem-30-metre-dataset-now-freely-available) (snippet); [Sentinel Hub forum licence update](https://forum.sentinel-hub.com/t/copernicus-dem-license-update-on-aws/3815) (snippet)
- GLO-30 and GLO-90 are hosted as Cloud Optimized GeoTIFFs on the AWS Open Data registry. AWS tiles are 3600×3600 near the equator, not 3601. The vertical datum is EGM2008 — [geomorphometry.org](https://geomorphometry.org/2021/08/12/copernicus-digital-elevation-model-dem-as-open-data-on-amazon-aws-and-sentinel-hub); [Sentinel Hub forum](https://forum.sentinel-hub.com/t/copernicus-dem-data-available-on-aws/3027) (snippet)
- Spec accuracy: absolute vertical accuracy < 4 m (LE90). Relative accuracy is < 2 m on slopes ≤ 20% and < 4 m on steeper slopes. Voids are interpolated or filled, with an editing mask and a filling mask provided — [ESA presentation](https://earth.esa.int/eogateway/documents/20142/2982981/3_Leister_2.pdf/1f084495-7cf3-7b88-d4d6-cb363dadbfa0) (snippet); [GEE catalog](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_DEM_GLO30) (snippet)

**Viewfinder Panoramas (Jonathan de Ferranti)**
- Void-fill method: generate contours from SRTM, extend them into voids using topo maps, rebuild the DEM and merge it with the original SRTM, keeping all source SRTM pixels. Sources for High Asia: SRTM, Russian 1:100k/1:200k maps, Nepal 1:50k maps — [viewfinderpanoramas.org voidfill](https://viewfinderpanoramas.org/voidfill.html) (snippet)
- Fill quality is "variable but particularly good" in the western Karakoram and much of High Asia — [viewfinderpanoramas.org voidfill](https://viewfinderpanoramas.org/voidfill.html) (snippet). An older mkgmap list post reports serious artefacts such as ~1 km-deep false depressions — [mkgmap-dev list](https://lists.mkgmap.org.uk/archives/list/mkgmap-dev@lists.mkgmap.org.uk/message/HFROGJOEMRTHU3NXFG2EJD6UULQQYEIS) (snippet)
- Distributed as HGT. Kirmse's prominence pipeline uses VFP 90 m, or 30 m via a flag — [akirmse/mountains](https://github.com/akirmse/mountains)

**ALOS AW3D30 (JAXA)**
- Free for commercial and non-commercial use under JAXA Terms of Use. Registration is required and attribution is expected. Versions 3.1/3.2 are on JAXA's site, and GEE lists V4_1 — [JAXA AW3D30 page](https://www.eorc.jaxa.jp/ALOS/en/dataset/aw3d30/) (snippet); [JAXA terms](https://www.eorc.jaxa.jp/ALOS/en/aw3d30/terms.htm); [GEE V4_1](https://developers.google.com/earth-engine/datasets/catalog/JAXA_ALOS_AW3D30_V4_1)

**Kirmse's own DEM list** (useful as a vetted shortlist): SRTM/VFP 90 m, Copernicus GLO-30 (AWS), FABDEM (30 m bare-earth GLO-30, Univ. Bristol) — [akirmse/mountains README](https://github.com/akirmse/mountains)

**Zoom → ground resolution at 31°N** (Web Mercator, computed: 156543·cos φ / 2^z):
| z | 256 px tile | 512 px tile |
|---|---|---|
| 7 | 1048 m | 524 m |
| 8 | 524 m | 262 m |
| 9 | 262 m | 131 m |
| 10 | 131 m | 66 m |
| 11 | 66 m | 33 m |
| 12 | 33 m | 16 m |

### Inferences
- In practice, AWS z12 at 256 px (~33 m) or Mapterhorn z11 at 512 px (~33 m) already reaches the source resolution. Beyond that, tiles are only oversampled.
- For a skyline renderer, far terrain (50–300 km) only needs z7–z9 (~130–520 m/px). Only the near field (< 10–20 km) benefits from z11–z12.
- Swapping AWS Terrarium for Mapterhorn should cost almost nothing to integrate: same Terrarium decode, 512 px WebP instead of 256 px PNG, PMTiles range requests. It also likely gives better Himalayan peaks, because GLO-30 is TanDEM-X based while SRTM has voids on steep, shadowed slopes. That last point is an inference, see Gaps.
- Check CORS on the PMTiles host before relying on it at runtime. If it is uncertain, extract a regional PMTiles subset (`pmtiles extract` with a bbox) and self-host it.
- NASADEM: no source fetched; see Gaps.

### Gaps
- Could not confirm CORS headers on elevation-tiles-prod or download.mapterhorn.com in this session (hosts blocked). Test from the browser with a `fetch()` and check `Access-Control-Allow-Origin`.
- No Himalaya-specific peer-reviewed comparison of GLO-30, SRTM, NASADEM and AW3D30 was retrieved.
- NASADEM void status and licence for the Himalaya were not researched (no source retrieved).
- Could not confirm whether Viewfinder's 1" (30 m) coverage includes the Uttarakhand, Sikkim and Everest areas, or VFP's licence wording (site blocked).
- Mapterhorn licence text (it is presumably the upstream Copernicus terms plus attribution) was not confirmed from the primary page.

## 2. Precomputing vs streaming: a self-hosted Himalaya DEM pyramid

### Takeaway
A pre-baked regional pyramid is very feasible on GitHub Pages at ≤ 250 m resolution. 250 m is ~53 Mpx and roughly 65–105 MB lossless. 500 m is ~13 Mpx and ~16–26 MB. 90 m (~450 Mpx, ~0.5–0.9 GB) hits GitHub Pages' practical limits. The best structure is a hybrid: self-host a coarse pyramid (z5–z9) as a single PMTiles file, and stream z10–z12 near-field tiles from AWS or Mapterhorn.

### Cited Findings
- Terrarium is lossless 24-bit fixed point (1/256 m precision) — [joerd formats](https://github.com/tilezen/joerd/blob/master/docs/formats.md)
- Mapterhorn already proves the delivery format: Terrarium in WebP inside PMTiles, served with HTTP range requests from static hosting — [Protomaps blog](https://protomaps.com/blog/mapterhorn-terrain/) (snippet)
- Computed region figures (bbox 72–98°E × 25–37°N, area ≈ 3.3 M km² at mid-latitude 31°):

| Resolution | Pixels (approx) | Raw int16 | Lossless Terrarium PNG/WebP est.* |
|---|---|---|---|
| 30 m (1") | ~4.0 G | ~8 GB | 5–8 GB |
| 90 m (3") | ~450 M | ~0.9 GB | 0.5–0.9 GB |
| 250 m | ~53 M | ~106 MB | 65–105 MB |
| 500 m | ~13 M | ~26 MB | 16–26 MB |
| 1 km | ~3.3 M | ~6.6 MB | 4–7 MB |
| + full pyramid overhead | ×1.33 | | |

*The compressed-size column is my own estimate (≈1.2–2 bytes/px for lossless Terrarium on rugged terrain). It is not a measured figure.

- Web Mercator tile counts for the bbox (computed): z8 = 209, z9 = 798, z10 = 3,075, z11 = 12,069, z12 = 47,817 tiles (256 px grid; 512 px tiles are one zoom lower).

### Inferences
- **Lossy quantization is a big lever.** Terrarium's low byte (B) carries sub-metre precision that a skyline does not need. Zeroing B, or storing elevation as a 16-bit value in R+G at 1 m (or 2 m) steps, makes PNG/WebP compress much better. You could also use lossy WebP on a custom (non-Terrarium) 16-bit encoding, but lossy compression on R/G channels causes large errors, so only lossless is safe for packed encodings.
- **An 8-bit grayscale DEM is not enough** for the 0–8,850 m range: about 35 m steps. That is acceptable only for > 100 km background silhouettes.
- **Quantized-mesh** (Cesium) is efficient for near-field meshes but adds a decoder. For a skyline that ray-marches or builds its own grid mesh, raster heightmaps are simpler.
- **GitHub Pages:** from prior knowledge, not verified this session, published sites should stay under ~1 GB, individual files under 100 MB, with a ~100 GB/month soft bandwidth limit. A single PMTiles archive therefore needs to stay under 100 MB (250 m pyramid z5–z9 fits), or be split per zoom. Larger archives should go to Cloudflare R2 or source.coop.
- **Suggested bake:** pull GLO-90 (or GLO-30 resampled) COGs for the bbox, with optional VFP fill for any residual artefacts. Then `gdalwarp` to EPSG:3857, encode Terrarium with `rio-rgbify` or a custom script, write z5–z9 512 px lossless WebP, and pack with `pmtiles`. Expect ~20–60 MB.

### Gaps
- No measured compression ratios for Himalayan Terrarium tiles were found. Bake one z9 tile set and measure.
- GitHub Pages limits were not re-verified against docs.github.com in this session.

## 3. Hydrography (rivers, lakes, glaciers)

### Takeaway
For **named** rivers like the Alaknanda, Dhauliganga and Bhagirathi, the practical source is **OSM** (`waterway=river` + `name`/`name:en` via Overpass, ODbL). **HydroRIVERS** gives a clean, consistent, hydrologically correct network with discharge and order attributes, which makes it ideal for picking which rivers to draw, but it has **no names**. Natural Earth is public domain and tiny, but at 1:10 M it only carries trunk rivers. Use **HydroLAKES** (≥ 10 ha) or OSM for lakes, and **RGI 7.0 regions 14/15** for glaciers.

### Cited Findings
- **HydroRIVERS**: regional tiles, with Asia under the "as" code. Shapefile, WGS84. Attributes are geometric/hydrologic only: reach length, distance to headwater/outlet, river order, long-term discharge, and HydroBASINS ID. There are no river names — [HydroRIVERS TechDoc v10](https://data.hydrosheds.org/file/technical-documentation/HydroRIVERS_TechDoc_v10.pdf) (snippet); [hydrosheds.org/page/hydrorivers](https://hydrosheds.org/page/hydrorivers) (snippet)
- HydroRIVERS licence: free for scientific, educational and commercial use under the HydroSHEDS licence, which requires attribution (HDX lists it as CC-BY). Cite Lehner & Grill 2013, Hydrol. Processes 27(15):2171–2186, doi:10.1002/hyp.9740 — [hydrosheds.org](https://hydrosheds.org/page/hydrorivers) (snippet)
- **HydroLAKES**: ~1.43 M lake/reservoir polygons ≥ 10 ha (1,426,967 per Zenodo; 1,427,688 per CSDMS). Free for scientific, educational and other uses, citing Messager et al. 2016. One mirrored licence file says "© authors, all rights reserved", so check the terms before redistribution — [hydrosheds.org/hydrolakes](https://www.hydrosheds.org/hydrolakes) (snippet); [Zenodo 7916729](https://zenodo.org/record/7916729); [CSDMS](https://csdms.colorado.edu/wiki/Alldata:HydroLAKES); [FlightGear mirror readme](https://git.nayala.duckdns.org/fly/fgdata/raw/branch/next/Textures/Globe/02READMElakes.txt)
- **Natural Earth** rivers + lake centerlines (10m, i.e. 1:10 M) are public domain, with attribution optional. Names come from CCM. There are no intermittent rivers, and a scale-rank attribute is included — [Natural Earth rivers page](https://www.naturalearthdata.com/?p=1506); [Stanford record](https://purl.stanford.edu/hv485tn5089)
- **OSM water polygons** (osmdata.openstreetmap.de) are ocean/coast-derived polygons, so they are irrelevant for an inland Himalaya. ODbL. A separate "Waterbodies" page exists. A third party reports the WGS84 split water zip at ~540 MB — [osmdata water polygons](https://osmdata.openstreetmap.de/data/water-polygons.html); [osmdata waterbodies](https://osmdata.openstreetmap.de/data/water.html)
- **RGI 7.0**: region 14 is South Asia West (Karakoram, Kashmir, Himachal) and region 15 is South Asia East (Uttarakhand, Nepal, Sikkim, Bhutan). Download from NSIDC (NSIDC-0770, doi:10.5067/F6JMOVY5NAVZ); an improved subset is on the Copernicus CDS — [RGI regions](https://www.glims.org/rgi_user_guide/02_regions_definition.html); [NSIDC-0770](https://nsidc.org/data/nsidc-0770/versions/7); [ECMWF forum](https://forum.ecmwf.int/t/glaciers-distribution-data-from-the-randolph-glacier-inventory-for-year-2000-dataset-improved-version-of-rgiv7-0-published/15101)

### Inferences
- **Recommended pipeline:** Overpass extract `way["waterway"="river"]` (plus `natural=water` for lakes) for the bbox → mapshaper `-simplify` (e.g. 10–20%) → `-filter` by length → TopoJSON or FlatGeobuf/PMTiles vector. Optionally attach HydroRIVERS `ORD_STRA` or discharge by spatial join, to rank rivers when decluttering.
- **Example Overpass query** for rivers (split the bbox into ~4 sub-boxes to avoid timeouts):
  ```
  [out:json][timeout:300];
  ( way["waterway"="river"]["name"](28,77,32,82);   // Uttarakhand/Himachal box
    relation["waterway"="river"]["name"](28,77,32,82); );
  out geom;
  ```
- **Expected size** (inference, not measured): simplified named rivers for the Indian Himalaya are probably a few MB of GeoJSON, < 1 MB as TopoJSON/gzip. RGI 14+15 glacier outlines are large, at tens of thousands of polygons, so simplify hard and drop glaciers < 1 km² for a skyline view.
- **For PeakFinder-style rendering**, water mostly matters as valley-floor lines and lake glints in the near/mid field. The rivers can also be draped onto the DEM by sampling elevation along each line.

### Gaps
- Exact file sizes of HydroRIVERS_v10_as, HydroLAKES and the RGI 14/15 files were not retrieved.
- RGI 7.0 licence text was not confirmed. It is believed to be CC-BY 4.0, but that is not verified in this session.
- I did not confirm whether Natural Earth 10m includes the Alaknanda or Bhagirathi by name; most likely only the Ganga trunk. Check the attribute table.

## 4. Peak names, coordinates, heights and prominence

### Takeaway
Use **OSM `natural=peak`** via Overpass as the primary name and coordinate source (ODbL, best local coverage incl. Indian names and `name:en`). Cross-check heights against **Wikidata** for major peaks, and use **Andrew Kirmse's worldwide prominence dataset** (all peaks with ≥ 100 ft prominence, MIT code) to rank which peaks deserve labels. GeoNames (CC-BY 4.0, feature codes T.PK / T.MT) is a fallback with coarse coordinates. PeakVisor and Peakbagger are reference-only and not freely redistributable.

### Cited Findings
- The OSM wiki defines `natural=peak` with `ele` and optional `prominence`. The R-bloggers "eight-thousanders" post queries a Himalayan box (25,70,38,98) with `natural=peak` filtered on `ele` and `prominence` — [OSM wiki Tag:natural=peak](https://wiki.openstreetmap.org/wiki/Tag%3Anatural%3Dpeak); [R-bloggers eight thousanders](https://www.r-bloggers.com/2025/11/eight-thousanders/) (snippet)
- OSM `ele` quality problems: values off by ×10, or entered in feet without units. The OSM ele wiki warns discrepancies can easily reach ~50 m — [OSM community: Highest peaks in OSM](https://community.openstreetmap.org/t/highest-peaks-in-openstreetmap/108578) (snippet); [OSM wiki Key:ele](https://wiki.openstreetmap.org/Key:ele) (snippet). Everest-specific node oddities have been discussed — [OSM community: Mount Everest node oddities](https://community.openstreetmap.org/t/mount-everest-node-oddities/108640)
- **Kirmse prominence/isolation**: worldwide prominence results down to 100 ft (30.48 m). Each row gives lat, lon, elevation (m), key-saddle lat/lon and prominence. The isolation file gives lat, lon, elevation (ft), ILP lat/lon and isolation in km. Downloads are Google Drive zips linked from the repo; the code is MIT licensed. The results can be browsed at everymountainintheworld.com. The input DEMs include VFP/SRTM 90 m and GLO-30/FABDEM. A 2023 higher-resolution update exists — [akirmse/mountains](https://github.com/akirmse/mountains); [Kirmse prominence page](https://sites.google.com/a/andrewkirmse.com/home/prominence) (snippet)
- **GeoNames**: CC-BY 4.0. Feature codes T.PK (peak) and T.MT (mountain, ≥ 300 m relief). Fields include integer `elevation` (m) and a separate `dem` column (~30" SRTM average) — [GeoNames dump readme mirror](https://android.googlesource.com/platform/external/geonames/+/7a853d30915d91f323de5649b130afbd00e609de/export/dump/readme.txt); [GRASS v.in.geonames](https://sources.debian.org/src/grass/8.4.2-1/scripts/v.in.geonames/v.in.geonames.html); [GeoNames statistics](https://geonames.org/statistics/kyrgyzstan.html)

### Inferences
- **Example Overpass query** (CSV, easy to bake into a static JSON; split into sub-boxes if it times out):
  ```
  [out:csv(::id,::lat,::lon,name,"name:en","name:hi","name:ne",ele,prominence,wikidata;true;",")][timeout:300];
  node["natural"="peak"]["name"](25,72,37,98);
  out;
  ```
  Add `node["natural"="volcano"]` and `node["natural"="saddle"]` / `["mountain_pass"="yes"]` for passes. Bake the result to a compact JSON array `[lon,lat,ele,prom,name]`, roughly 50–100 B per peak, so even 20k peaks is ~1–2 MB, or < 500 KB gzipped (estimate).
- **Join with Kirmse:** match each OSM peak to the nearest Kirmse summit within ~300–500 m to borrow DEM-consistent prominence. Name only the peaks that match. Kirmse's elevations come from the DEM, so they line up with the rendered terrain better than survey heights for placing labels; display the OSM or Wikidata survey height instead.
- **Height sanity rules:** reject `ele` > 8,900, flag `ele` values that look like feet (≈ 3.28× DEM height), and flag |OSM ele − DEM sample| > 150 m for review.
- PeakVisor and Peakbagger have no free bulk API or licence for redistribution. I found no source saying otherwise; use them only for manual verification.

### Gaps
- The count of named `natural=peak` nodes in the bbox and the Kirmse file size were not measured (downloads not attempted).
- Wikidata SPARQL example for the region not researched/verified.
- No systematic audit of OSM Himalayan coordinate errors found (only general ele-quality discussions).

## 5. "Visibility range": using prominence + distance to choose labels and ridges

### Takeaway
Combine three filters, cheapest first: (1) **a geometric horizon/curvature cut-off**, (2) **a prominence threshold that grows with distance**, and (3) **an actual line-of-sight test against the DEM**, which a ray-marched depth buffer gives you for free. Then declutter labels in screen space by priority = prominence (or isolation) × angular size.

### Cited Findings
- Kirmse's prominence (key-col based) and isolation (distance to nearest higher ground, ILP) datasets give exactly the two per-peak "importance" metrics this needs — [akirmse/mountains](https://github.com/akirmse/mountains)
- OSM supports a `prominence` tag on peaks, though coverage is partial — [OSM wiki natural=peak](https://wiki.openstreetmap.org/wiki/Tag%3Anatural%3Dpeak)

### Inferences
These rules are standard geometry and renderer practice, not from a specific fetched source.
- **Curvature drop with refraction:** `drop ≈ d²·(1−k)/(2R)`, with R = 6,371 km and k ≈ 0.13. That gives ~0.7 km at 100 km, ~2.7 km at 200 km and ~6.2 km at 300 km, so a 7,000 m peak 300 km away rises only ~0.8 km above sea-level-at-horizon. Apply the drop in the renderer, both for realism and for culling.
- **Distance-dependent prominence threshold**, e.g. `minProm(d) = 30 m` for d < 5 km, `150 m` for d < 30 km, `300 m` for d < 100 km, `600 m+` beyond. This keeps 6,000–8,000 m giants (Nanda Devi, Kamet, Kangchenjunga, Everest) visible from ~200–300 km while hiding minor tops.
- **Line-of-sight:** after rendering, sample the depth buffer at each candidate's projected screen position. Label the peak only if its distance ≈ the depth value (within a tolerance) and its summit pixel lies on or near the skyline or a visible ridge. This is the essential PeakFinder trick. It needs no extra data.
- **Label declutter:** sort visible peaks by `prominence × (1/d)` or by angular height above the local horizon. Greedily place labels left-to-right and reject overlaps, and apply a hysteresis band to avoid flicker while panning.
- **Ridge lines:** silhouette or ridge lines fall out of the depth buffer (depth discontinuities). No vector ridge data is needed.

### Gaps
- No published description of PeakFinder's own label-selection algorithm was retrieved.
- The suggested threshold values are heuristics, not validated against any dataset.
