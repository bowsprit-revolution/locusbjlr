(function () {
  const D = window.DATA, P = window.Planner;
  const SERIES = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6", "--s7", "--s8"];
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const peso = n => "₱" + Math.round(n).toLocaleString("en-PH");
  const pct = n => Math.round(n * 100) + "%";
  const hhmm = m => { const h = Math.floor(m / 60), mm = Math.round(m % 60); return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
  const $ = id => document.getElementById(id);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  const NAMES = {
    A: { one: "van", many: "vans", title: "Refrigerated vans", goods: "ice cream" },
    B: { one: "truck", many: "trucks", title: "Dry trucks", goods: "dry-goods" },
  };
  const vname = v => (v.type === "A" ? "Van " : "Truck ") + v.id.slice(1);

  const recipeFleet = s => { const p = D.recipe.periods[D.scenarios[s].fleet_period]; return { A: p.A.fleet, B: p.B.fleet }; };
  const nOrders = s => D.orders[s].length;
  const dayName = s => D.scenarios[s].label.replace(/^Busy /, "busy ").replace(/\s*\(.*\)/, "");
  const dateOf = s => (D.scenarios[s].label.match(/\((.*)\)/) || [, ""])[1];
  const fleetText = f => `${plural(f.A, "van", "vans")} and ${plural(f.B, "truck", "trucks")}`;

  // The three demo steps.
  const STEPS = [
    { title: "Normal day", sub: "Normal-season fleet", scenario: "normal", fleetFrom: "normal",
      caption: () => `A busy normal day (${dateOf("normal")}), ${nOrders("normal")} orders. The recipe's fleet for ${D.scenarios.normal.fleet_period}: ${fleetText(recipeFleet("normal"))}, each including 1 backup.` },
    { title: "Peak day, normal fleet", sub: "What if nothing changes?", scenario: "peak", fleetFrom: "normal",
      caption: () => `A busy peak-season day (${dateOf("peak")}), ${nOrders("peak")} orders, still served by the normal-season fleet of ${fleetText(recipeFleet("normal"))}.` },
    { title: "Peak day, recipe fleet", sub: "Peak-season fleet", scenario: "peak", fleetFrom: "peak",
      caption: () => `The same peak day, with the recipe's fleet for ${D.scenarios.peak.fleet_period}: ${fleetText(recipeFleet("peak"))}, each including 1 backup.` },
  ];

  const state = { step: 0, scenario: "normal", fleet: recipeFleet("normal"), active: null };

  // ---------- map
  const map = L.map("map", { scrollWheelZoom: false, zoomSnap: 0.25 }).setView([D.depot.lat, D.depot.lon], 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(map);
  const layer = L.layerGroup().addTo(map);
  const depotIcon = L.divIcon({ className: "", html: '<div style="width:16px;height:16px;background:#2C3229;border:3px solid #FBFCF9;border-radius:3px;box-shadow:0 0 0 1px #2C3229"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

  function colorFor(v) {
    const n = parseInt(v.id.slice(1), 10) - 1;
    const slot = v.type === "B" ? n % SERIES.length : SERIES.length - 1 - (n % SERIES.length);
    return css(SERIES[slot]);
  }

  // ---------- steps
  function renderSteps() {
    $("steps").innerHTML = STEPS.map((s, i) =>
      `<button class="step" role="radio" aria-checked="${state.step === i}" data-i="${i}"><span class="step-n">${i + 1}</span><span class="step-t"><b>${s.title}</b><small>${s.sub}</small></span></button>`).join("");
    document.querySelectorAll("#steps .step").forEach(b => b.addEventListener("click", () => selectStep(Number(b.dataset.i))));
    const s = STEPS[state.step];
    $("caption").textContent = s ? s.caption() : `Your own fleet on the ${dayName(state.scenario)}: ${fleetText(state.fleet)}.`;
  }

  function selectStep(i) {
    const s = STEPS[i];
    state.step = i; state.scenario = s.scenario; state.fleet = recipeFleet(s.fleetFrom); state.active = null;
    run();
  }

  // ---------- render
  function run() {
    $("fleet-A").textContent = state.fleet.A; $("fleet-B").textContent = state.fleet.B;
    document.querySelectorAll("#scenario button").forEach(x => x.setAttribute("aria-checked", String(x.dataset.s === state.scenario)));
    const res = P.plan(D, state.scenario, state.fleet);
    state.res = res;
    renderSteps(); renderAnswer(res); renderKpis(res); renderMap(res); renderRoutes(res);
    fitMap();
  }

  function fitMap() {
    const pts = [[D.depot.lat, D.depot.lon]].concat(D.orders[state.scenario].map(o => [o.lat, o.lon]));
    map.fitBounds(L.latLngBounds(pts), { padding: [24, 24] });
  }

  function verdictFor(code, bt) {
    const N = NAMES[code], backup = D.recipe.backup;
    if (bt.unserved > 0 || bt.late > 0) {
      const bits = [];
      if (bt.unserved) bits.push(`${bt.unserved} of ${bt.jobs} ${N.goods} deliveries can't be made`);
      if (bt.late) bits.push(`${bt.late} arrive late`);
      return { cls: "crit", icon: "▲", state: "Too small", text: `${bits.join(" and ")}. More ${N.many} are needed, or rent some for the day.` };
    }
    if (bt.idle > backup)
      return { cls: "warn", icon: "●", state: "Too big", text: `All ${bt.jobs} ${N.goods} deliveries made, but ${bt.idle} of ${bt.available} ${N.many} sit idle all day: more than the ${backup} backup the recipe keeps.` };
    const spare = bt.idle === 0 ? `every ${N.one} in use, so no backup left today` : `${plural(bt.idle, "spare " + N.one, "spare " + N.many)} (the backup)`;
    return { cls: "good", icon: "✓", state: "About right", text: `All ${bt.jobs} ${N.goods} deliveries made on time, with ${spare}.` };
  }

  function renderAnswer(res) {
    $("answer").innerHTML = ["B", "A"].map(c => {
      const v = verdictFor(c, res.byType[c]);
      return `<div class="verdict ${v.cls}"><p class="v-head"><span class="v-icon" aria-hidden="true">${v.icon}</span>${NAMES[c].title}: <span class="v-state">${v.state}</span></p><p class="v-text">${v.text}</p></div>`;
    }).join("");
  }

  function renderKpis(res) {
    const t = res.totals, A = res.byType.A, B = res.byType.B;
    const idleBits = [];
    if (A.idle) idleBits.push(plural(A.idle, "van", "vans")); if (B.idle) idleBits.push(plural(B.idle, "truck", "trucks"));
    const k = [
      ["Vehicles out today", `${t.used} of ${t.available}`, idleBits.length ? `${idleBits.join(" and ")} stayed at the depot` : "every vehicle went out"],
      ["Time on the road", `<span class="k-pair"><small>Trucks</small>${pct(B.hours_pct)}</span><span class="k-pair"><small>Vans</small>${pct(A.hours_pct)}</span>`, "average share of the 10-hour day each vehicle is out"],
      ["Distance", `${Math.round(t.km)} km`, "all routes, estimated road distance"],
      ["Delivered on time", pct(t.on_time), `${t.delivered} of ${t.jobs} deliveries made${t.late ? `, ${t.late} late` : ""}`],
      ["Cost today", peso(t.cost), "day rate of vehicles used + cost per km"],
    ];
    $("kpis").innerHTML = k.map(([l, v, s]) => `<div class="kpi"><div class="k-label">${l}</div><div class="k-val">${v}</div><div class="k-sub">${s}</div></div>`).join("");
  }

  function renderMap(res) {
    layer.clearLayers();
    L.marker([D.depot.lat, D.depot.lon], { icon: depotIcon }).bindTooltip("Depot").addTo(layer);
    res.vehicles.forEach(v => {
      if (!v.used) return;
      const color = colorFor(v);
      const dim = state.active && state.active !== v.id;
      const pts = [[D.depot.lat, D.depot.lon]].concat(v.stops.map(s => [s.job.order.lat, s.job.order.lon]), [[D.depot.lat, D.depot.lon]]);
      L.polyline(pts, { color, weight: state.active === v.id ? 4 : 2, opacity: dim ? 0.15 : 0.9, dashArray: v.type === "A" ? "6 5" : null }).addTo(layer);
      v.stops.forEach((s, n) => {
        const o = s.job.order;
        L.circleMarker([o.lat, o.lon], { radius: v.type === "A" ? 5 : 6, color: css("--surface") || "#fff", weight: 2, fillColor: color, fillOpacity: dim ? 0.2 : 1 })
          .bindTooltip(`<b>${vname(v)} · stop ${n + 1}</b><br>${o.name} (${o.type})<br>${s.job.kind === "frozen" ? "Ice cream" : "Dry goods"}: ${Math.round(s.job.kg)} kg<br>Wants delivery ${hhmm(o.window_start)}–${hhmm(o.window_end)}<br>Arrives ${hhmm(s.start)}${s.late ? ` · <b>${Math.round(s.late)} min late</b>` : ""}`)
          .addTo(layer);
      });
    });
    res.unserved.forEach(j => {
      const o = j.order;
      L.circleMarker([o.lat, o.lon], { radius: 7, color: css("--crit"), weight: 3, fillColor: css("--surface"), fillOpacity: 1 })
        .bindTooltip(`<b>Missed delivery</b><br>${o.name}<br>${j.kind === "frozen" ? "Ice cream" : "Dry goods"}: ${Math.round(j.kg)} kg`).addTo(layer);
    });
  }

  function renderRoutes(res) {
    const used = res.vehicles.filter(v => v.used);
    const rows = used.map(v => {
      const color = colorFor(v);
      return `<div class="route ${state.active === v.id ? "active" : ""}" data-id="${v.id}" tabindex="0" role="button" aria-pressed="${state.active === v.id}">
        <span class="swatch ${v.type === "A" ? "dashed" : ""}" style="background:${color};color:${color}"></span>
        <span class="r-name">${vname(v)}</span>
        <span class="r-tag">${plural(v.stops.length, "stop", "stops")}${v.late ? ` · <span class="late-tag">${v.late} late</span>` : ""}</span>
        <span class="bar" aria-label="${pct(v.load_pct)} full"><span style="width:${Math.min(100, Math.round(v.load_pct * 100))}%"></span></span>
        <span class="r-pct">${pct(v.load_pct)} full</span>
        <span class="r-meta">Back at ${hhmm(v.end_min)} · ${Math.round(v.km)} km · ${peso(v.cost)}</span></div>`;
    });
    const idle = ["A", "B"].map(c => res.byType[c].idle ? plural(res.byType[c].idle, NAMES[c].one, NAMES[c].many) : null).filter(Boolean);
    if (idle.length) rows.push(`<div class="route idle"><span class="swatch" style="background:var(--border)"></span><span class="r-name">${idle.join(" and ")} stayed at the depot</span><span class="r-meta">Not needed today</span></div>`);
    $("route-list").innerHTML = rows.join("");
    document.querySelectorAll(".route[data-id]").forEach(el => {
      const toggle = () => { state.active = state.active === el.dataset.id ? null : el.dataset.id; renderMap(state.res); renderRoutes(state.res); };
      el.addEventListener("click", toggle);
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    });
    $("unserved").innerHTML = res.unserved.length
      ? `<div class="unserved-box"><h3>${plural(res.unserved.length, "delivery", "deliveries")} missed</h3><div class="small">${res.unserved.slice(0, 8).map(j => `${j.order.name} (${j.kind === "frozen" ? "ice cream" : "dry goods"})`).join(", ")}${res.unserved.length > 8 ? `, and ${res.unserved.length - 8} more` : ""}</div></div>` : "";
  }

  // ---------- custom fleet
  function custom() { state.step = -1; state.active = null; run(); }
  document.querySelectorAll("#scenario button").forEach(b => b.addEventListener("click", () => { state.scenario = b.dataset.s; custom(); }));
  document.querySelectorAll(".stepper button").forEach(b => b.addEventListener("click", () => {
    const v = b.dataset.v; state.fleet[v] = Math.max(0, Math.min(25, state.fleet[v] + Number(b.dataset.d))); custom();
  }));

  run();
})();
