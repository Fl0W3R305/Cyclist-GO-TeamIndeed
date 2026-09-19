function sampleHazards(routes, destination) {
  const seeds = {
    safe: [
      [
        "debris",
        "reported",
        0.32,
        "Caution",
        "Loose material near the path edge.",
      ],
      [
        "traffic",
        "potential",
        0.64,
        "Slow down",
        "An example of a busy crossing: check both directions.",
      ],
    ],
    fast: [
      [
        "pothole",
        "reported",
        0.26,
        "Slow down",
        "Uneven surface on the approach.",
      ],
      [
        "works",
        "reported",
        0.51,
        "Caution",
        "Example work zone narrowing the available space.",
      ],
      [
        "traffic",
        "potential",
        0.76,
        "Slow down",
        "Turning traffic may cross the cycle line.",
      ],
    ],
    scenic: [
      [
        "debris",
        "reported",
        0.38,
        "Caution",
        "Small branches beside the path.",
      ],
      [
        "slippery",
        "potential",
        0.59,
        "Slow down",
        "A shaded section could remain slippery after rain.",
      ],
      [
        "traffic",
        "potential",
        0.83,
        "Caution",
        "Shared path: expect pedestrians around the bend.",
      ],
    ],
  };
  return routes.flatMap((r) =>
    seeds[r.id].map(([type, kind, fraction, severity, note], i) => ({
      id: `sample-${destination}-${r.id}-${i}`,
      type,
      kind,
      fraction,
      severity,
      note,
      point: D.pointAt(r, fraction),
      routeId: r.id,
      destination,
      sample: true,
      created: 0,
    })),
  );
}

