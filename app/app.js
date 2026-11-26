(function () {
  const D = window.DATA, P = window.Planner;
  const SERIES = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6", "--s7", "--s8"];
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const peso = n => "₱" + Math.round(n).toLocaleString("en-PH");
  const pct = n => Math.round(n * 100) + "%";
  const hhmm = m => { const h = Math.floor(m / 60), mm = Math.round(m % 60); return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
  const $ = id => document.getElementById(id);

  const state = { scenario: "normal", fleet: { A: 0, B: 0 }, active: null };
  const recipeFleet = s => { const p = D.recipe.periods[D.scenarios[s].fleet_period]; return { A: p.A.fleet, B: p.B.fleet }; };

  // ---------- map
  const map = L.map("map", { scrollWheelZoom: false, zoomSnap: 0.25 }).setView([D.depot.lat, D.depot.lon], 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(map);
  const layer = L.layerGroup().addTo(map);
  const depotIcon = L.divIcon({ className: "", html: '<div style="width:16px;height:16px;background:#191919;border:3px solid #fff;border-radius:3px;box-shadow:0 0 0 1px #191919"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

  function colorFor(v) {
    const n = parseInt(v.id.slice(1), 10) - 1;
    const slot = v.type === "B" ? n % SERIES.length : SERIES.length - 1 - (n % SERIES.length);
    return css(SERIES[slot]);
  }

  // ---------- render
  function run() {
    $("fleet-A").textContent = state.fleet.A; $("fleet-B").textContent = state.fleet.B;
    const rf = recipeFleet(state.scenario), per = D.scenarios[state.scenario].fleet_period;
    for (const t of ["A", "B"]) {
      const p = D.recipe.periods[per][t];
      $("hint-" + t).textContent = `Recipe for ${per}: ${p.fleet} (${p.core_fleet} + ${p.backup} backup)`;
    }
    $("scenario-hint").textContent = D.scenarios[state.scenario].label + " · " + D.orders[state.scenario].length + " orders";
    const res = P.plan(D, state.scenario, state.fleet);
    state.res = res;
    renderVerdicts(res); renderKpis(res); renderMap(res); renderRoutes(res);
    fitMap();
  }

  function fitMap() {
    const pts = [[D.depot.lat, D.depot.lon]].concat(D.orders[state.scenario].map(o => [o.lat, o.lon]));
    map.fitBounds(L.latLngBounds(pts), { padding: [24, 24] });
  }

  function verdictFor(code, bt) {
    const name = code === "A" ? "Type A vans (ice cream)" : "Type B trucks (dry goods)";
    const backup = D.recipe.backup;
    if (bt.unserved > 0 || bt.late > 0) {
      const bits = [];
      if (bt.unserved) bits.push(`${bt.unserved} deliveries can't be made`);
      if (bt.late) bits.push(`${bt.late} arrive late`);
      return { cls: "crit", icon: "▲", state: "Too small", name, text: `${bits.join(" and ")}. Add vehicles or rent for the day.` };
    }
    if (bt.idle > backup) return { cls: "warn", icon: "●", state: "Too big", name, text: `${bt.idle} of ${bt.available} idle all day, more than the ${backup} backup the recipe keeps.` };
    const why = bt.idle === backup ? `all deliveries on time, with ${backup} backup spare` : bt.idle === 0 ? `all deliveries on time, backup in use` : `all deliveries on time`;
    return { cls: "good", icon: "✓", state: "About right", name, text: why[0].toUpperCase() + why.slice(1) + "." };
  }

  function renderVerdicts(res) {
    $("verdicts").innerHTML = ["A", "B"].map(c => {
      const v = verdictFor(c, res.byType[c]);
      return `<div class="verdict ${v.cls}"><div class="v-head"><span class="v-state" aria-hidden="true">${v.icon}</span><span>${v.name}:</span><span class="v-state">${v.state}</span></div><p>${v.text}</p></div>`;
    }).join("");
  }

  const pair = (a, b) => `<span class="k-pair"><small>A</small>${a}</span><span class="k-pair"><small>B</small>${b}</span>`;
  function renderKpis(res) {
    const t = res.totals, A = res.byType.A, B = res.byType.B;
    const k = [
      ["Vehicles used", `${t.used} of ${t.available}`, `A ${A.used}/${A.available} · B ${B.used}/${B.available}`],
      ["Utilisation", pair(pct(A.hours_pct), pct(B.hours_pct)), `share of the 10-hour shift used · load A ${pct(A.load_pct)}, B ${pct(B.load_pct)}`],
      ["Total distance", `${Math.round(t.km)} km`, `A ${Math.round(A.km)} · B ${Math.round(B.km)}`],
      ["On-time rate", pct(t.on_time), `${t.delivered} of ${t.jobs} deliveries made, ${t.late} late`],
      ["Cost of the day", peso(t.cost), "fixed cost of vehicles used + per-km cost"],
    ];
    $("kpis").innerHTML = k.map(([l, v, s]) => `<div class="kpi"><div class="k-label">${l}</div><div class="k-val">${v}</div><div class="k-sub">${s}</div></div>`).join("");
  }

  function renderMap(res) {
    layer.clearLayers();
    L.marker([D.depot.lat, D.depot.lon], { icon: depotIcon }).bindTooltip(D.depot.name).addTo(layer);
    res.vehicles.forEach((v, i) => {
      if (!v.used) return;
      const color = colorFor(v, i);
      const dim = state.active && state.active !== v.id;
      const pts = [[D.depot.lat, D.depot.lon]].concat(v.stops.map(s => [s.job.order.lat, s.job.order.lon]), [[D.depot.lat, D.depot.lon]]);
      L.polyline(pts, { color, weight: state.active === v.id ? 4 : 2, opacity: dim ? 0.15 : 0.9, dashArray: v.type === "A" ? "6 5" : null }).addTo(layer);
      v.stops.forEach((s, n) => {
        const o = s.job.order;
        L.circleMarker([o.lat, o.lon], { radius: v.type === "A" ? 5 : 6, color: css("--surface") || "#fff", weight: 2, fillColor: color, fillOpacity: dim ? 0.2 : 1 })
          .bindTooltip(`<b>${v.id} · stop ${n + 1}</b><br>${o.name} (${o.type})<br>${s.job.kind === "frozen" ? "Ice cream" : "Dry goods"}: ${Math.round(s.job.kg)} kg<br>Window ${o.window_label} (${hhmm(o.window_start)}–${hhmm(o.window_end)})<br>Arrives ${hhmm(s.start)}${s.late ? ` · <b>${Math.round(s.late)} min late</b>` : ""}`)
          .addTo(layer);
      });
    });
    res.unserved.forEach(j => {
      const o = j.order;
      L.circleMarker([o.lat, o.lon], { radius: 6, color: css("--crit"), weight: 2, fillColor: css("--surface"), fillOpacity: 1 })
        .bindTooltip(`<b>Not delivered</b><br>${o.name}<br>${j.kind === "frozen" ? "Ice cream" : "Dry goods"}: ${Math.round(j.kg)} kg`).addTo(layer);
    });
  }

  function renderRoutes(res) {
    $("route-list").innerHTML = res.vehicles.map((v, i) => {
      const color = colorFor(v, i);
      if (!v.used) return `<div class="route idle"><span class="swatch" style="background:var(--border)"></span><span class="r-name">${v.id}</span><span class="r-tag">idle</span><span class="r-meta">${v.name}, not needed today</span></div>`;
      return `<div class="route ${state.active === v.id ? "active" : ""}" data-id="${v.id}" tabindex="0">
        <span class="swatch ${v.type === "A" ? "dashed" : ""}" style="background:${color};color:${color}"></span>
        <span class="r-name">${v.id} · ${v.stops.length} stops</span>
        <span class="r-tag">${peso(v.cost)}${v.late ? ` · <span class="late-tag">${v.late} late</span>` : ""}</span>
        <span class="r-meta">Load ${pct(v.load_pct)} · out ${pct(v.hours_pct)} of shift (back ${hhmm(v.end_min)}) · ${Math.round(v.km)} km</span></div>`;
    }).join("");
    document.querySelectorAll(".route[data-id]").forEach(el => {
      const toggle = () => { state.active = state.active === el.dataset.id ? null : el.dataset.id; renderMap(state.res); renderRoutes(state.res); };
      el.addEventListener("click", toggle);
      el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    });
    $("unserved").innerHTML = res.unserved.length
      ? `<div class="unserved-box"><h3>${res.unserved.length} deliveries not made</h3><div class="small">${res.unserved.slice(0, 12).map(j => `${j.order.name} (${j.kind === "frozen" ? "ice cream" : "dry"}, ${Math.round(j.kg)} kg)`).join(", ")}${res.unserved.length > 12 ? "…" : ""}</div></div>` : "";
  }

  document.querySelectorAll("#scenario button").forEach(b => b.addEventListener("click", () => {
    state.scenario = b.dataset.s; state.fleet = recipeFleet(state.scenario); state.active = null;
    document.querySelectorAll("#scenario button").forEach(x => x.setAttribute("aria-checked", String(x === b)));
    run();
  }));
  document.querySelectorAll(".stepper button").forEach(b => b.addEventListener("click", () => {
    const v = b.dataset.v; state.fleet[v] = Math.max(0, Math.min(25, state.fleet[v] + Number(b.dataset.d))); state.active = null; run();
  }));
  $("reset").addEventListener("click", () => { state.fleet = recipeFleet(state.scenario); state.active = null; run(); });

  state.fleet = recipeFleet(state.scenario);
  run();
})();
