/* Person 5 — new preference filters and BCC-derived comparative indicators.
   Operational definitions are shown in the interface and DATA_SOURCES.md. */
const Preferences = (() => {
  const data = window.BCC_DATA;
  const definitions = [
    {
      id: "protected",
      label: "Protected bikeways",
      hint: "Proxy: at least 95% BCC-mapped off-road length. Physical barriers are not verified.",
    },
    {
      id: "traffic",
      label: "Less traffic",
      hint: "Lower average flow at nearby BCC monitored signals among these options. This is a partial-coverage proxy, not route-wide traffic.",
    },
    {
      id: "hills",
      label: "Fewer hills",
      hint: "Smaller terrain-height range on covered ground sections. Uses 2002 contours; bridges and tunnels are excluded.",
    },
    {
      id: "crossings",
      label: "Less busy crossings",
      hint: "Lower maximum flow near BCC-mapped bicycle crossings. Missing counts do not mean a quiet crossing.",
    },
  ];
  const selected = new Set();
  function metrics(route) {
    let surveyed = 0,
      groundLength = 0,
      terrainLength = 0;
    const heights = [],
      nearby = new Set(),
      crossings = new Set();
    for (const ei of route.edgeIds) {
      const [a, b, m, ri, si] = data.edges[ei],
        r = data.records[ri];
      const ground = ["ON GROUND", "ON PAVEMENT"].includes(r.level);
      if (ground) {
        groundLength += m;
        const x = data.elevations[a],
          y = data.elevations[b];
        if (x !== null && y !== null) {
          terrainLength += m;
          heights.push(x, y);
        }
      }
      if (ground && si !== null) {
        const site = data.sites[si];
        if (site.flow !== null) {
          nearby.add(si);
          surveyed += m;
        }
      }
      if (/CROSSING/.test(r.type || "")) {
        if (si !== null) crossings.add(si);
        else crossings.add("missing");
      }
    }
    const rates = [...nearby].map((i) => data.sites[i].flow),
      crossRates = [...crossings]
        .filter((i) => i !== "missing" && data.sites[i].flow !== null)
        .map((i) => data.sites[i].flow);
    const crossingsKnown =
      crossings.size > 0 && crossRates.length === crossings.size;
    return {
      offroad: route.offroad,
      assetCoverage: route.known,
      traffic: rates.length
        ? rates.reduce((a, b) => a + b, 0) / rates.length
        : null,
      trafficCoverage: surveyed / route.length,
      signalCount: rates.length,
      terrain: heights.length
        ? Math.max(...heights) - Math.min(...heights)
        : null,
      terrainCoverage: terrainLength / route.length,
      groundCoverage: groundLength ? terrainLength / groundLength : 0,
      crossingFlow: crossingsKnown ? Math.max(...crossRates) : null,
      crossingCount: crossings.size,
      crossingMeasured: crossRates.length,
    };
  }
  function median(values) {
    const a = values.filter(Number.isFinite).sort((a, b) => a - b);
    return a.length ? a[Math.floor((a.length - 1) / 2)] : null;
  }
  function evaluate(routes) {
    routes.forEach((r) => (r.indicators = metrics(r)));
    const limits = {
      traffic: median(routes.map((r) => r.indicators.traffic)),
      hills: median(routes.map((r) => r.indicators.terrain)),
      crossings: median(routes.map((r) => r.indicators.crossingFlow)),
    };
    return routes.map((r) => {
      const m = r.indicators;
      const matches = {
        protected: m.assetCoverage >= 0.95 && m.offroad >= 0.95,
        traffic: m.traffic !== null && m.traffic <= limits.traffic + 1e-6,
        hills:
          m.terrain !== null &&
          m.groundCoverage >= 0.8 &&
          m.terrain <= limits.hills + 1e-6,
        crossings:
          m.crossingFlow !== null && m.crossingFlow <= limits.crossings + 1e-6,
      };
      r.preferenceMatches = matches;
      r.preferenceUnknown = {
        protected: m.assetCoverage < 0.95,
        traffic: m.traffic === null,
        hills: m.terrain === null || m.groundCoverage < 0.8,
        crossings: m.crossingFlow === null,
      };
      return r;
    });
  }
  function accepts(route) {
    return [...selected].every((id) => route.preferenceMatches?.[id]);
  }
  function render() {
    document.querySelectorAll("[data-preference-panel]").forEach((panel) => {
      panel.innerHTML = `<fieldset class="route-preferences"><legend>Route Preference</legend><div class="preference-grid">${definitions.map((d) => `<label title="${d.hint}"><input type="checkbox" data-preference="${d.id}" ${selected.has(d.id) ? "checked" : ""}><span>${d.label}</span></label>`).join("")}</div><p class="preference-help">All selected conditions must match. Indicators are BCC-derived estimates.</p><details><summary>What these filters mean</summary>${definitions.map((d) => `<p><b>${d.label}:</b> ${d.hint}</p>`).join("")}<p>Lower means at or below the median of the three displayed preferences. Missing data never counts as a match. Nearby signals may not be a crossing on your route.</p><p>Traffic snapshot: ${new Date(data.meta.trafficFrom).toLocaleString("en-AU", { timeZone: "Australia/Brisbane" })}–${new Date(data.meta.trafficTo).toLocaleTimeString("en-AU", { timeZone: "Australia/Brisbane" })} Brisbane time. Not live.</p></details></fieldset>`;
    });
  }
  function summary(route) {
    const m = route.indicators;
    const pct = (v) => Math.round(v * 100) + "%";
    return `<div class="indicator-grid"><div><b>${pct(m.offroad)}</b><span>mapped off-road</span></div><div><b>${m.traffic === null ? "Unknown" : Math.round(m.traffic)}</b><span>nearby vehicles/h proxy</span></div><div><b>${m.terrain === null ? "Unknown" : m.terrain.toFixed(1) + " m"}</b><span>terrain range · 2002</span></div><div><b>${m.crossingFlow === null ? "Unknown" : Math.round(m.crossingFlow)}</b><span>crossing flow proxy</span></div></div><p class="indicator-note">Type coverage ${pct(m.assetCoverage)} · Nearby signal coverage ${pct(m.trafficCoverage)} · Terrain coverage ${pct(m.terrainCoverage)} of total length. Bridge/tunnel heights excluded.</p>`;
  }
  function setup() {
    render();
    document.addEventListener("change", (e) => {
      const id = e.target.dataset.preference;
      if (!id) return;
      e.target.checked ? selected.add(id) : selected.delete(id);
      render();
      if (state.routes.length && state.view === "compare") applyPreferences();
    });
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-clear-preferences]")) {
        selected.clear();
        render();
        if (state.routes.length) applyPreferences();
      }
    });
  }
  return {
    definitions,
    selected,
    evaluate,
    accepts,
    render,
    summary,
    setup,
    metrics,
  };
})();

// Person 5 coordinates filter results with person 2’s route cards.
function applyPreferences() {
  const matches = state.routes.filter(Preferences.accepts);
  if (!matches.some((r) => r.id === state.selected))
    state.selected = matches[0]?.id || null;
  $("preference-results").innerHTML = matches.length
    ? `${matches.length} of 3 preferences match · ${new Set(matches.map((r) => r.signature)).size} distinct path${new Set(matches.map((r) => r.signature)).size === 1 ? "" : "s"}`
    : `No options match all selected conditions. ${[...Preferences.selected]
        .filter((id) => state.routes.every((r) => r.preferenceUnknown[id]))
        .map(
          (id) =>
            Preferences.definitions.find((d) => d.id === id).label +
            " has insufficient BCC measurements.",
        )
        .join(
          " ",
        )} Unknown data never counts as a match. <button class="text-button" data-clear-preferences>Clear filters</button>`;
  $("preference-results").classList.toggle("no-matches", !matches.length);
  renderCards();
  renderDetail();
  drawRoutes();
  drawEndpoints();
  $("start-ride").disabled = !matches.length;
}
