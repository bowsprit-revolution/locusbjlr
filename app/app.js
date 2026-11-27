(function () {
  const D = window.DATA, P = window.Planner;
  const SERIES = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6", "--s7", "--s8"];
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const peso = n => "₱" + Math.round(n).toLocaleString("en-PH");
  const pct = n => Math.round(n * 100) + "%";
  const $ = id => document.getElementById(id);
  const hhmm = m => { const h = Math.floor(m / 60), mm = Math.round(m % 60); return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
  const vname = v => (v.type === "A" ? "Van " : "Truck ") + v.id.slice(1);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const recipeFleet = s => { const p = D.recipe.periods[D.scenarios[s].fleet_period]; return { A: p.A.fleet, B: p.B.fleet }; };

  const STEPS = [
    { t: "Normal day", s: "normal", f: "normal", c: () => `A busy February day, ${D.orders.normal.length} orders, with the recipe's normal-season fleet.` },
    { t: "Peak day, normal fleet", s: "peak", f: "normal", c: () => `A busy December day, ${D.orders.peak.length} orders, but we keep February's fleet.` },
    { t: "Peak day, recipe fleet", s: "peak", f: "peak", c: () => `The same December day with the recipe's peak-season fleet.` },
  ];
  const state = { step: 0 };

  const icon = (code, used) => {
    const main = used ? "#808F87" : "none", acc = used ? "#F4B266" : "none", st = used ? "none" : "#56625B";
    return code === "A"
      ? `<svg class="${used ? "" : "idle"}" width="28" height="22" viewBox="0 0 30 24" aria-hidden="true"><rect x="2" y="8" width="17" height="10" rx="2.5" fill="${main}" stroke="${st}" stroke-width="1.5"/><path d="M19 11h4l4 3.5v3.5h-8z" fill="${acc}" stroke="${st}" stroke-width="1.5"/><circle cx="8" cy="20" r="2.4" fill="#26302A"/><circle cx="23" cy="20" r="2.4" fill="#26302A"/></svg>`
      : `<svg class="${used ? "" : "idle"}" width="32" height="23" viewBox="0 0 36 26" aria-hidden="true"><rect x="2" y="5" width="22" height="14" rx="1.5" fill="${main}" stroke="${st}" stroke-width="1.5"/><path d="M24 9h5l5 4.5v5.5h-10z" fill="${acc}" stroke="${st}" stroke-width="1.5"/><circle cx="9" cy="22" r="2.6" fill="#26302A"/><circle cx="28" cy="22" r="2.6" fill="#26302A"/></svg>`;
  };

  const map = L.map("map", { scrollWheelZoom: false, zoomControl: false, zoomSnap: 0.25 });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map);
  const layer = L.layerGroup().addTo(map);
  const depotIcon = L.divIcon({ className: "", html: '<div style="width:16px;height:16px;background:#26302A;border:3px solid #FBFDFA;border-radius:3px"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
  const colorFor = v => { const n = parseInt(v.id.slice(1), 10) - 1; return css(SERIES[v.type === "B" ? n % 8 : 7 - (n % 8)]); };

  function verdict(code, bt) {
    if (bt.unserved || bt.late) return ["crit", "Too small", `<b>${bt.unserved} deliveries missed.</b> Not enough ${code === "A" ? "vans" : "trucks"}.`];
    if (bt.idle > D.recipe.backup) return ["warn", "Too big", `${bt.idle} of ${bt.available} sit idle all day. 1 backup would do.`];
    return ["good", "About right", `All ${bt.jobs} deliveries made${bt.idle ? ", 1 spare as backup" : ""}.`];
  }

  function run() {
    const st = STEPS[state.step], res = P.plan(D, st.s, recipeFleet(st.f));
    $("steps").innerHTML = STEPS.map((x, i) => `<button class="step" role="radio" aria-checked="${i === state.step}" data-i="${i}"><span class="n">${i + 1}</span><b>${x.t}</b></button>`).join("");
    document.querySelectorAll(".step").forEach(b => b.onclick = () => { state.step = +b.dataset.i; run(); });
    $("caption").textContent = st.c();

    $("verdicts").innerHTML = ["B", "A"].map(c => {
      const bt = res.byType[c], [cls, word, note] = verdict(c, bt);
      const icons = Array.from({ length: bt.available }, (_, i) => icon(c, i < bt.used)).join("");
      return `<div class="vrow"><div class="vhead"><span class="vname">${c === "A" ? "Refrigerated vans" : "Dry trucks"} <small>· ${bt.used} of ${bt.available} out</small></span><span class="badge ${cls}">${word}</span></div><div class="icons">${icons}</div><p class="vnote">${note}</p></div>`;
    }).join("");

    const t = res.totals, used = res.vehicles.filter(v => v.used);
    $("stats").innerHTML = [
      ["Delivered on time", `${pct(t.on_time)} <small>${t.delivered}/${t.jobs}</small>`],
      ["Time on the road", `${pct(used.reduce((a, v) => a + v.hours_pct, 0) / (used.length || 1))} <small>of the day</small>`],
      ["Distance", `${Math.round(t.km)} km`],
      ["Cost today", peso(t.cost)],
    ].map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join("");

    layer.clearLayers();
    L.marker([D.depot.lat, D.depot.lon], { icon: depotIcon }).bindTooltip("Depot").addTo(layer);
    res.vehicles.filter(v => v.used).forEach(v => {
      const color = colorFor(v);
      const pts = [[D.depot.lat, D.depot.lon]].concat(v.stops.map(s => [s.job.order.lat, s.job.order.lon]), [[D.depot.lat, D.depot.lon]]);
      L.polyline(pts, { color, weight: 2.5, opacity: 0.9, dashArray: v.type === "A" ? "6 5" : null }).addTo(layer);
      v.stops.forEach((s, n) => { const o = s.job.order;
        L.circleMarker([o.lat, o.lon], { radius: 4.5, color: "#FBFDFA", weight: 1.5, fillColor: color, fillOpacity: 1 })
          .bindTooltip(`<b>${vname(v)} · stop ${n + 1} of ${v.stops.length}</b><br>${o.name}<br>${s.job.kind === "frozen" ? "Ice cream" : "Dry goods"}: ${Math.round(s.job.kg)} kg<br>Wants delivery ${hhmm(o.window_start)}–${hhmm(o.window_end)}<br>Arrives ${hhmm(s.start)}${s.late ? ` · ${Math.round(s.late)} min late` : ""}`).addTo(layer); });
    });
    res.unserved.forEach(j => L.circleMarker([j.order.lat, j.order.lon], { radius: 7, color: css("--crit"), weight: 3, fillColor: "#FBFDFA", fillOpacity: 1 }).bindTooltip("Missed: " + j.order.name).addTo(layer));
    map.fitBounds(L.latLngBounds([[D.depot.lat, D.depot.lon]].concat(D.orders[st.s].map(o => [o.lat, o.lon]))), { padding: [30, 30] });
  }
  run();
})();
