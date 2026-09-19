/* Person 2 — BCC-only route graph and geometry helpers. No external routing service. */
(function (root) {
  "use strict";
  const data = root.BCC_DATA;
  const start = data.nodes[data.start];
  const destinations = data.destinations;
  const types = [
    { id: "pothole", name: "Pothole", icon: "⊙" },
    { id: "debris", name: "Debris", icon: "⋰" },
    { id: "works", name: "Roadworks", icon: "⚒" },
    { id: "traffic", name: "Traffic", icon: "↔" },
    { id: "slippery", name: "Slippery", icon: "≋" },
    { id: "blocked", name: "Blocked path", icon: "⊘" },
  ];
  function distance(a, b) {
    const rad = (x) => (x * Math.PI) / 180;
    const q =
      Math.sin(rad(b[0] - a[0]) / 2) ** 2 +
      Math.cos(rad(a[0])) *
        Math.cos(rad(b[0])) *
        Math.sin(rad(b[1] - a[1]) / 2) ** 2;
    return (
      6371000 * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(Math.max(0, 1 - q)))
    );
  }
  function measure(points) {
    const cumulative = [0];
    for (let i = 1; i < points.length; i++)
      cumulative.push(cumulative[i - 1] + distance(points[i - 1], points[i]));
    return cumulative;
  }
  function pointAt(route, fraction) {
    const m = Math.max(0, Math.min(1, fraction)) * route.length;
    let i = route.cumulative.findIndex((x) => x >= m);
    if (i <= 0) return route.points[0].slice();
    const a = route.points[i - 1],
      b = route.points[i];
    const t =
      (m - route.cumulative[i - 1]) /
      (route.cumulative[i] - route.cumulative[i - 1] || 1);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  function nearest(route, p) {
    let best = { distance: Infinity, fraction: 0, point: route.points[0] };
    const scale = Math.cos((p[0] * Math.PI) / 180);
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1],
        b = route.points[i],
        x = (b[1] - a[1]) * scale,
        y = b[0] - a[0];
      const t = Math.max(
        0,
        Math.min(
          1,
          ((p[1] - a[1]) * scale * x + (p[0] - a[0]) * y) /
            (x * x + y * y || 1),
        ),
      );
      const point = [a[0] + y * t, a[1] + (b[1] - a[1]) * t],
        d = distance(point, p);
      if (d < best.distance)
        best = {
          distance: d,
          point,
          fraction:
            (route.cumulative[i - 1] +
              t * (route.cumulative[i] - route.cumulative[i - 1])) /
            route.length,
        };
    }
    return best;
  }
  const adjacency = data.nodes.map(() => []);
  data.edges.forEach((e, i) => {
    adjacency[e[0]].push([e[1], i]);
    adjacency[e[1]].push([e[0], i]);
  });
  class MinHeap {
    constructor() {
      this.items = [];
    }
    push(item) {
      const a = this.items;
      let i = a.length;
      a.push(item);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p][0] <= item[0]) break;
        a[i] = a[p];
        i = p;
      }
      a[i] = item;
    }
    pop() {
      const a = this.items,
        first = a[0],
        last = a.pop();
      if (a.length) {
        let i = 0;
        while (i * 2 + 1 < a.length) {
          let c = i * 2 + 1;
          if (c + 1 < a.length && a[c + 1][0] < a[c][0]) c++;
          if (a[c][0] >= last[0]) break;
          a[i] = a[c];
          i = c;
        }
        a[i] = last;
      }
      return first;
    }
  }
  function shortest(target, penalty) {
    const best = new Float64Array(data.nodes.length).fill(Infinity),
      previous = new Int32Array(data.nodes.length).fill(-1),
      via = new Int32Array(data.nodes.length).fill(-1),
      heap = new MinHeap();
    best[data.start] = 0;
    heap.push([0, data.start]);
    while (heap.items.length) {
      const [cost, u] = heap.pop();
      if (cost !== best[u]) continue;
      if (u === target) break;
      for (const [v, ei] of adjacency[u]) {
        const next = cost + data.edges[ei][2] * (1 + (penalty?.[ei] || 0));
        if (next < best[v]) {
          best[v] = next;
          previous[v] = u;
          via[v] = ei;
          heap.push([next, v]);
        }
      }
    }
    if (!Number.isFinite(best[target])) return null;
    const nodeIds = [],
      edgeIds = [];
    for (let v = target; v !== data.start; v = previous[v]) {
      nodeIds.push(v);
      edgeIds.push(via[v]);
    }
    nodeIds.push(data.start);
    nodeIds.reverse();
    edgeIds.reverse();
    return { nodeIds, edgeIds };
  }
  function materialise(path) {
    const points = path.nodeIds.map((i) => data.nodes[i]),
      cumulative = measure(points),
      length = cumulative.at(-1);
    let off = 0,
      known = 0,
      named = 0,
      road = 0;
    const records = new Set();
    for (const ei of path.edgeIds) {
      const e = data.edges[ei],
        r = data.records[e[3]];
      records.add(e[3]);
      if (r.position) {
        known += e[2];
        if (r.position === "OFF ROAD") off += e[2];
        if (r.position === "ON ROAD") road += e[2];
      }
      if (/Bicentennial|Riverwalk|Kangaroo Point/i.test(r.name || ""))
        named += e[2];
    }
    return {
      ...path,
      points,
      cumulative,
      length,
      km: length / 1000,
      minutes: Math.ceil((length / 15000) * 60),
      walk: 0,
      ascent: null,
      signature: path.edgeIds.join(","),
      offroad: off / length,
      known: known / length,
      road: road / length,
      riverShare: named / length,
      recordIds: [...records],
      source: "Brisbane City Council",
    };
  }
  const cache = {};
  function buildRoutes(destination) {
    if (cache[destination]) return cache[destination].map((r) => ({ ...r }));
    const d = destinations.find((d) => d.id === destination);
    if (!d)
      throw new Error("Choose one of the supported BCC cycleway arrivals.");
    const first = shortest(d.node);
    if (!first)
      throw new Error(
        "BCC data does not contain a connected route to this arrival. No missing road has been invented.",
      );
    const quick = materialise(first),
      pool = [quick],
      signatures = new Set([quick.signature]),
      penalty = new Float64Array(data.edges.length);
    let path = first;
    for (let i = 0; i < 8; i++) {
      for (const e of path.edgeIds) penalty[e] += 1.5;
      path = shortest(d.node, penalty);
      if (!path) break;
      const r = materialise(path);
      if (r.length <= quick.length * 2.2 && !signatures.has(r.signature)) {
        pool.push(r);
        signatures.add(r.signature);
      }
    }
    const safety = [...pool].sort(
      (a, b) =>
        a.length * (1 + 2 * a.road + 0.75 * (1 - a.known)) -
        b.length * (1 + 2 * b.road + 0.75 * (1 - b.known)),
    )[0];
    const scenic = [...pool].sort(
      (a, b) =>
        b.riverShare -
        (0.12 * b.length) / quick.length -
        (a.riverShare - (0.12 * a.length) / quick.length),
    )[0];
    const specs = [
      {
        id: "safe",
        name: "Safety-focused",
        symbol: "◇",
        color: "#0875ed",
        description: "Prefers BCC-mapped off-road sections.",
        reason:
          "Balances distance against on-road and unclassified sections. This is a routing preference, not a proven safety rating.",
        route: safety,
      },
      {
        id: "fast",
        name: "Quick",
        symbol: "ϟ",
        color: "#7952d4",
        description: "Shortest connected path in this BCC graph.",
        reason:
          "Dijkstra shortest path using distances calculated from BCC coordinates. Time assumes 15 km/h, without stops.",
        route: quick,
      },
      {
        id: "scenic",
        name: "Scenic",
        symbol: "≈",
        color: "#078773",
        description: "Prefers BCC-named riverside bikeways.",
        reason:
          "Prefers sections named Bicentennial Bikeway, Riverwalk or Kangaroo Point Bikeway in BCC records, with a detour penalty.",
        route: scenic,
      },
    ];
    const routes = specs.map((s) => {
      const { route, ...spec } = s;
      return {
        ...route,
        ...spec,
        via: "Milton cycleway → " + d.name + " nearby cycleway",
        uniqueCandidates: pool.length,
      };
    });
    routes.forEach((r) => {
      r.shared = routes
        .filter((o) => o.id !== r.id && o.signature === r.signature)
        .map((o) => o.name);
    });
    cache[destination] = routes;
    return routes.map((r) => ({ ...r }));
  }
  root.RideData = {
    start,
    destinations,
    types,
    distance,
    measure,
    pointAt,
    nearest,
    buildRoutes,
    shortest,
  };
  // Hazard samples are independent of BCC route calculations.
})(typeof window !== "undefined" ? window : globalThis);