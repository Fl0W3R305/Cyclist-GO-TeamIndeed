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
  state.followRider = true;
  followRider();
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
  if (state.map && !state.map._hazardNoticeTracking) {
    state.map._hazardNoticeTracking = true;
    state.map.on('move zoom resize', queueHazardNotice);
    window.addEventListener('resize', queueHazardNotice);
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
  if (state.followRider) followRider();
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
  $("report-button").textContent = state.timer ? "Pause before recording a hazard" : "＋ Save hazard location";
  if (state.progress >= 1) {
    pause();
    $("ride-title").textContent = "You’ve arrived.";
    $("finish-ride").textContent = "Finish & view summary";
  } else $("finish-ride").textContent = "End demo ride";
  queueHazardNotice();
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
  $("report-button").textContent = "＋ Save hazard location";
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

function followRider() {
  if (!state.map || !current() || state.view !== "ride") return;
  state.followRider = true;
  state.map.setView(D.pointAt(current(), state.progress), 16, {animate: false});
  $("fit").textContent = "⌖ Following rider";
}

// Keep the notice near the rider, with space around markers and map controls.
let hazardNoticeFrame = null;
function queueHazardNotice() {
  if (hazardNoticeFrame !== null) cancelAnimationFrame(hazardNoticeFrame);
  hazardNoticeFrame = requestAnimationFrame(() => {
    hazardNoticeFrame = null;
    positionHazardNotice();
  });
}
function chooseHazardNoticePosition(x, y, width, height, bounds, obstacles) {
  const gap = 38, inset = 10;
  const clamp = (v, max) => Math.max(inset, Math.min(v, max - inset));
  const candidates = [
    [x-width/2, y-gap-height], [x-width/2, y+gap],
    [x+gap, y-height/2], [x-gap-width, y-height/2],
  ].map(([left,top]) => [clamp(left,bounds.width-width),clamp(top,bounds.height-height)]);
  // If the nearby positions are occupied, try other clear positions in the map.
  const extra = [];
  for (let top=inset; top+height<=bounds.height-inset; top+=24)
    for (let left=inset; left+width<=bounds.width-inset; left+=24)
      extra.push([left,top]);
  extra.sort((a,b) => Math.hypot(a[0]+width/2-x,a[1]+height/2-y)-Math.hypot(b[0]+width/2-x,b[1]+height/2-y));
  return [...candidates,...extra].find(([left,top]) =>
    left>=inset && top>=inset && left+width<=bounds.width-inset && top+height<=bounds.height-inset &&
    !obstacles.some(r => left<r.right && left+width>r.left && top<r.bottom && top+height>r.top)
  );
}
function positionHazardNotice() {
  if (state.view !== 'ride' || !state.map || !state.rider) return;
  const notice = $('next-hazard'), map = state.map.getContainer();
  const bounds = map.getBoundingClientRect();
  const point = state.map.latLngToContainerPoint(state.rider.getLatLng());
  const obstacles = [...map.querySelectorAll('.leaflet-marker-icon, .leaflet-control'),
    ...map.parentElement.querySelectorAll('.map-top > *')].map(node => {
      const r = node.getBoundingClientRect();
      return {left:r.left-bounds.left-10, top:r.top-bounds.top-10,
        right:r.right-bounds.left+10, bottom:r.bottom-bounds.top+10};
    });
  obstacles.push({left:point.x-30,top:point.y-30,right:point.x+30,bottom:point.y+30});
  notice.style.position = 'absolute';
  const position = chooseHazardNoticePosition(point.x, point.y, notice.offsetWidth, notice.offsetHeight, bounds, obstacles);
  if (!position) {
    // A crowded or very small map: keep the message readable in the ride panel.
    notice.style.position = 'static';
    return;
  }
  const parent = notice.offsetParent.getBoundingClientRect();
  notice.style.left = (bounds.left-parent.left+position[0])+'px';
  notice.style.top = (bounds.top-parent.top+position[1])+'px';
}
