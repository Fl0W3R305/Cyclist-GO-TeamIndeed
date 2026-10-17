/* Optional verification: npm install --no-save jsdom && node tests.cjs */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { JSDOM } = require("jsdom");
const root = path.join(__dirname, "dist");
const dom = new JSDOM(fs.readFileSync(path.join(root, "index.html"), "utf8"), {
    runScripts: "outside-only",
    url: "https://cyclist-bcc.test/",
  }),
  w = dom.window;
w.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
w.HTMLDialogElement.prototype.close = function () {
  this.open = false;
};
Object.defineProperty(w.HTMLElement.prototype, "clientWidth", {
  get() {
    return 900;
  },
});
Object.defineProperty(w.HTMLElement.prototype, "clientHeight", {
  get() {
    return 650;
  },
});
w.eval(fs.readFileSync(path.join(root, "vendor/leaflet.js"), "utf8"));
w.L.Browser.svg = true;
w.L.Browser.canvas = false;
const files = [
  "data/bcc-data.js",
  "routes.js",
  "core.js",
  "planner.js",
  "data/clean-basemap.js",
  "clean-map.js",
  "map.js",
  "hazards.js",
  "ride.js",
  "preferences.js",
  "app.js",
  "auth.js",
  "saved.js",
  "community.js",
];
w.eval(
  files.map((f) => fs.readFileSync(path.join(root, f), "utf8")).join("\n") +
    "\nwindow.testAPI={state,Preferences,applyPreferences,openHazard,advance,pause};",
);
const $ = (id) => w.document.getElementById(id),
  click = (sel) => {
    const el = w.document.querySelector(sel);
    assert.ok(el, sel);
    el.click();
  },
  input = (id, value) => {
    $(id).value = value;
    $(id).dispatchEvent(new w.Event("input", { bubbles: true }));
  };
const data = w.BCC_DATA,
  P = w.testAPI.Preferences;
