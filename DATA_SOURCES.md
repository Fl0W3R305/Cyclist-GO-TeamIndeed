# Data Sources, Calculation Methods and Limitations

All route calculation inputs are sourced from Brisbane City Council (BCC). The original BRouter routes and elevation data have been removed. OpenStreetMap is used only as the basemap and its roads and elevation data are not used in calculations.

## BCC Datasets

| Purpose | Source | Fields/Content Used |
|---|---|---|
| Road network geometry and bikeway attributes | [Bikeway sections](https://data.brisbane.qld.gov.au/explore/dataset/bikeway-sections/) | `geo_shape`, `objectid`, `traffic_types_description`, `bikeway_on_off_road_desc`, `locations_description`, `bikeway_name` |
| Supplementary existing network geometry | [LGIP Existing Bikeway](https://data.brisbane.qld.gov.au/explore/dataset/cp14-lgip-pfti-active-and-public-transport-existing-bikeway/) | `geo_shape`, `objectid`; only Existing infrastructure is used, while Future planned infrastructure is excluded |
| Signalised intersection locations | [Intersection locations — reference](https://data.brisbane.qld.gov.au/explore/dataset/traffic-management-intersection-locations-reference/) | `tsc`, `latitude`, `longitude`, `arms` |
| Signalised intersection traffic volume | [Intersection volume](https://data.brisbane.qld.gov.au/explore/dataset/traffic-data-at-intersection/) | `tsc`, `lane`, `recorded`, `ct`, `mf1`–`mf4` |
| Historical terrain | [Contours — 2002 — Download files](https://data.brisbane.qld.gov.au/explore/dataset/contours-2002-download-files/) | BCC-linked ArcGIS Contours_2002_Feature_Service: `ELEVATION` and contour geometry |

© Brisbane City Council. The datasets are used under the CC BY 4.0 licences stated on their respective source pages. This project clips, constructs graphs from, matches, samples and calculates indicators from the original data. This does not imply endorsement of this product by BCC.

## Download and Coverage

- Download date: 2026-09-15.
- Bikeways: queried within a 6 km radius of POINT(153.012 -27.486).
- Original coverage: 2,051 Bikeway sections and 348 Existing Bikeway sections.
- Published graph: the connected component containing the Milton starting point, consisting of 2,881 nodes and 2,900 edges.
- Terrain coverage: 152.998,-27.487 to 153.033,-27.465. A total of 1,246 matching contour lines were downloaded. The source data is from **2002**, not 2026.
- Original traffic snapshot: 2026-09-15 11:30–11:34 UTC, equivalent to 21:30–21:34 in Brisbane. The UI clearly states that this is not live traffic data.

## Road Network Construction

1. All edges between adjacent vertices in BCC polylines are retained. Coordinates are preserved to seven decimal places, providing centimetre-level processing precision.
2. Only shared vertices are connected. Nearby roads are not connected directly, grade-separated and ground-level roads that visually intersect are not automatically connected, and gaps of several metres are not filled.
3. Duplicate edges prioritise attributes from the asset dataset, followed by geometry from the Existing Bikeway dataset. Missing attributes remain unknown.
4. A real BCC graph node near the Milton reference point is selected as the starting point. Destinations are also real graph nodes. The UI explains that these nodes are approximately 100 m from QUT, 87 m from QAGOMA and 30 m from North Quay. These gaps are not drawn as assumed traversable connections.
5. The graph is undirected. The source data does not provide complete legal travel directions, turning restrictions, crossing controls or current closure information. Shared planar coordinates also do not constitute on-site verification of accessibility. Therefore, the graph must not be used as a real navigation service.

## Routing

`routes.js` implements Dijkstra’s algorithm using a min-heap. Quick mode uses the geometrically shortest path. It then generates up to eight alternative candidates by applying additional costs to previously used edges and retains loop-free paths no longer than 2.2 times the shortest path.

- Safety-focused: minimises `length × (1 + 2×on-road proportion + 0.75×unknown-type proportion)`. These are disclosed product weights, not an official BCC safety rating.
- Scenic: prioritises segments whose BCC names contain Bicentennial, Riverwalk or Kangaroo Point while penalising detours. This is a journey preference, not a scenic quality rating.
- The three modes independently select the most appropriate candidate and may select the same path. Different routes are not fabricated merely to display three lines.
- Distance: calculated using the haversine length of the BCC coordinate sequence.
- Time: calculated as distance ÷ 15 km/h. The speed of 15 km/h is a demonstration assumption rather than a BCC-published observed speed. It does not account for waiting, walking the bicycle or real-time traffic.

## Four Checkboxes

### Protected bikeways

A route must have **at least 95% of its length marked as OFF ROAD by BCC**, with at least 95% type-data coverage, to satisfy this verifiable off-road proxy indicator. This does not confirm the presence of physical separation such as kerbs or barriers. The UI explains this limitation. The threshold is a disclosed rule used by this MVP and is not an official BCC standard.

### Less traffic

For each TSC and approach, the most recent record in the snapshot is retained. `sum(mf1..mf4) / ct × 3600` converts the measurement into an equivalent vehicles-per-hour value for that approach. The values for all approaches at an intersection are then summed. The original data consists of observations per signal cycle and is **not a complete one-hour traffic count**. The most recent records for different approaches may come from different minutes within the snapshot.

Only route edges classified as ON GROUND or ON PAVEMENT are associated with the nearest BCC intersection when their midpoint is within 60 m of that intersection. The mean traffic volume of these nearby intersections is then calculated. ON STRUCTURE, UNDER STRUCTURE and IN TUNNEL edges are excluded from proximity matching. This 60 m spatial association does not confirm that the route actually passes through the intersection. It is only an indicator of nearby monitored traffic and does not cover every road along the route.

The checkbox retains routes whose indicator is no higher than the median of the three modes. Identical data may result in all tied routes being retained. The UI displays the proportion of route segments covered by the data and does not treat unmonitored segments as having low traffic.

### Fewer hills

The BCC 2002 contour lines are sampled approximately every 8 m. Each graph node uses the 12 nearest samples with inverse-distance-squared weighting. Elevation is considered unknown when the nearest sample is more than 50 m away. Only known ON GROUND or ON PAVEMENT edges are used. Elevation is not inferred for bridges, tunnels or segments with unknown attributes.

The indicator is the **maximum estimated elevation minus the minimum estimated elevation** among covered ground-level nodes. It is not total elevation gain or the number of hills. At least 80% of classified ground-level segments must have terrain data before routes no higher than the median of the three modes are retained. The UI also displays the proportion of the entire route covered by the terrain data. The 2002 terrain data, interpolation method and uncovered bridge surfaces all affect applicability, so small differences should not be used to determine actual cycling difficulty.

### Less busy crossings

Only route segments whose BCC type contains CROSSING are matched with the nearby intersection traffic data described above. Every identified crossing must have usable traffic data before its maximum value can be calculated and compared with the median of the three modes.

**The selected routes to all three destinations currently lack complete crossing-flow data that satisfies this rule.** Therefore, this condition matches no routes and displays an Unknown or no-match state. The absence of a CROSSING label also does not prove that a route has no crossings. Unknown values must not be treated as zero or automatically accepted.

## Content Not Used in Route Calculations

- The initial hazards are clearly labelled fictional demonstration scenarios used to demonstrate different hazard states and the reporting process.
- Local user reports and feedback do not change BCC route scores.
- Simulated cycling positions move along the calculated BCC routes. GPS data is not collected, and community reports are not transmitted.
- Leaflet 1.9.4, licensed under BSD-2-Clause, and the © OpenStreetMap basemap are used only for presentation.

## Update Method

Developers can run `python3 scripts/fetch_data.py INPUT_DIR` to download the original inputs and then run `python3 scripts/build_data.py INPUT_DIR` to rebuild `dist/data/bcc-data.js` and the JSON file. For a standard demonstration, users only need to open `dist/index.html`; Python dependencies are not required.

When updating the data, developers must verify fields, record counts, geographic coverage, lawful access and licensing, traffic timestamps and network connectivity. Changes in data coverage may alter the available routes and filtering results. Thresholds must not be silently relaxed, and disconnected roads must not be joined simply to produce demonstration results.