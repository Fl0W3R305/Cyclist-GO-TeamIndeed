"use strict";
const $ = (id) => document.getElementById(id);
const D = RideData;
const STORE = "cyclist-go-bcc-reports-v1",
  VOTES = "cyclist-go-bcc-feedback-v1";
let storageOK = true;
/* Person 1 — core module. See TEAM_ALLOCATION.md. */
function readSaved(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    storageOK = false;
    return fallback;
  }
}
function validReport(h) {
  return (
    h &&
    typeof h.id === "string" &&
    /^[a-z0-9-]+$/.test(h.id) &&
    D.types.some((t) => t.id === h.type) &&
    ["reported", "potential"].includes(h.kind) &&
    Array.isArray(h.point) &&
    h.point.length === 2 &&
    h.point.every(Number.isFinite) &&
    typeof h.note === "string" &&
    typeof h.severity === "string" &&
    Number.isFinite(h.created) &&
    !h.sample
  );
}
function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(state.reports));
    localStorage.setItem(VOTES, JSON.stringify(state.votes));
    return true;
  } catch {
    storageOK = false;
    return false;
  }
}
function toast(text, undo = null) {
  state.undo = undo;
  $("toast-text").textContent = text;
  $("toast").hidden = false;
  $("undo-report").hidden = !undo;
}
function current() {
  return state.routes.find((r) => r.id === state.selected);
}
function dest() {
  return D.destinations.find((d) => d.id === state.destination);
}
function showView(view) {
  state.view = view;
  document.dispatchEvent(new Event("cyclist:view"));
  ["plan", "compare", "ride", "summary"].forEach(
    (v) => ($(v + "-view").hidden = v !== view),
  );
  document
    .querySelectorAll("[data-step]")
    .forEach((el) =>
      el.classList.toggle(
        "active",
        el.dataset.step === (view === "summary" ? "ride" : view),
      ),
    );
  document
    .querySelectorAll(".destination-label")
    .forEach(
      (el) =>
        (el.textContent = dest() ? `Indooroopilly → ${dest().name}` : ""),
    );
  document
    .querySelector(".map-section")
    .classList.toggle("riding-map", view === "ride");
  $("map-label").textContent =
    view === "ride" ? "SIMULATED RIDE" : "BRISBANE, QLD";
  document.body.classList.toggle("riding-mode", view === "ride");
  document.querySelector(".planner").scrollTop = 0;
  $("fit").textContent = view === "ride" ? "⌖ Following rider" : "⌖ Fit route";
  setTimeout(() => { state.map?.invalidateSize(); if (current()) { if (state.view === "ride") followRider(); else fit(); } }, 0);
}
const stored = readSaved(STORE, []),
  votes = readSaved(VOTES, {});
const state = {
  view: "plan",
  destination: null,
  routes: [],
  selected: "safe",
  filter: "all",
  map: null,
  routeLayers: [],
  samples: [],
  reports: Array.isArray(stored) ? stored.filter(validReport) : [],
  votes:
    votes && typeof votes === "object" && !Array.isArray(votes) ? votes : {},
  progress: 0,
  timer: null,
  rider: null,
  reportType: null,
  reportFraction: 0,
  draftId: null,
  reportPoint: null,
  undo: null,
  rideReportCount: 0,
  bikeways: null,
  bccLoading: false,
  bccLoaded: false,
};
const escapeHTML = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
