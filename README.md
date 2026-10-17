# Cyclist Go — Indooroopilly demo

Open `dist/index.html` after extracting the whole ZIP. Native HTML/CSS/JavaScript and bundled Leaflet are retained. There is no npm build or Python requirement for the demonstration. Internet access is needed for OpenStreetMap tiles; route geometry and BCC indicators are saved locally. For consistent browser storage, use VS Code Live Server or `python3 -m http.server 8000 --directory dist` and open http://localhost:8000.

## Demo flow

1. Start near Indooroopilly Shopping Centre; choose Brisbane City Hall, UQ St Lucia or South Bank.
2. Selected destinations stay highlighted blue while all three choices remain visible. Compare Safety-focused, Quick and Scenic. All candidates are saved cycling routes. The three cards now reserve three distinct saved paths. Quick uses the shortest; the other two provide different comparison options and can involve detours.
3. Compare estimated BCC bikeway share and the separate off-road share. Unmatched sections are Unknown, not confirmed non-bikeway. The map shows blue/purple/green route alternatives, optional section colours, estimated climbs and the optional original BCC network layer.
4. Apply More bikeways, Less traffic, Fewer hills or Hill training. The two hills options are mutually exclusive. Other conditions use AND. No matching result is a valid outcome.
5. Start the simulated ride. The interface becomes a narrow, mobile-style map-first layout. Play/pause and advance by 200 m are demonstration controls, not real GPS.
6. Pause before saving a hazard location or completing a report. After ending the ride, complete saved drafts, choose hazard type and impact, enter notes, and click/drag the report map marker to adjust the location.
7. Confirm, ignore or add an observation to an existing hazard. Drafts, reports and feedback remain in this browser. They are not uploaded or verified live observations.

## Review against the requested changes

- Route comparison: separate bikeway/off-road percentages; unknown coverage is disclosed; coloured selected sections and faded alternatives are present.
- Hills: historical BCC elevation estimates, gradient, ascent, climb count, intensity and map markers; mutually exclusive avoid/training preferences.
- Riding mode: separate compact layout with map, progress, remaining distance/time, upcoming hazards and pause/end controls.
- Reporting: paused location recording, post-ride completion, map repositioning, local persistence and existing-hazard feedback.
- Removed the Less busy crossings filter and its crossing-flow summary. Crossing hazards can still be reported.
- Replaced the short Milton demo with longer Indooroopilly routes.

## Data change in this version

The BCC asset network is disconnected between the shopping centre, UQ and the city. With approval to supplement it, this version uses real **OpenStreetMap cycling geometry precomputed using BRouter**, enriched with BCC indicators. The browser ranks and assigns distinct saved candidates; it does not join disconnected BCC lines or contact BRouter at runtime. Old claims that OSM is only a basemap, or that the browser calculates these routes solely from BCC, no longer apply. See `DATA_SOURCES.md`.

Bikeway percentages are conservative spatial estimates, not a survey. Historical hill estimates exclude mapped bridge/tunnel surfaces. Traffic is a saved partial-coverage snapshot. Sample hazards are fictional. This is a planning demonstration, not a live navigation service.

## Files and optional rebuild

`dist/` remains the deployable website; `scripts/` contains offline data preparation.

```bash
python3 -m pip install numpy scipy shapely
python3 scripts/fetch_data.py INPUT_DIR
python3 scripts/fetch_routes.py INPUT_DIR
python3 scripts/build_data.py INPUT_DIR
```

BCC contour downloads can be large. They are deliberately excluded from the deployable ZIP. Saved raw route geometries, OSM structure extracts and a coordinate-keyed BCC contour interpolation cache are included in `scripts/route-snapshots/` for provenance; copy them to INPUT_DIR to reproduce the same candidate paths and contour estimates instead of requesting newer routes.

Optional integration verification:

```bash
npm install --no-save jsdom
node tests.cjs
```

AI assistance: ChatGPT/Codex assisted with implementation, data processing, debugging and documentation. Review the code and update your team's detailed declaration to reflect the final work used.
