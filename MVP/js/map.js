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
