# Data Sources, Methods and Limitations

## Current version: Indooroopilly routes

This version supersedes the previous Milton-only BCC graph. The BCC asset data does not supply a fully connected network from Indooroopilly Shopping Centre to UQ and the CBD. Following approval to supplement the network, **OpenStreetMap (OSM) supplies route geometry, precomputed by BRouter**. BCC supplies spatial bikeway attributes, traffic measurements and historical contours. OSM also supplies the basemap. No route computation service is called when the demo opens.

## Sources

| Purpose | Source | Use |
|---|---|---|
| Cycling route geometry | [OpenStreetMap](https://www.openstreetmap.org/copyright), prepared by [BRouter](https://brouter.de/) | Saved trekking-profile candidates; no fabricated straight-line connectors |
| Bikeway attributes | [BCC Bikeway sections](https://data.brisbane.qld.gov.au/explore/dataset/bikeway-sections/) | Geometry, objectid, type, on/off-road classification, structure level and bikeway/street names |
| Additional BCC overlay geometry | [LGIP Existing Bikeway](https://data.brisbane.qld.gov.au/explore/dataset/cp14-lgip-pfti-active-and-public-transport-existing-bikeway/) | Map overlay only; geometry-only records do not establish bikeway classification for route percentages |
| Monitored signals | [Intersection locations](https://data.brisbane.qld.gov.au/explore/dataset/traffic-management-intersection-locations-reference/) | TSC, coordinates and street names |
| Traffic snapshot | [Intersection volume](https://data.brisbane.qld.gov.au/explore/dataset/traffic-data-at-intersection/) | TSC, lane/approach, recorded time, cycle time ct, mf1–mf4 |
| Historical ground terrain | [Contours 2002](https://data.brisbane.qld.gov.au/explore/dataset/contours-2002-download-files/) | BCC-linked ArcGIS Contours_2002_Feature_Service, ELEVATION and contour geometry |

BCC sources: © Brisbane City Council, CC BY 4.0 as stated on the source pages. OSM data: © OpenStreetMap contributors, ODbL. Leaflet 1.9.4 is the map-rendering library, BSD-2-Clause; its license is included in `dist/vendor/LICENSE`. BRouter's saved route responses and request URLs are included under `scripts/route-snapshots/`. This is an adapted demonstrator, not an endorsement by the data providers.

## Scope and preparation

- Fixed start: the mapped public path beside Indooroopilly Shopping Centre, requested coordinate 152.9735, -27.4995. The snapped-start offset is stored in data metadata and disclosed in the page.
- Destinations: Brisbane City Hall, UQ St Lucia and South Bank. Endpoints are mapped arrivals near the requested landmarks. Their distances from the reference points are shown; no building-access connector is invented.
- BCC network query: 9 km around POINT(152.998 -27.49).
- Ground contour envelope: 152.965,-27.525 to 153.04,-27.455. The source year remains **2002**, regardless of download date.
- The actual retrieval date, traffic observation interval and graph sizes are stored in `dist/data/bcc-data.json` under `meta`.
- Route preparation uses BRouter's cycling `trekking` profile, with ferries and steps disabled and its elevation preference disabled. The downloaded geometry is retained; BRouter elevations, time and ascent are not used for the displayed metrics.
- BRouter's OSM route access information is a snapshot and may be incomplete or out of date. It is not a certification of current legal access or conditions.

## Candidate selection

Three BRouter alternatives are requested for each destination. The browser keeps distinct saved candidates within 2.2 times the shortest candidate length. It never constructs a new connection between candidate paths.

- **Quick:** shortest saved candidate; not a guaranteed globally shortest route.
- **Safety-focused:** after reserving Quick, selects a different path minimising length × (1 + 2 × matched on-road share + 0.75 × unclassified share). These are product weights, not an official safety rating.
- **Scenic:** from candidates not assigned to Quick or Safety-focused, favours the share matched to BCC names containing Bicentennial, Riverwalk or Kangaroo Point, with a detour penalty. It is not an official scenery score.
- The demo requires three distinct coordinate sequences. Distinct paths take priority over independently optimal labels: the Safety-focused alternative is not guaranteed safer than Quick, and Scenic is not a verified scenery rating. All candidates remain real saved cycling routes; no connectors are invented.
- Distance is haversine length of the saved OSM coordinate sequence. Time assumes 15 km/h, excluding stops, signals and current traffic.

Every displayed route is materialised from its own node and edge IDs. Distance, time, BCC bikeway/off-road shares, traffic, contour-based hill metrics and filters are recomputed from that route. Candidate labels do not supply any fixed or simulated metric values.

## Bikeway and off-road percentages

BCC attributes are matched conservatively to OSM route segments. Three sample points along a segment must lie within 12 m of the same BCC asset geometry. The local directions must align within 25 degrees; ground/structure classifications must be compatible. A BCC off-road asset cannot be assigned to an OSM ordinary-road segment. This reduces false matches but cannot prove identity, particularly around parallel paths and junctions.

Identified bikeway share is matched, typed BCC asset length divided by total route length. Off-road share is the separate subset matched to BCC OFF ROAD assets. Physical separation by a kerb or barrier is not verified. Unmatched or untyped length is **Unknown**, not a confirmed absence of cycling facilities. LGIP geometry alone is not counted as typed coverage. Percentages and colours represent spatial estimates.

More bikeways keeps options with a positive bikeway share at or above the median of the three modes. This compares coverage rather than demanding a continuous protected route.

## Less traffic

For each TSC + lane/approach, retain the latest snapshot record. Convert sum(mf1..mf4) / ct × 3600 into an hourly-equivalent vehicle count, then sum measured approaches per signal. This is a signal-cycle rate extrapolation, **not a full measured hour**. Latest approaches may have different timestamps.

Only ground-level route edges are linked to the nearest monitored signal within 60 m of their midpoint. Use the mean across distinct linked signals. Proximity does not establish that the cyclist crosses the signal, and many road sections are unmonitored. Display covered route length and do not treat missing data as low traffic. The filter keeps values at or below the mode median. Less busy crossings was removed because it duplicated this limited signal-flow proxy.

## Hills and training

Contour lines are sampled approximately every 8 m. A route node's elevation is estimated from the 12 nearest contour samples with inverse-square distance weights; the estimate is unknown when the nearest sample is more than 50 m away. Bridge/tunnel sections identified in OSM structure extracts or matched BCC structure records are excluded. OSM structure extracts cover the city river crossings, Eleanor Schonell Bridge and the Indooroopilly bridge precinct; BCC matching supplements them. Unmapped structures remain a source of uncertainty. Heights come from BCC contours, not BRouter's elevation values.

Known continuous ground runs are resampled at 40 m intervals (a final interval must be at least 20 m). Missing data splits a run; no ascent is inferred across a gap. A 2 m reversal threshold reduces small interpolation fluctuations in accumulated ascent/descent. Major climbs require at least 3 m rise, 60 m length and 2% sampled uphill gradient.

Intensity (0–100) = 50 × min(ascent / 100 m, 1) + 30 × min(maximum absolute sampled gradient / 10%, 1) + 20 × min(major climbs / 5, 1).

These transparent weights are demonstration assumptions, not BCC standards or a fitness assessment. Values describe covered ground only, not exact whole-route ascent. Both ground-only coverage and total-route coverage are displayed. At least 80% of eligible ground length must have elevation estimates for hill filtering. Fewer hills keeps scores at/below the eligible median; Hill training keeps scores at/above it. They are mutually exclusive, although tied routes may satisfy either choice separately. Historical terrain, interpolation and incomplete structure tags can distort estimates.

## Hazard and ride behaviour

Initial hazards are explicitly labelled fictional samples. Browser-local reports, drafts, confirmations, ignored hazards and observations do not affect route ranking and are not verified live data. The simulator follows the saved geometry and does not use GPS. Save a location or complete a report only while paused/stopped; finish the report after reaching a safe place. The report marker can be repositioned on the map. Reports within 35 m of a selected route appear in that route's list; adjusted reports remain stored even when outside that threshold.

## Updating and validation

Run `fetch_data.py`, `fetch_routes.py`, then `build_data.py` with the same input directory. A coordinate-keyed contour-node cache is included with the route snapshots to reproduce this version without downloading the large contour extract again. Remove the cache when refreshing terrain inputs; it is reused only when the entire node coordinate sequence matches. Validate API schemas, source access, licensing, timestamps, matched coverage, landmark offsets and route continuity. Check river crossings against actual mapped bridges. Do not join gaps or increase matching tolerances merely to produce more matches. Missing measurements must remain unknown.