// Verify the saved path against the downloaded route geometry, not only its source label.
for (const [key, paths] of Object.entries(data.preparedRoutes)) {
  for (const route of paths) {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'scripts/route-snapshots', `osm-${key}-${route.alternative}.geojson`), 'utf8')).features[0];
    assert.deepEqual(JSON.parse(JSON.stringify(route.nodeIds.map(i=>data.nodes[i]))), raw.geometry.coordinates.map(p=>[p[1],p[0]]));
    assert.ok(raw.properties.messages.slice(1).every(m=>!m[9].includes('route=ferry') && !m[9].includes('highway=steps')));
  }
}
assert.ok(data.meta.startOffset <= 5);
assert.ok(data.destinations.every(d => d.offset < 100));
const bridgeRecords = data.records.filter(r=>r.osmTags?.bridge && r.osmTags.bridge !== 'no');
assert.ok(bridgeRecords.some(r=>r.osmTags.name === 'Eleanor Schonell Bridge'));
assert.ok(bridgeRecords.some(r=>r.osmTags.name === 'Go Between Bridge'));
assert.ok(bridgeRecords.every(r=>r.level === 'ON STRUCTURE'));
for (const d of w.RideData.destinations) {
  const routes = P.evaluate(w.RideData.buildRoutes(d.id));
  assert.equal(new Set(routes.map(r=>r.signature)).size, 3, "Three distinct paths per destination");
  assert.equal(new Set(routes.map(r=>r.color)).size, 3);
  for (const r of routes) {
    assert.ok(r.km > 0);
    assert.equal(r.nodeIds[0], data.start);
    assert.equal(r.nodeIds.at(-1), d.node);
    assert.equal(r.edgeIds.length + 1, r.nodeIds.length);
    assert.equal(new Set(r.nodeIds).size, r.nodeIds.length, "No cycling loops");
    r.edgeIds.forEach((ei, i) => {
      const e = data.edges[ei],
        a = r.nodeIds[i],
        b = r.nodeIds[i + 1];
      assert.ok(
        (e[0] === a && e[1] === b) || (e[1] === a && e[0] === b),
        "Every step follows a saved OSM route edge",
      );
      assert.equal(e[5], "osm");
      assert.ok(["assets", "osm"].includes(data.records[e[3]].dataset));
    });
    assert.ok(r.length <= routes.find((r) => r.id === "fast").length * 2.2);
    assert.ok(r.known <= 1.001);
    assert.ok(r.indicators.terrain === null || r.indicators.terrain >= 0);
  }
  console.log(
    d.id,
    routes.map((r) => ({
      mode: r.id,
      km: +r.km.toFixed(2),
      matches: r.preferenceMatches,
    })),
  );
}
assert.equal($("plan-view").hidden, false);
input("destination", "Invalid place");
$("planner-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
assert.equal($("form-error").hidden, false);
input("destination", "South Bank");
click('[data-destination="southbank"]');
assert.equal(w.document.querySelectorAll('[data-destination]').length, 3);
click('[data-destination="cityhall"]');
assert.equal(w.document.querySelectorAll('[data-destination]').length, 3);
assert.equal(w.document.querySelector('.suggestion.chosen').dataset.destination, 'cityhall');
click('[data-destination="southbank"]');
$("planner-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
assert.equal($("compare-view").hidden, false);
assert.equal(w.document.querySelectorAll(".route-card").length, 3);
assert.ok($("route-detail").textContent.includes("BCC"));
click('#compare-view [data-preference="protected"]');
assert.ok(P.selected.has("protected"));
assert.ok(
  w.document.querySelector('#plan-view [data-preference="protected"]').checked,
);
assert.ok(
  w.testAPI.state.routes.filter(P.accepts).every((r) => r.bikeway > 0),
);
assert.ok(!P.definitions.some(d => d.id === "crossings"));
assert.equal(w.document.querySelector('[data-preference="crossings"]'), null);
P.selected.clear();
P.render();
w.testAPI.applyPreferences();
click('[data-route="scenic"]');
assert.equal(w.testAPI.state.selected, "scenic");
click('[data-filter="potential"]');
assert.equal(w.document.querySelectorAll(".hazard-row").length, 2);
click(".hazard-row");
assert.ok($("hazard-dialog").open);
click('[data-vote="here"]');
click('[data-close="hazard-dialog"]');
click("#start-ride");
assert.equal($("ride-view").hidden, false);
click("#advance-ride");
assert.ok($("ride-progress").value > 0);
click("#report-button");
assert.equal(w.testAPI.state.drafts.length, 1);
click("#finish-ride");
click("[data-complete-draft]");
click('[data-quick-type="debris"]');
assert.ok($("report-dialog").open);
input("report-note", "<img src=x onerror=alert(1)>");
click("#submit-report");
let reports = JSON.parse(w.localStorage.getItem("cyclist-go-bcc-reports-v1"));
assert.equal(reports.length, 1);
assert.ok(
  w.RideData.nearest(
    w.testAPI.state.routes.find((r) => r.id === "scenic"),
    reports[0].point,
  ).distance < 0.01,
);
w.testAPI.openHazard(reports[0].id);
assert.equal($("hazard-dialog-content").querySelector("img"), null);
click('[data-close="hazard-dialog"]');
click("#undo-report");
assert.equal(
  JSON.parse(w.localStorage.getItem("cyclist-go-bcc-reports-v1")).length,
  0,
);
click("#summary-report");
assert.ok($("submit-report").disabled);
click('[data-report-type="slippery"]');
$("report-kind").value = "potential";
input("report-position", "700");
click("#submit-report");
reports = JSON.parse(w.localStorage.getItem("cyclist-go-bcc-reports-v1"));
assert.equal(reports[0].kind, "potential");
assert.ok(
  Math.abs(
    w.RideData.nearest(
      w.testAPI.state.routes.find((r) => r.id === "scenic"),
      reports[0].point,
    ).fraction - 0.7,
) < 0.001,
);
// Return to riding before testing simulation controls.
w.eval('startRide()');
click("#play-ride");
assert.match($("play-ride").textContent, /Pause/);
click("#play-ride");
assert.match($("play-ride").textContent, /Play/);
w.testAPI.advance(100000);
assert.equal($("ride-progress").value, 1);
assert.ok($("play-ride").disabled);
click("#finish-ride");
assert.equal($("summary-view").hidden, false);
click("#ride-again");
assert.equal($("plan-view").hidden, false);
input("destination", "UQ");
click('[data-destination="uq"]');
$("planner-form").dispatchEvent(new w.Event("submit", { cancelable: true }));
assert.equal($("compare-view").hidden, false);
assert.match($("preference-results").textContent, /distinct path/);
click("#start-ride");
assert.equal($("ride-progress").value, 0);
w.testAPI.pause();
// Both hill controls remain synchronised and mutually exclusive.
click('#compare-view [data-preference="hills"]');
click('#compare-view [data-preference="training"]');
assert.ok(P.selected.has('training'));
assert.ok(!P.selected.has('hills'));
P.selected.clear(); P.render();
// Hill metrics must not infer height across a missing-ground-data gap.
const originalData = w.BCC_DATA;
w.BCC_DATA = {
  nodes: [[0,0],[0,1],[0,2],[0,3]], elevations: [0,5,null,20],
  edges: [[0,1,100,0],[1,2,100,0],[2,3,100,0]],
  records: [{level:'ON GROUND'}]
};
const partial = w.eval('hillMetrics({edgeIds:[0,1,2],nodeIds:[0,1,2,3],cumulative:[0,100,200,300],length:300})');
assert.equal(partial.eligible,false);
assert.ok(partial.ascent <= 5, 'Missing elevation cannot add ascent');
assert.ok(Math.abs(partial.coverage-1/3)<1e-6);
w.BCC_DATA = originalData;
// Local ignore and added observations persist without deleting source hazards.
w.eval('showView("compare"); applyPreferences()');
click('.hazard-row');
const ignoredId = w.document.querySelector('[data-vote="ignored"]').dataset.id;
input('hazard-extra-note','Observed after stopping');
click('[data-observation]');
assert.equal(JSON.parse(w.localStorage.getItem('cyclist-go-bcc-feedback-v1'))[ignoredId+'-note'],'Observed after stopping');
click('[data-vote="ignored"]');
assert.equal(w.testAPI.state.votes[ignoredId],'ignored');
click('#restore-ignored');
assert.notEqual(w.testAPI.state.votes[ignoredId],'ignored');
// Navigation follows the rider, permits manual exploration, and completes saved reports at the end.
w.eval('startRide()');
assert.equal($("complete-paused-report"), null);
assert.equal(w.testAPI.state.map.getZoom(), 16);
w.testAPI.advance(200);
assert.ok(w.testAPI.state.map.getCenter().distanceTo(w.testAPI.state.rider.getLatLng()) < 5);
w.testAPI.state.map.fire('dragstart');
assert.equal(w.testAPI.state.followRider, false);
click('#fit');
assert.equal(w.testAPI.state.followRider, true);
const draftCountBefore = w.testAPI.state.drafts.length;
click('#report-button');
assert.equal(w.testAPI.state.drafts.length, draftCountBefore + 1);
click('#finish-ride');
click('[data-complete-draft]');
click('[data-report-type="debris"]');
input('report-note', 'Saved during ride, completed afterwards');
click('#submit-report');
assert.equal(w.testAPI.state.drafts.length, draftCountBefore);
assert.ok(w.testAPI.state.reports.some(r => r.note === 'Saved during ride, completed afterwards'));
assert.equal(w.document.querySelectorAll('#about-dialog details').length,20);
// Saved routes: full snapshot, guest gate and account separation.
(async () => {
Object.defineProperty(w, 'crypto', {value:require('node:crypto').webcrypto});
w.TextEncoder = TextEncoder;
click('#nav-community');
assert.equal($('community-page').hidden,false);
assert.equal(w.document.querySelectorAll('.community-post').length,2);
assert.equal($('community-post-form').hidden,true);
click('[data-like="sample-uq-path"]');
assert.equal($('demo-auth-dialog').open,true,'guest interaction opens login');
$('demo-auth-dialog').close();$('demo-auth-dialog').dispatchEvent(new w.Event('close'));
click('#nav-mvp');assert.equal($('community-page').hidden,true);
click('#nav-saved');
assert.equal($('saved-login').hidden,false);
assert.equal(w.document.querySelectorAll('.saved-row').length,0);
click('#nav-mvp');
w.eval('showView("plan"); chooseDestination("uq"); window.testAPI.Preferences.selected.clear(); plan(); selectRoute("scenic"); startRide(); advance(200); finishRide()');
const original=JSON.parse(JSON.stringify(w.testAPI.state.routes.find(r=>r.id==='scenic')));
click('#save-route');
assert.equal($('demo-auth-dialog').open,true);
assert.equal(w.localStorage.getItem('cyclist-go-saved-routes-v1:guest'),null);
click('#demo-auth-switch');
input('demo-name','Test Rider');input('demo-email','one@test.com');input('demo-password','testpass123');input('demo-confirm','testpass123');
$('demo-auth-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
for(let i=0;i<100 && $('demo-auth-submit').disabled;i++) await new Promise(r=>setTimeout(r,10));
assert.equal($('demo-auth-error').hidden,true,$('demo-auth-error').textContent);
click('#nav-community');
assert.equal($('community-post-form').hidden,false,'logged in user can create posts');
click('[data-like="sample-uq-path"]');
assert.ok(JSON.parse(w.localStorage.getItem('cyclist-go-community-v1')).find(p=>p.id==='sample-uq-path').likes.includes('one@test.com'));
click('[data-comments="sample-uq-path"]');
input('comment-sample-uq-path','Please take care near the crossing.');
click('[data-comment-form="sample-uq-path"] button[type="submit"]');
assert.equal(JSON.parse(w.localStorage.getItem('cyclist-go-community-v1')).find(p=>p.id==='sample-uq-path').comments.length,1);
input('community-post-title','Useful route update');input('community-post-body','<img src=x onerror=alert(1)> Keep left on the shared path.');
$('community-post-category').value='Route tip';$('community-post-confirm').checked=true;
$('community-post-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
assert.ok(JSON.parse(w.localStorage.getItem('cyclist-go-community-v1')).some(p=>p.title==='Useful route update'));
assert.equal(w.document.querySelectorAll('#community-feed img').length,0,'community text is escaped');
click('#nav-mvp');
const savedKey='cyclist-go-saved-routes-v1:one@test.com';
let list=JSON.parse(w.localStorage.getItem(savedKey));
assert.equal(list.length,1);
assert.deepEqual(list[0].route,original);
click('#save-route');assert.equal(JSON.parse(w.localStorage.getItem(savedKey)).length,1);
click('#nav-saved');assert.equal(w.document.querySelectorAll('.saved-row').length,1);
click('[data-saved-tag]');input('saved-tag','<img src=x onerror=alert(1)>');
$('saved-tag-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
assert.equal(w.document.querySelectorAll('#saved-list img').length,0);
w.testAPI.Preferences.selected.add('hills');
click('[data-saved-open]');
assert.equal(w.testAPI.state.view,'compare');assert.equal(w.testAPI.state.selected,'scenic');
assert.deepEqual(JSON.parse(JSON.stringify(w.testAPI.state.routes.find(r=>r.id==='scenic'))),original);
assert.equal(w.testAPI.Preferences.selected.size,0);
assert.equal(w.testAPI.state.routeLayers.filter(l=>l instanceof w.L.Polyline).length,3);
click('#start-ride');assert.equal($('nav-saved').disabled,true);
w.eval('advance(current().length)');click('#finish-ride');click('#save-route');
assert.equal(JSON.parse(w.localStorage.getItem(savedKey)).length,1);
click('#nav-saved');click('[data-saved-remove]');assert.equal(w.document.querySelectorAll('.saved-row').length,0);
click('#undo-report');assert.equal(w.document.querySelectorAll('.saved-row').length,1);
click('#demo-account-button');click('#demo-logout');
assert.equal($('saved-login').hidden,false);assert.equal(w.document.querySelectorAll('.saved-row').length,0);
// Cancelled login must not save later during an unrelated login.
click('#nav-mvp');click('#save-route');$('demo-auth-dialog').close();
$('demo-auth-dialog').dispatchEvent(new w.Event('close'));
click('#saved-login-button');click('#demo-auth-switch');
input('demo-name','Other Rider');input('demo-email','two@test.com');input('demo-password','testpass123');input('demo-confirm','testpass123');
$('demo-auth-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
for(let i=0;i<100 && $('demo-auth-submit').disabled;i++) await new Promise(r=>setTimeout(r,10));
assert.equal(w.localStorage.getItem('cyclist-go-saved-routes-v1:two@test.com'),null);
click('#nav-saved');assert.equal(w.document.querySelectorAll('.saved-row').length,0);
w.localStorage.setItem('cyclist-go-demo-session-v1','one@test.com');w.dispatchEvent(new w.Event('storage'));
assert.equal(w.document.querySelectorAll('.saved-row').length,1);
console.log('PASS: route snapshot, early/full finish, real signup + automatic save, duplicates, labels, removal/undo, exact reopening, login gate, cancel and account separation.');
dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
