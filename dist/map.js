/* Person 3 — map module. See TEAM_ALLOCATION.md. */
function initMap() {
  if (!window.L) {
    $("map-error").hidden = false;
    $("map-error").textContent =
      "Map library missing. Extract the complete ZIP, including the vendor folder. Route comparison still works.";
    return;
  }
  state.map = L.map("map", { zoomControl: false }).setView(
    D.start,
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
    [D.start, "A", "Indooroopilly Shopping Centre · mapped start"],
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
function drawRoutes() {
  if (!state.map) return;
  state.routeLayers.forEach((l) => l.remove());
  state.routeLayers = [];
  const ordered = [...state.routes].sort(
    (a, b) => Number(a.id === state.selected) - Number(b.id === state.selected),
  );
  ordered.forEach((r) => {
    if (state.view === "ride" && r.id !== state.selected) return;
    // Alternatives remain visible even if a filter excludes their cards.
    const active = r.id === state.selected;
    const line = L.polyline(r.points, {
      color: r.color,
      weight: active ? 6 : 4,
      opacity: active ? 0.9 : 0.28,
      dashArray: Preferences.accepts(r) ? null : "6 8",
      smoothFactor: 0,
    })
      .bindTooltip(`${r.name} · ${r.minutes} min · ${r.km.toFixed(1)} km`)
      .on("click", () => selectRoute(r.id))
      .addTo(state.map);
    state.routeLayers.push(line);
  });
  if ($("sections-toggle").checked) drawRouteSections();
  $("section-legend").hidden = !$("sections-toggle").checked;
  drawClimbs();
  drawHazards();
}
function drawHazards() {
  if (!state.map) return;
  state.hazardLayer.clearLayers();
  if (!$("hazards-toggle").checked) return;
  const hs = state.view === "ride" ? routeHazards() : visibleHazards();
  hs.filter(h => state.votes[h.id] !== "ignored").forEach((h) => {
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
  else state.map.setView(D.start, 13);
}
function loadBikeways() {
  if (!state.map) return;
  if (!state.bccLoaded) {
    const data = window.BCC_DATA;
    const features = data.bccNetwork;
    state.bikeways.addData({ type: "FeatureCollection", features });
    state.bccLoaded = true;
  }
  $("data-status").textContent =
    `BCC bikeway layer · ${BCC_DATA.bccNetwork.length} source features · ${BCC_DATA.meta.retrieved}`;
  if ($("bikeway-toggle").checked) state.bikeways.addTo(state.map);
}
function setupMap() {
  $("fit").addEventListener("click", () => state.view === "ride" ? followRider() : fit());
  $("sections-toggle").addEventListener("change", drawRoutes);
  $("hazards-toggle").addEventListener("change", drawHazards);
  $("bikeway-toggle").addEventListener("change", (e) => {
    if (!state.map) return;
    if (e.target.checked) loadBikeways();
    else state.bikeways.remove();
  });
  initMap();
  state.map?.on("dragstart", () => { if (state.view === "ride") { state.followRider = false; $("fit").textContent = "⌖ Re-centre"; } });
}

function drawRouteSections() {
 const r=current(); if(!state.map || !r) return;
 const d=BCC_DATA;
 r.edgeIds.forEach((ei,i)=>{
   const record=d.records[d.edges[ei][3]];
   const label=record.position === "OFF ROAD" ? "Off-road" : record.position === "ON ROAD" ? "On-road" : record.type ? "Other identified bikeway" : "Unknown";
   const color={"Off-road":"#078773","On-road":"#a66a00","Other identified bikeway":"#0875ed","Unknown":"#718294"}[label];
   state.routeLayers.push(L.polyline([r.points[i],r.points[i+1]],{color,weight:5,opacity:1,dashArray:label==="Unknown"?"5 5":null,smoothFactor:0}).bindTooltip(`${label} · ${record.name || record.street || "No BCC bikeway match"}`).addTo(state.map));
 });
}
function drawClimbs() {
 const r=current(); if(!state.map || !r) return;
 (r.indicators?.hill.climbs || []).forEach((c,i)=>{
   state.routeLayers.push(L.marker(D.pointAt(r,c.start/r.length),{icon:L.divIcon({className:"climb-pin",html:"▲",iconSize:[24,24]}),title:`Estimated climb ${i+1}`}).bindPopup(`Estimated climb ${i+1}: ${c.rise.toFixed(1)} m rise, up to ${c.maxGrade.toFixed(1)}% · BCC 2002 ground contours`).addTo(state.map));
 });
}
