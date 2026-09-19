function initMap(){
    if (!window.L){
        $("map-error").hidden = false;
        $("map-error").textContent =
        "Map library missing. Extract the complete ZIP, including the vendor folder. Route comparison still works.";
        return;
    }
    StaticRange.map = L.map("map", {zoomControl: false}).setView(
        [-27.473, 153.019],
        13,
    );
    L.control.zoom({ position: "bottomright" }).addTo(state.map);
    state.hazardLayer = L.layerGroup().addTo(state.map);
    state.endpointLayer = L.layerGroup().addTo(state.map);
    state.bikeways = L.geoJSON(null, {
        style: { color: "#188570", weight: 3, opacity: 0.55 },
        onEachFeature: (f, l) => {
        const p = f.properties;
        const el = document.createElement("div");
        el.textContent = `${p.street_name || "Unnamed bikeway"} · ${p.bikeway_on_off_road_desc || "No type recorded"}`;
        l.bindPopup(el);
        },
    });
    let errors = 0;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    })
        .on("tileerror", () => {
        if (++errors > 1) {
            $("map-error").hidden = false;
            $("map-error").textContent =
            "Map tiles unavailable. Reconnect to the internet and reload; saved routes and demo controls still work.";
        }
        })
        .addTo(state.map);
    drawEndpoints();
}
function drawEndpoints() {
  if (!state.map) return;
  state.endpointLayer.clearLayers();
  [
    [D.start, "A", "Milton cycleway start"],
    ...(current() ? [[current().points.at(-1), "B", dest().name]] : []),
  ].forEach(([p, label, name]) =>
    L.marker(p, {
      icon: L.divIcon({
        className: "endpoint " + (label === "A" ? "start" : ""),
        html: label,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
      title: name,
    })
      .bindTooltip(name)
      .addTo(state.endpointLayer),
  );
}
function drawRoutes(){
    if (!state.map) return;
    state.routeLayers.forEach((l) => l.remove());
    state.routeLayers = [];
    const ordered = [...state.routes].sort(
    (a, b) => Number(a.id === state.selected) - Number(b.id === state.selected),
  );
  ordered.forEach((r) => {
    if (state.view === "ride" && r.id !== state.selected) return;
    if (state.view === "compare" && !Preferences.accepts(r)) return;
    const active = r.id === state.selected;
    const line = L.polyline(r.points, {
      color: r.color,
      weight: active ? 6 : 4,
      opacity: active ? 1 : 0.28,
      smoothFactor: 0,
    })
      .bindTooltip(`${r.name} · ${r.minutes} min · ${r.km.toFixed(1)} km`)
      .on("click", () => selectRoute(r.id))
      .addTo(state.map);
    state.routeLayers.push(line);
  });
  drawHazards();
}
function drawHazards() {
  if (!state.map) return;
  state.hazardLayer.clearLayers();
  if (!$("hazards-toggle").checked) return;
  const hs = state.view === "ride" ? routeHazards() : visibleHazards();
  hs.forEach((h) => {
    const t = hazardType(h);
    const marker = L.marker(h.point, {
      icon: L.divIcon({
        className: "hazard-pin " + h.kind,
        html: t.icon,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
      title: `${t.name}: ${h.kind}${h.sample ? " (sample)" : ""}`,
    });
    marker.on("click", () => openHazard(h.id));
    marker.bindTooltip(`${t.name} · ${h.kind}${h.sample ? " · sample" : ""}`);
    marker.addTo(state.hazardLayer);
  });
}
function fit() {
  if (!state.map) return;
  const r = current();
  if (r)
    state.map.fitBounds(r.points, {
      paddingTopLeft: [40, 70],
      paddingBottomRight: [50, 95],
      maxZoom: 16,
    });
  else state.map.setView([-27.473, 153.019], 13);
}
// Data source: Brisbane City Council Bikeway Sections, CC BY 4.0
// https://data.brisbane.qld.gov.au/explore/dataset/bikeway-sections/
function loadBikeways() {
  if (!state.map) return;
  if (!state.bccLoaded) {
    const data = window.BCC_DATA;
    const features = data.edges.map((e) => {
      const r = data.records[e[3]];
      return {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [data.nodes[e[0]], data.nodes[e[1]]].map((p) => [
            p[1],
            p[0],
          ]),
        },
        properties: {
          street_name: r.street,
          bikeway_on_off_road_desc: r.position,
          source_id: r.id,
        },
      };
    });
    state.bikeways.addData({ type: "FeatureCollection", features });
    state.bccLoaded = true;
  }
  $("data-status").textContent =
    `BCC snapshot · ${BCC_DATA.meta.graphEdges} connected edges · ${BCC_DATA.meta.retrieved}`;
  if ($("bikeway-toggle").checked) state.bikeways.addTo(state.map);
}
function setupMap() {
  $("fit").addEventListener("click", fit);
  $("hazards-toggle").addEventListener("change", drawHazards);
  $("bikeway-toggle").addEventListener("change", (e) => {
    if (!state.map) return;
    if (e.target.checked) loadBikeways();
    else state.bikeways.remove();
  });
  initMap();
}