/* Person 4 — hazards module. See TEAM_ALLOCATION.md. */
function routeHazards(route = current()) {
  if (!route) return [];
  const samples = state.samples.filter((h) => h.routeId === route.id);
  const reports = state.reports
    .map((h) => ({ ...h, ...D.nearest(route, h.point) }))
    .filter((h) => h.distance <= 35);
  return [...samples, ...reports].sort((a, b) => a.fraction - b.fraction);
}
function visibleHazards() {
  return routeHazards().filter(
    (h) => state.filter === "all" || h.kind === state.filter,
  );
}
function hazardType(h) {
  return D.types.find((t) => t.id === h.type);
}
function renderHazards() {
  const hs = visibleHazards();
  $("hazard-list").innerHTML = hs.length
    ? hs
        .map((h) => {
          const t = hazardType(h);
          return `<button class="hazard-row" data-hazard="${h.id}"><span class="hazard-icon ${h.kind}" aria-hidden="true">${t.icon}</span><span><strong>${t.name}</strong> <span class="status-label ${h.kind}">${h.kind === "potential" ? "Potential" : "Reported"}</span><small>${h.sample ? "Sample scenario" : "Your report"} · ${(h.fraction * current().km).toFixed(1)} km from start<br>${escapeHTML(h.severity)}${state.votes[h.id] ? " · Feedback saved" : ""}</small></span><span class="chevron">›</span></button>`;
        })
        .join("")
    : '<p class="empty">No hazards in this filter.<br>You can still explore the route on the map.</p>';
  document
    .querySelectorAll("[data-filter]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.filter === state.filter)),
    );
  drawHazards();
}
function findHazard(id) {
  return routeHazards().find((h) => h.id === id);
}
function openHazard(id) {
  const h = findHazard(id);
  if (!h) return;
  pause();
  const t = hazardType(h);
  $("hazard-title").textContent = t.name;
  $("hazard-dialog-content").innerHTML =
    `<div class="hazard-detail-body"><p class="status-label ${h.kind}">${h.kind === "potential" ? "◌ Potential risk" : "● Reported hazard"} · ${h.sample ? "Sample scenario" : "Your local report"}</p><p>${escapeHTML(h.note || "No extra details added.")}</p><p><b>${escapeHTML(h.severity)}</b><br>${(h.fraction * current().km).toFixed(1)} km from the start · ${h.sample ? "Illustrative location" : new Date(h.created).toLocaleString()}</p><p class="muted">${h.kind === "potential" ? "A possible risk, not a confirmed incident." : "An observation, not an independently verified incident."}</p><div class="feedback-actions"><button data-vote="here" data-id="${h.id}" aria-pressed="${state.votes[h.id] === "here"}">${h.kind === "potential" ? "Useful warning" : "Still here"}</button><button data-vote="gone" data-id="${h.id}" aria-pressed="${state.votes[h.id] === "gone"}">${h.kind === "potential" ? "Not relevant" : "No longer here"}</button></div><p class="muted">Feedback stays on this browser.${h.sample ? " This is demonstration data." : ""}</p>${!h.sample ? `<button class="text-button" data-delete="${h.id}">Delete my report</button>` : ""}</div>`;
  if (!$("hazard-dialog").open) $("hazard-dialog").showModal();
  state.map?.panTo(h.point);
}
function renderTypes() {
  const html = (forDialog) =>
    D.types
      .map(
        (t) =>
          `<button class="type-button" data-${forDialog ? "report" : "quick"}-type="${t.id}" ${forDialog ? `aria-pressed="${state.reportType === t.id}"` : ""}><span class="type-symbol" aria-hidden="true">${t.icon}</span>${t.name}</button>`,
      )
      .join("");
  $("quick-types").innerHTML = html(false);
  $("report-types").innerHTML = html(true);
}
function openReport(type = null) {
  if (state.view !== "ride") return;
  pause();
  state.reportType = type;
  state.reportFraction = state.progress;
  $("report-position").value = Math.round(state.progress * 1000);
  $("report-kind").value = "reported";
  $("report-severity").value = "Caution";
  $("report-note").value = "";
  document.querySelector(".report-details").open = false;
  updateReport();
  $("report-dialog").showModal();
}
function updateReport() {
  renderTypes();
  const p = D.pointAt(current(), state.reportFraction);
  $("report-location").textContent =
    `${(state.reportFraction * current().km).toFixed(1)} km along route · ${p[0].toFixed(5)}, ${p[1].toFixed(5)}`;
  document.querySelector(".location-row strong").textContent =
    Math.abs(state.reportFraction - state.progress) < 0.002
      ? "At your demo position"
      : "At your chosen route position";
  $("submit-report").disabled = !state.reportType;
  $("submit-report").textContent = state.reportType
    ? `Report ${D.types.find((t) => t.id === state.reportType).name.toLowerCase()} here`
    : "Select a hazard above";
}
function submitReport() {
  if (!state.reportType || state.view !== "ride") return;
  const h = {
    id: "local-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    type: state.reportType,
    kind: $("report-kind").value,
    severity: $("report-severity").value,
    note: $("report-note").value.trim().slice(0, 180),
    point: D.pointAt(current(), state.reportFraction),
    created: Date.now(),
    destination: state.destination,
    routeId: state.selected,
    sample: false,
  };
  state.reports.push(h);
  state.rideReportCount++;
  const saved = save();
  $("report-dialog").close();
  drawHazards();
  updateRide();
  toast(
    saved
      ? "Hazard added at the selected route position."
      : "Hazard added for this session. Browser storage is unavailable.",
    h.id,
  );
}
function setupHazards() {
  document.querySelectorAll("[data-filter]").forEach((b) =>
    b.addEventListener("click", () => {
      state.filter = b.dataset.filter;
      renderHazards();
    }),
  );
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-hazard]");
    if (b) openHazard(b.dataset.hazard);
    const quick = e.target.closest("[data-quick-type]");
    if (quick) openReport(quick.dataset.quickType);
    const report = e.target.closest("[data-report-type]");
    if (report) {
      state.reportType = report.dataset.reportType;
      updateReport();
    }
    const vote = e.target.closest("[data-vote]");
    if (vote) {
      state.votes[vote.dataset.id] = vote.dataset.vote;
      const saved = save();
      openHazard(vote.dataset.id);
      renderHazards();
      if (state.view === "ride") updateRide();
      toast(
        saved
          ? "Feedback saved on this browser."
          : "Feedback saved for this session only.",
      );
    }
    const del = e.target.closest("[data-delete]");
    if (del) {
      state.reports = state.reports.filter((h) => h.id !== del.dataset.delete);
      save();
      $("hazard-dialog").close();
      renderCards();
      renderHazards();
      if (state.view === "ride") updateRide();
      toast("Your report was deleted.");
    }
  });
  $("report-button").addEventListener("click", () => openReport());
  $("report-position").addEventListener("input", () => {
    state.reportFraction = Number($("report-position").value) / 1000;
    updateReport();
  });
  $("submit-report").addEventListener("click", submitReport);
  $("undo-report").addEventListener("click", () => {
    state.reports = state.reports.filter((h) => h.id !== state.undo);
    state.rideReportCount = Math.max(0, state.rideReportCount - 1);
    save();
    renderCards();
    renderHazards();
    if (state.view === "ride") updateRide();
    toast("Report removed.");
  });
  renderTypes();
}
