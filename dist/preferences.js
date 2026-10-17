/* Person 5 — new preference filters and BCC-derived comparative indicators.
   Operational definitions are shown in the interface and DATA_SOURCES.md. */
const Preferences = (() => {
  const data = window.BCC_DATA;
  const definitions = [
    {
      id: "protected",
      label: "More bikeways",
      hint: "At or above the median mapped bikeway share of these options. Off-road share is shown separately; physical barriers are not verified.",
    },
    {
      id: "traffic",
      label: "Less traffic",
      hint: "Lower average flow at nearby BCC monitored signals among these options. This is a partial-coverage proxy, not route-wide traffic.",
    },
    {
      id: "hills",
      label: "Fewer hills",
      hint: "Lower estimated hill intensity among these options. Uses 2002 ground contours; bridges, tunnels and missing data are excluded.",
    },
    {
      id: "training",
      label: "Hill training",
      hint: "Higher estimated hill intensity among these options. Mutually exclusive with Fewer hills; not a measured fitness rating.",
    },
  ];
  const selected = new Set();
  function metrics(route) {
    let surveyed = 0,
      groundLength = 0,
      terrainLength = 0;
    const heights = [],
      nearby = new Set();
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
    }
    const rates = [...nearby].map((i) => data.sites[i].flow);
    return {
      bikeway: route.bikeway,
      hill: hillMetrics(route),
      offroad: route.offroad,
      assetCoverage: route.known,
      traffic: rates.length
        ? rates.reduce((a, b) => a + b, 0) / rates.length
        : null,
      trafficCoverage: Math.min(1, surveyed / route.length),
      signalCount: rates.length,
      terrain: heights.length
        ? Math.max(...heights) - Math.min(...heights)
        : null,
      terrainCoverage: Math.min(1, terrainLength / route.length),
      groundCoverage: groundLength ? terrainLength / groundLength : 0,
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
      protected: median(routes.map((r) => r.bikeway)),
      hills: median(routes.filter(r => r.indicators.hill.eligible).map(r => r.indicators.hill.score)),
    };
    return routes.map((r) => {
      const m = r.indicators;
      const matches = {
        protected: m.bikeway > 0 && m.bikeway >= limits.protected - 1e-6,
        traffic: m.traffic !== null && m.traffic <= limits.traffic + 1e-6,
        hills:
          m.hill.eligible && m.hill.score <= limits.hills + 1e-6,
        training: m.hill.eligible && m.hill.score >= limits.hills - 1e-6,
      };
      r.preferenceMatches = matches;
      r.preferenceUnknown = {
        protected: m.bikeway === 0,
        traffic: m.traffic === null,
        hills: !m.hill.eligible,
        training: !m.hill.eligible,
      };
      return r;
    });
  }
  function accepts(route) {
    return [...selected].every((id) => route.preferenceMatches?.[id]);
  }
  function render() {
    document.querySelectorAll("[data-preference-panel]").forEach((panel) => {
      panel.innerHTML = `<fieldset class="route-preferences"><legend>Route Preference</legend><div class="preference-grid">${definitions.map((d) => `<label title="${d.hint}"><input type="checkbox" data-preference="${d.id}" ${selected.has(d.id) ? "checked" : ""}><span>${d.label}</span></label>`).join("")}</div><p class="preference-help">All selected conditions must match. Indicators are BCC-derived estimates.</p><details><summary>What these filters mean</summary>${definitions.map((d) => `<p><b>${d.label}:</b> ${d.hint}</p>`).join("")}<p>Lower means at or below the median of eligible displayed preferences; Hill training uses at or above it. Ties may match both options. More bikeways compares coverage rather than requiring a fully off-road route. Missing data never counts as a match. Nearby signals may not be a crossing on your route.</p><p>Traffic snapshot: ${new Date(data.meta.trafficFrom).toLocaleString("en-AU", { timeZone: "Australia/Brisbane" })}–${new Date(data.meta.trafficTo).toLocaleTimeString("en-AU", { timeZone: "Australia/Brisbane" })} Brisbane time. Not live.</p></details></fieldset>`;
    });
  }
  function summary(route) {
    const m = route.indicators;
    const pct = (v) => Math.round(v * 100) + "%";
    return `<div class="indicator-grid"><div><b>${pct(m.bikeway)}</b><span>identified bikeways</span></div><div><b>${pct(1-m.bikeway)}</b><span>unclassified bikeway length</span></div><div><b>${pct(m.offroad)}</b><span>mapped off-road</span></div><div><b>${m.traffic === null ? "Unknown" : Math.round(m.traffic)}</b><span>nearby vehicles/h proxy</span></div><div><b>${m.terrain === null ? "Unknown" : m.terrain.toFixed(1) + " m"}</b><span>terrain range · 2002</span></div></div><p class="indicator-note">Type coverage ${pct(m.assetCoverage)} · Nearby signal coverage ${pct(m.trafficCoverage)} · Terrain coverage ${pct(m.terrainCoverage)} of total length. Bridge/tunnel heights excluded.</p>${hillSummary(route)}`;
  }
  function setup() {
    render();
    document.addEventListener("change", (e) => {
      const id = e.target.dataset.preference;
      if (!id) return;
      if (e.target.checked && ["hills", "training"].includes(id)) selected.delete(id === "hills" ? "training" : "hills");
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


// Historical contour estimates: use 40 m profile intervals, never bridge gaps.
function hillMetrics(route) {
  const data = BCC_DATA;
  const runs = []; let run = [], covered = 0, ground = 0;
  const flush = () => { if (run.length > 1) runs.push(run); run = []; };
  route.edgeIds.forEach((ei, i) => {
    const e = data.edges[ei], r = data.records[e[3]];
    const onGround = ["ON GROUND", "ON PAVEMENT"].includes(r.level);
    if (onGround) ground += e[2];
    const a = route.nodeIds[i], b = route.nodeIds[i+1];
    if (!onGround || !Number.isFinite(data.elevations[a]) || !Number.isFinite(data.elevations[b])) { flush(); return; }
    covered += e[2];
    if (!run.length) run.push({m:route.cumulative[i],h:data.elevations[a]});
    run.push({m:route.cumulative[i+1],h:data.elevations[b]});
  }); flush();
  let ascent=0, descent=0, maxGrade=0, sampledIntervals=0; const climbs=[];
  runs.forEach(raw => {
    const profile=[raw[0]]; let index=1;
    for(let m=raw[0].m+40;m<raw.at(-1).m;m+=40) {
      while(index<raw.length-1 && raw[index].m<m) index++;
      const a=raw[index-1],b=raw[index],t=(m-a.m)/(b.m-a.m||1);
      profile.push({m,h:a.h+(b.h-a.h)*t});
    }
    if(raw.at(-1).m-profile.at(-1).m>=20) profile.push(raw.at(-1));
    sampledIntervals += profile.length - 1;
    // 2 m reversal hysteresis reduces contour interpolation jitter in total gain.
    let low=profile[0].h,high=low,direction=0;
    profile.forEach(p=>{
      if(direction>=0) {
        high=Math.max(high,p.h);
        if(high-p.h>=2) { ascent+=Math.max(0,high-low); low=p.h; direction=-1; }
      } else {
        low=Math.min(low,p.h);
        if(p.h-low>=2) { descent+=Math.max(0,high-low); high=p.h; direction=1; }
      }
    });
    if(direction>=0 && high-low>=2) ascent+=high-low;
    if(direction<0 && high-low>=2) descent+=high-low;
    let climb=null;
    const finish=()=>{if(climb && climb.rise>=3 && climb.end-climb.start>=60) climbs.push(climb);climb=null;};
    for(let i=1;i<profile.length;i++) {
      const a=profile[i-1],b=profile[i],rise=b.h-a.h,grade=rise/(b.m-a.m)*100;
      maxGrade=Math.max(maxGrade,Math.abs(grade));
      if(grade>=2) { if(!climb) climb={start:a.m,end:b.m,rise:0,maxGrade:0};climb.end=b.m;climb.rise+=rise;climb.maxGrade=Math.max(climb.maxGrade,grade); }
      else finish();
    } finish();
  });
  const score=sampledIntervals ? Math.min(100,50*Math.min(ascent/100,1)+30*Math.min(maxGrade/10,1)+20*Math.min(climbs.length/5,1)) : null;
  return {ascent:sampledIntervals?ascent:null,descent:sampledIntervals?descent:null,maxGrade:sampledIntervals?maxGrade:null,climbs,score,coverage:Math.min(1,covered/route.length),groundCoverage:ground?covered/ground:0,eligible:ground>0 && covered/ground>=0.8 && score!==null};
}
function hillSummary(route) {
 const h=route.indicators.hill,pct=Math.round(h.coverage*100);
 const value=v=>v===null?"Unknown":v.toFixed(1);
 return `<details class="hill-details"><summary>Estimated hills · ${h.score===null?"Unknown":Math.round(h.score)+"/100"} intensity</summary><p>Ascent ${value(h.ascent)} m · Descent ${value(h.descent)} m · Maximum sampled gradient ${value(h.maxGrade)}% · ${h.score===null?"Unknown":h.climbs.length} major climbs</p><p>Ground-data coverage ${Math.round(h.groundCoverage*100)}%; ${pct}% of the entire route. ${h.eligible?"Available for hill preferences.":"Insufficient coverage for hill preferences."} Values describe covered ground sections only; bridges and tunnels are excluded.</p><p>2002 contour estimates, resampled every 40 m; 2 m reversal threshold for elevation gain. Major climbs: at least 3 m rise, 60 m length and 2% sampled gradient. Score = 50 × min(ascent/100 m, 1) + 30 × min(maximum absolute gradient/10%, 1) + 20 × min(climbs/5, 1). These are demonstration weights, not an official BCC rating.</p>${h.climbs.map((c,i)=>`<p>Climb ${i+1}: ${(c.start/1000).toFixed(2)}–${(c.end/1000).toFixed(2)} km · ${c.rise.toFixed(1)} m rise · up to ${c.maxGrade.toFixed(1)}%</p>`).join("")}</details>`;
}
