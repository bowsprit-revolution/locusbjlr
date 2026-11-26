// Daily dispatch planner: capacity + time windows, ice cream only on Type A.
// Cheapest-insertion heuristic with a 2-opt clean-up. Synthetic data only.
(function (root) {
  const R = 6371;
  function km(a, b) {
    const p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180;
    const dp = p2 - p1, dl = (b.lon - a.lon) * Math.PI / 180;
    const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // Build delivery jobs. "Always split": the frozen part and the dry part of an order are separate jobs.
  function buildJobs(orders) {
    const jobs = [];
    for (const o of orders) {
      if (o.dry_kg > 0) jobs.push({ id: o.order_id + "-D", order: o, kind: "dry", kg: o.dry_kg });
      if (o.ice_cream_kg > 0) jobs.push({ id: o.order_id + "-F", order: o, kind: "frozen", kg: o.ice_cream_kg });
    }
    return jobs;
  }

  // Simulate a route; returns null if infeasible.
  function simulate(route, ctx, allowLate) {
    const { depot, shift, speed, roadFactor } = ctx;
    let t = shift.start_min, prev = depot, dist = 0, load = 0, lateCount = 0, lateMin = 0;
    const stops = [];
    for (const j of route) {
      load += j.kg;
      const d = km(prev, j.order) * roadFactor;
      dist += d;
      t += d / speed * 60;
      const arrive = t;
      if (t < j.order.window_start) t = j.order.window_start;
      const late = Math.max(0, t - j.order.window_end);
      if (late > allowLate) return null;
      if (late > 0) { lateCount++; lateMin += late; }
      stops.push({ job: j, arrive, start: t, late });
      t += j.order.service_min;
      prev = j.order;
    }
    const back = km(prev, depot) * roadFactor;
    dist += back;
    t += back / speed * 60;
    if (t > shift.end_min) return null;
    return { stops, dist, load, end: t, lateCount, lateMin };
  }

  function routeCost(sim, vehicle, n) { return n ? vehicle.fixed_per_day + sim.dist * vehicle.cost_per_km + sim.lateMin * 50 : 0; }

  function construct(order, vehicle, count, ctx) {
    const routes = Array.from({ length: count }, () => []);
    const sims = routes.map(() => ({ dist: 0, load: 0, lateMin: 0 }));
    const cap = vehicle.capacity_kg;
    let pending = order;
    for (const allowLate of [0, 60]) {
      const left = [];
      for (const j of pending) {
        let best = null;
        for (let r = 0; r < routes.length; r++) {
          if (sims[r].load + j.kg > cap) continue;
          const base = routeCost(sims[r], vehicle, routes[r].length);
          for (let pos = 0; pos <= routes[r].length; pos++) {
            const trial = routes[r].slice(0, pos).concat([j], routes[r].slice(pos));
            const sim = simulate(trial, ctx, allowLate);
            if (!sim) continue;
            const cost = routeCost(sim, vehicle, trial.length) - base;
            if (!best || cost < best.cost) best = { cost, r, pos, sim };
          }
        }
        if (best) { routes[best.r].splice(best.pos, 0, j); sims[best.r] = best.sim; }
        else left.push(j);
      }
      pending = left;
      if (!pending.length) break;
    }
    return { routes, sims, pending };
  }

  // Local search: move a stop to a better place (same or other route), then 2-opt each route.
  function improve(state, vehicle, ctx) {
    const { routes, sims } = state, cap = vehicle.capacity_kg;
    for (let pass = 0; pass < 6; pass++) {
      let moved = false;
      for (let r = 0; r < routes.length; r++) {
        for (let i = 0; i < routes[r].length; i++) {
          const j = routes[r][i];
          const fromTrial = routes[r].slice(0, i).concat(routes[r].slice(i + 1));
          const fromSim = fromTrial.length ? simulate(fromTrial, ctx, 60) : { dist: 0, load: 0, lateMin: 0 };
          if (!fromSim) continue;
          const saved = routeCost(sims[r], vehicle, routes[r].length) - routeCost(fromSim, vehicle, fromTrial.length);
          let best = null;
          for (let r2 = 0; r2 < routes.length; r2++) {
            const src = r2 === r ? fromTrial : routes[r2];
            const srcSim = r2 === r ? fromSim : sims[r2];
            if (r2 !== r && srcSim.load + j.kg > cap) continue;
            const base = routeCost(srcSim, vehicle, src.length);
            for (let pos = 0; pos <= src.length; pos++) {
              if (r2 === r && pos === i) continue;
              const trial = src.slice(0, pos).concat([j], src.slice(pos));
              const sim = simulate(trial, ctx, 60);
              if (!sim) continue;
              const add = routeCost(sim, vehicle, trial.length) - base;
              if (add < saved - 1e-6 && (!best || add < best.add)) best = { add, r2, pos, sim, trial };
            }
          }
          if (best) {
            if (best.r2 === r) { routes[r] = best.trial; sims[r] = best.sim; }
            else { routes[r] = fromTrial; sims[r] = fromSim; routes[best.r2] = best.trial; sims[best.r2] = best.sim; }
            moved = true; i = -1;
          }
        }
      }
      for (let r = 0; r < routes.length; r++) {
        let improved = true, guard = 0;
        while (improved && guard++ < 50) {
          improved = false;
          for (let i = 0; i < routes[r].length - 1 && !improved; i++) {
            for (let k = i + 1; k < routes[r].length && !improved; k++) {
              const trial = routes[r].slice(0, i).concat(routes[r].slice(i, k + 1).reverse(), routes[r].slice(k + 1));
              const sim = simulate(trial, ctx, 60);
              if (sim && routeCost(sim, vehicle, 1) < routeCost(sims[r], vehicle, 1) - 1e-6) { routes[r] = trial; sims[r] = sim; improved = true; moved = true; }
            }
          }
        }
      }
      if (!moved) break;
    }
    return state;
  }

  function solveType(jobs, vehicle, count, ctx) {
    const angle = j => Math.atan2(j.order.lat - ctx.depot.lat, j.order.lon - ctx.depot.lon);
    const orders = [
      jobs.slice().sort((a, b) => (a.order.window_end - b.order.window_end) || (km(ctx.depot, b.order) - km(ctx.depot, a.order))),
      jobs.slice().sort((a, b) => angle(a) - angle(b)),
      jobs.slice().sort((a, b) => km(ctx.depot, b.order) - km(ctx.depot, a.order)),
    ];
    let bestState = null, bestScore = Infinity;
    for (const o of orders) {
      const st = improve(construct(o, vehicle, count, ctx), vehicle, ctx);
      const score = st.pending.length * 1e7 + st.routes.reduce((s, rt, i) => s + routeCost(st.sims[i], vehicle, rt.length), 0);
      if (score < bestScore) { bestScore = score; bestState = st; }
    }
    const routes = bestState.routes, pending = bestState.pending, cap = vehicle.capacity_kg;
    const shiftLen = ctx.shift.end_min - ctx.shift.start_min;
    const vehicles = routes.map((rt, i) => {
      const sim = rt.length ? simulate(rt, ctx, 60) : null;
      const kmTot = sim ? sim.dist : 0;
      return {
        id: vehicle.code + (i + 1), type: vehicle.code, name: vehicle.name, stops: sim ? sim.stops : [],
        used: rt.length > 0, km: kmTot, load_kg: sim ? sim.load : 0, load_pct: sim ? sim.load / cap : 0,
        hours_pct: sim ? (sim.end - ctx.shift.start_min) / shiftLen : 0, end_min: sim ? sim.end : null,
        late: sim ? sim.lateCount : 0,
        cost: rt.length ? vehicle.fixed_per_day + kmTot * vehicle.cost_per_km : 0,
      };
    });
    return { vehicles, unserved: pending };
  }

  function plan(data, scenarioKey, fleet) {
    const sc = data.scenarios[scenarioKey];
    const ctx = { depot: data.depot, shift: data.shift, speed: sc.speed_kmh, roadFactor: data.road_factor };
    const jobs = buildJobs(data.orders[scenarioKey]);
    const res = {};
    for (const code of ["A", "B"]) {
      const v = Object.assign({ code }, data.vehicles[code]);
      res[code] = solveType(jobs.filter(j => j.kind === v.carries), v, fleet[code], ctx);
    }
    return summarize(res, jobs, fleet);
  }

  function summarize(res, jobs, fleet) {
    const vehicles = res.A.vehicles.concat(res.B.vehicles);
    const used = vehicles.filter(v => v.used);
    const unserved = res.A.unserved.concat(res.B.unserved);
    const late = used.reduce((s, v) => s + v.late, 0);
    const delivered = jobs.length - unserved.length;
    const byType = {};
    for (const code of ["A", "B"]) {
      const vs = res[code].vehicles, u = vs.filter(v => v.used);
      const n = vs.reduce((s, v) => s + v.stops.length, 0) + res[code].unserved.length;
      const lateT = u.reduce((s, v) => s + v.late, 0);
      byType[code] = {
        available: fleet[code], used: u.length, idle: fleet[code] - u.length, jobs: n,
        unserved: res[code].unserved.length, late: lateT,
        on_time: n ? (n - lateT - res[code].unserved.length) / n : 1,
        load_pct: u.length ? u.reduce((s, v) => s + v.load_pct, 0) / u.length : 0,
        hours_pct: u.length ? u.reduce((s, v) => s + v.hours_pct, 0) / u.length : 0,
        km: u.reduce((s, v) => s + v.km, 0), cost: u.reduce((s, v) => s + v.cost, 0),
      };
    }
    return {
      vehicles, unserved, byType,
      totals: {
        jobs: jobs.length, delivered, late, on_time: jobs.length ? (delivered - late) / jobs.length : 1,
        used: used.length, available: fleet.A + fleet.B,
        km: used.reduce((s, v) => s + v.km, 0), cost: used.reduce((s, v) => s + v.cost, 0),
      },
    };
  }

  // Smallest fleet of one type that serves every delivery on time that day.
  function minimumFleet(data, scenarioKey, code, maxN) {
    const sc = data.scenarios[scenarioKey];
    const ctx = { depot: data.depot, shift: data.shift, speed: sc.speed_kmh, roadFactor: data.road_factor };
    const v = Object.assign({ code }, data.vehicles[code]);
    const jobs = buildJobs(data.orders[scenarioKey]).filter(j => j.kind === v.carries);
    for (let n = 1; n <= maxN; n++) {
      const r = solveType(jobs, v, n, ctx);
      if (!r.unserved.length && r.vehicles.every(x => x.late === 0)) return n;
    }
    return null;
  }

  root.Planner = { plan, minimumFleet, km };
  if (typeof module !== "undefined") module.exports = root.Planner;
})(typeof window !== "undefined" ? window : globalThis);
