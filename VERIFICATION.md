# Verification — Indooroopilly update

- JavaScript and Python syntax checks passed.
- Integration tests passed for all three destinations, saved-route coordinate provenance, connected route sequences, landmark offsets, no route loops, filter synchronisation and hill-option exclusivity.
- Ferry/step segments were rejected from downloaded route responses. Bridge records include Eleanor Schonell and Go Between; bridge levels are excluded from ground-contour hill calculations.
- Route geometry was plotted against retrieved OSM map tiles to inspect roads and river crossings.
- Headless Chromium interaction test passed: destination selection, filter changes, start/pause/advance/end ride, saved hazard draft completion, report submission, and report persistence after reload.
- Browser screenshots inspected for comparison and compact riding layout. The test browser could not retrieve online map tiles directly in this environment; the fallback message and local route display worked. The production page still uses the standard OSM tile URL and needs internet access for the basemap.
- All three destinations have three distinct saved paths with separate calculated indicators. Tests also verify that choosing and switching a destination retains all three destination buttons and exactly one highlighted choice. Unknown coverage remains unknown.

To repeat the integration test, install jsdom and run `node tests.cjs`. The demonstration itself needs no installation.
