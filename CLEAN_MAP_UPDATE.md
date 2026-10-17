# Clean map code preview

## Open
Extract the ZIP and open dist/index.html using VS Code Live Server. No Python backend or API key is needed. Saved and demo login work as in the preceding version.

## Changed
- Locally rendered vector background: flat pale water/park fills and neutral road lines. Buildings, land parcels, textures, terrain shading and unrelated POI symbols are not drawn.
- Major roads at overview zoom; local streets from zoom 14; smaller paths from zoom 16. Sparse road labels are collision-filtered. Zooming changes display detail, not route calculations.
- Original blue / purple / green route colours preserved. Section colours and hazard symbols preserved. Climbs are now opt-in through a checkbox.
- Existing route coordinates, times, distances, preferences, Saved and login are unchanged.

## Coverage and source
This is an offline display snapshot for the existing project area, NOT a worldwide basemap. Bounds: west 152.93, south -27.58, east 153.06, north -27.43. Panning is bounded to this area. All three supplied destinations are within it; beyond its extent map detail is unavailable. It does not provide live closures or new routing.

OpenStreetMap data snapshot: 2026-10-11T06:46:16Z. Retrieved through https://overpass-api.de/api/interpreter . Data © OpenStreetMap contributors, licensed under ODbL 1.0: https://www.openstreetmap.org/copyright and https://opendatacommons.org/licenses/odbl/1-0/ . Attribution is visible in the map. The derived background dataset dist/data/clean-basemap.js is distributed under ODbL 1.0. It includes provenance, bounds and the snapshot timestamp.

Selected OSM data: highway ways (excluding proposed, construction and steps), natural=water ways and multipolygon relations, leisure=park ways, within the bounds above. Polygon relations are assembled with holes, clipped to the area and simplified for display. Road geometry is clipped, simplified and grouped by display tier. Some local water/park features may be incomplete in OSM; the background is geographic context, not a route access guarantee.

scripts/build_clean_basemap.py rebuilds this display dataset from an Overpass JSON response and requires Shapely. This script does not modify bcc-data.js or route geometry. Routing remains the uploaded OSM/BRouter snapshot with BCC indicators.

## Files
- dist/clean-map.js: local background renderer and zoom-dependent details.
- dist/data/clean-basemap.js: background geography.
- dist/map.js, dist/map.css, dist/index.html: integration and optional climb markers.
- scripts/build_clean_basemap.py: background build process.

## Verification
Chromium desktop/mobile: map rendering, Saved persistence and direct comparison, route switching, climb toggle and ride entry; no JavaScript page errors. Screenshots visually checked. Existing integration suite including Saved checks passed. Source data and route module hashes match the Saved release. This is a code preview, not a deployed website.

## Route comparison visibility correction
The comparison map fits all three route geometries, not just the selected one. Selected route: original colour, 7px, 100% opacity, drawn above alternatives. Other routes: original colours, 4px, 50% opacity. Selecting another card changes emphasis without removing alternatives. Overlapping sections remain geographically coincident; they are not offset or invented. Riding continues to show only the selected route.
