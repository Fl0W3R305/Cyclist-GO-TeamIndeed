/* Person 5 — ride module. See TEAM_ALLOCATION.md. */
function startRide() {
  if (!current()) return;
  $("toast").hidden = true;
  state.undo = null;
  state.progress = 0;
  state.rideReportCount = 0;
  state.filter = "all";
  showView("ride");
  $("ride-title").textContent = current().name + " ride";
  drawRoutes();
  fit();
  if (state.map) {
    state.rider?.remove();
    state.rider = L.marker(current().points[0], {
      icon: L.divIcon({
        className: "rider-pin",
        html: "↑",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
      zIndexOffset: 1000,
      title: "Simulated rider position",
    }).addTo(state.map);
  }
  updateRide();
}
function updateRide() {
  const r = current();
  if (!r) return;
  const remaining = r.length * (1 - state.progress);
  $("remaining-min").textContent =
    remaining > 0 ? Math.ceil(r.minutes * (1 - state.progress)) : 0;
  $("remaining-km").textContent = (remaining / 1000).toFixed(1);
  $("ride-progress").value = state.progress;
  $("ride-road").textContent =
    `${(r.km * state.progress).toFixed(1)} of ${r.km.toFixed(1)} km · ${r.name.toLowerCase()} route`;
  state.rider?.setLatLng(D.pointAt(r, state.progress));
  const next = routeHazards().find(
    (h) => h.fraction >= state.progress && !["gone", "ignored"].includes(state.votes[h.id]),
  );
  if (next) {
    const t = hazardType(next);
    $("next-hazard").innerHTML =
      `<button data-hazard="${next.id}"><b>${t.icon} ${t.name} · ${Math.max(0, Math.round((next.fraction - state.progress) * r.length))} m ahead</b><small>${next.kind === "potential" ? "Potential risk" : "Reported hazard"} · ${next.sample ? "sample scenario" : "your report"} · Tap for details</small></button>`;
  } else
    $("next-hazard").textContent = "No more demo hazards ahead on this route.";
  $("advance-ride").disabled = state.progress >= 1;
  $("play-ride").disabled = state.progress >= 1;
  $("report-button").disabled = Boolean(state.timer);
  $("complete-paused-report").disabled = Boolean(state.timer);
  $("report-button").textContent = state.timer ? "Pause before recording a hazard" : "＋ Save location for later report";
  if (state.progress >= 1) {
    pause();
    $("ride-title").textContent = "You’ve arrived.";
    $("finish-ride").textContent = "Finish & view summary";
  } else $("finish-ride").textContent = "End demo ride";
}
function advance(m) {
  state.progress = Math.min(1, state.progress + m / current().length);
  updateRide();
}
function pause() {
  clearInterval(state.timer);
  state.timer = null;
  $("play-ride").textContent = "▶ Play simulation";
  $("report-button").disabled = false;
  $("complete-paused-report").disabled = false;
  $("report-button").textContent = "＋ Save location for later report";
}
function play() {
  if (state.timer) {
    pause();
    return;
  }
  if (state.progress >= 1) return;
  $("play-ride").textContent = "Ⅱ Pause simulation";
  state.timer = setInterval(() => advance((15000 / 3600) * 30), 1000);
  updateRide();
}
function finishRide() {
  pause();
  showView("summary");
  renderSummary();
}
function renderSummary() {
  $("summary-content").innerHTML =
    `<p><span class="summary-number">${(current().km * state.progress).toFixed(1)} km</span><br>Simulated distance travelled</p><p><b>${state.rideReportCount}</b> report${state.rideReportCount === 1 ? "" : "s"} added during this ride.<br>${storageOK ? "Your reports are saved in this browser." : "Reports will only remain in this session."}</p><p class="muted">${state.progress >= 1 ? "Destination reached." : "Ride ended before the destination."} This was a simulation, not a recorded real ride.</p><h2>Locations saved for later</h2>${state.drafts.filter(d => d.destination === state.destination && d.signature === current().signature).map(d => `<p>${(d.fraction*current().km).toFixed(2)} km along this route <button class="secondary" data-complete-draft="${d.id}">Complete report</button> <button class="text-button" data-discard-draft="${d.id}">Discard</button></p>`).join("") || "<p>No pending locations on this route.</p>"}<h2>Review hazards after your ride</h2>${routeHazards().filter(h => state.votes[h.id] !== "ignored").map(h => `<p><button class="secondary" data-hazard="${h.id}">${hazardType(h).name} · ${h.sample ? "Sample scenario" : "Your report"}</button></p>`).join("")}`;
}
function setupRide() {
  $("start-ride").addEventListener("click", () => {
    if (current()) startRide();
  });
  $("play-ride").addEventListener("click", play);
  $("advance-ride").addEventListener("click", () => advance(200));
  $("finish-ride").addEventListener("click", finishRide);
  $("ride-again").addEventListener("click", () => {
    state.rider?.remove();
    state.rider = null;
    showView("plan");
    state.destination = null;
    $("destination").value = "";
    state.routes = [];
    state.samples = [];
    renderSuggestions();
    drawRoutes();
    drawEndpoints();
    fit();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  window.addEventListener("pagehide", pause);
}
