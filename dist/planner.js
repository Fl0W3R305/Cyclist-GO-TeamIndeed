/* Person 2 — destination, candidate routes and route comparison. */
function renderSuggestions() {
  const query = $("destination").value.toLowerCase().trim();
  const matches = D.destinations.filter(
    (d) =>
      !query || state.destination !== null ||
      d.name.toLowerCase().includes(query) ||
      d.aliases.includes(query),
  );
  $("suggestions").innerHTML = matches.length
    ? matches
        .map(
          (d) =>
            `<button type="button" class="suggestion ${state.destination === d.id ? "chosen" : ""}" data-destination="${d.id}" aria-pressed="${state.destination === d.id}"><span aria-hidden="true">${d.icon}</span><span><strong>${d.name}</strong><small>${d.detail}</small></span><span class="arrow">↗</span></button>`,
        )
        .join("")
    : '<p class="empty">Available arrivals: Brisbane City Hall, UQ St Lucia and South Bank. Routes end on mapped public paths near the landmarks.</p>';
}
function chooseDestination(id) {
  state.destination = id;
  $("destination").value = dest().name;
  $("form-error").hidden = true;
  renderSuggestions();
}
function plan(event) {
  event?.preventDefault();
  const query = $("destination").value.toLowerCase().trim();
  const matches = D.destinations.filter(
    (d) =>
      d.name.toLowerCase() === query ||
      d.aliases.split(" ").includes(query) ||
      d.name.toLowerCase().includes(query),
  );
  if (!query || matches.length !== 1) {
    $("form-error").textContent =
      "Select a demo destination from the list.";
    $("form-error").hidden = false;
    return;
  }
  try {
    state.destination = matches[0].id;
    state.routes = Preferences.evaluate(D.buildRoutes(state.destination));
    state.samples = sampleHazards(state.routes, state.destination);
    state.selected = "safe";
    state.filter = "all";
    showView("compare");
    applyPreferences();
    drawEndpoints();
    fit();
  } catch (e) {
    $("form-error").textContent = e.message;
    $("form-error").hidden = false;
  }
}
function renderCards() {
  $("route-cards").innerHTML = state.routes
    .filter(Preferences.accepts)
    .map((r) => {
      const hs = routeHazards(r);
      return `<button class="route-card" style="--route-color:${r.color}" data-route="${r.id}" aria-pressed="${state.selected === r.id}"><div class="card-top"><span class="route-symbol">${r.symbol}</span><h3>${r.name}</h3><span class="selection-dot"></span></div><div class="metrics">${r.minutes} <span>min</span> <span>·</span> ${r.km.toFixed(2)} <span>km</span></div><p class="card-description">${r.description}</p><p class="coverage-line"><b>${Math.round(r.bikeway*100)}% BCC bikeways</b> · ${Math.round(r.offroad*100)}% off-road</p>${r.shared.length ? `<p class="shared-route">Same path as ${r.shared.join(" / ")}</p>` : ""}<div class="card-bottom"><span>● ${hs.filter((h) => h.kind === "reported").length} reported</span><span>◌ ${hs.filter((h) => h.kind === "potential").length} potential</span><span>View details →</span></div></button>`;
    })
    .join("");
}
function renderDetail() {
  const r = current();
  if (!r) {
    $("route-detail").innerHTML =
      '<p class="empty">Adjust the route filters to see an option. Unknown traffic values never count as low traffic.</p>';
    $("hazard-list").innerHTML = "";
    $("start-ride").textContent = "No matching route";
    drawHazards();
    return;
  }
  $("route-detail").innerHTML =
    `<div class="route-detail"><strong>${r.via}</strong><p>${r.reason}</p><p>Arrival is ${dest().offset} m from the named landmark; that final connection is not included.</p><details><summary>Route calculation & access</summary><p>Saved routes follow OpenStreetMap cycling geometry prepared with BRouter. BCC bikeway attributes are conservatively matched to those paths; unmatched sections remain Unknown. BCC supplies traffic and historical ground contours. Times assume 15 km/h. Routes are a snapshot: check access and closures before travelling.</p><p>${r.uniqueCandidates} distinct saved candidates are within the detour limit. Preferences may choose the same path.</p></details></div>${Preferences.summary(r)}`;
  $("start-ride").innerHTML =
    `Start ${r.name.toLowerCase()} ride <span>→</span>`;
  renderHazards();
}
function selectRoute(id) {
  if (
    state.view !== "compare" ||
    !state.routes.some((r) => r.id === id && Preferences.accepts(r))
  )
    return;
  state.selected = id;
  state.filter = "all";
  renderCards();
  renderDetail();
  drawRoutes();
  fit();
}
function setupPlanner() {
  $("planner-form").addEventListener("submit", plan);
  $("destination").addEventListener("input", () => {
    state.destination = null;
    renderSuggestions();
    $("form-error").hidden = true;
  });
  $("suggestions").addEventListener("click", (e) => {
    const b = e.target.closest("[data-destination]");
    if (b) chooseDestination(b.dataset.destination);
  });
  $("route-cards").addEventListener("click", (e) => {
    const b = e.target.closest("[data-route]");
    if (b) selectRoute(b.dataset.route);
  });
  $("edit-destination").addEventListener("click", () => {
    showView("plan");
    $("destination").focus();
    $("destination").select();
  });
  renderSuggestions();
}
