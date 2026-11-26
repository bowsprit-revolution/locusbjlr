"""
Synthetic data generator and fleet-sizing recipe for the Locus pre-sales assignment.

Everything here is SYNTHETIC. Values follow docs/part2/data-assumptions.md.
Run:  python3 data/generate.py
Writes: data/stores.csv, data/history_daily.csv, data/orders_normal.csv,
        data/orders_peak.csv, data/fleet_recipe.json, app/data.js
"""
import csv, json, math, os, random
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
random.seed(20261127)

# ---------------------------------------------------------------- assumptions
DEPOT = {"name": "Quezon City distributor (Zone 1 depot)", "lat": 14.6560, "lon": 121.0035}
ZONE = {"lat_min": 14.640, "lat_max": 14.700, "lon_min": 121.000, "lon_max": 121.060}
N_STORES = 600
GROCER_SHARE = 0.15
FROZEN_BUYER_SHARE = 0.30
ORDER_PROB = 1 / 6                      # a store orders about 1 day in 6 (~100 orders/day)
ICE_SHARE = 0.55                        # a frozen buyer adds ice cream to ~55% of its orders

VEHICLES = {
    "A": {"name": "Type A refrigerated van", "capacity_kg": 1000, "cost_per_km": 35, "fixed_per_day": 2500, "carries": "frozen"},
    "B": {"name": "Type B dry box truck",     "capacity_kg": 4000, "cost_per_km": 25, "fixed_per_day": 3000, "carries": "dry"},
}
SHIFT = {"start_min": 7 * 60, "end_min": 17 * 60}   # 7 AM - 5 PM
SCENARIOS = {
    # "busy" lifts order rates above a typical day for that date, so each sample day is a busy day of
    # the kind the recipe sizes for (the 90% day), not an average one.
    "normal": {"label": "Busy normal day (Tue 9 Feb 2027)", "date": "2027-02-09", "speed_kmh": 18, "extra_service_min": 0,
               "fleet_period": "Jan–Feb", "busy": float(os.environ.get("BUSY_NORMAL", 1.1))},
    "peak":   {"label": "Busy peak day (Tue 14 Dec 2027)",   "date": "2027-12-14", "speed_kmh": 14, "extra_service_min": 5,
               "fleet_period": "Sep–Dec", "busy": float(os.environ.get("BUSY_PEAK", 1.1))},
}
SERVICE_MIN = {"sari-sari": 15, "grocer": 30}
ROAD_FACTOR = 1.4
WINDOWS = [("Any time", 8 * 60, 17 * 60, 0.50), ("Morning", 8 * 60, 12 * 60, 0.30), ("Afternoon", 13 * 60, 17 * 60, 0.20)]
GROCER_WINDOWS = [("Morning receiving", 7 * 60, 11 * 60), ("Afternoon receiving", 13 * 60, 16 * 60)]

# BJ's calendar (Part 1): Sep–Dec dry peak; Mar–May frozen peak; Jun–Aug off-season; Jan–Feb normal
PERIODS = {"Jan–Feb": [1, 2], "Mar–May": [3, 4, 5], "Jun–Aug": [6, 7, 8], "Sep–Dec": [9, 10, 11, 12]}
DRY_SEASON = {1: 1.00, 2: 1.00, 3: 1.00, 4: 1.00, 5: 1.00, 6: 0.90, 7: 0.90, 8: 0.90, 9: 1.15, 10: 1.20, 11: 1.25, 12: 1.33}
FROZEN_SEASON = {1: 1.00, 2: 1.05, 3: 1.40, 4: 1.60, 5: 1.50, 6: 0.90, 7: 0.90, 8: 0.90, 9: 0.90, 10: 0.85, 11: 0.85, 12: 0.85}
DRY_KG_SEASON = {m: (1.20 if m == 12 else 1.10 if m >= 9 else 1.0) for m in range(1, 13)}
WEEKDAY = {0: 0.95, 1: 1.00, 2: 1.00, 3: 1.00, 4: 1.05, 5: 1.15, 6: 0.70}   # Mon..Sun
GROWTH = 0.08
HISTORY_START, HISTORY_END = date(2022, 1, 1), date(2026, 12, 31)   # 5 full years
ONE_OFF_DAYS = 6                                                   # random one-off spikes

# recipe settings (BJ's Part 1 recipe)
COVERAGE = 0.90      # step 4: enough on at least 90% of the season's days
BACKUP = 1           # step 5: +1 backup per type (BJ said +1 or 2)
PLAN_YEAR = 2027     # step 6: plan for next year


def haversine_km(a, b):
    r = 6371.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


# ---------------------------------------------------------------- stores
def make_stores():
    # cluster around a few "main roads" so routes look plausible
    corridors = [(14.645, 121.005, 14.695, 121.020), (14.650, 121.030, 14.690, 121.055),
                 (14.660, 121.000, 14.665, 121.060), (14.680, 121.005, 14.690, 121.058)]
    stores = []
    for i in range(N_STORES):
        if random.random() < 0.7:
            la1, lo1, la2, lo2 = random.choice(corridors)
            t = random.random()
            lat = la1 + (la2 - la1) * t + random.gauss(0, 0.0025)
            lon = lo1 + (lo2 - lo1) * t + random.gauss(0, 0.0025)
        else:
            lat = random.uniform(ZONE["lat_min"], ZONE["lat_max"])
            lon = random.uniform(ZONE["lon_min"], ZONE["lon_max"])
        lat = min(max(lat, ZONE["lat_min"]), ZONE["lat_max"])
        lon = min(max(lon, ZONE["lon_min"]), ZONE["lon_max"])
        kind = "grocer" if random.random() < GROCER_SHARE else "sari-sari"
        if kind == "grocer":
            w = random.choice(GROCER_WINDOWS)
        else:
            r, acc, w = random.random(), 0, None
            for name, s, e, p in WINDOWS:
                acc += p
                if r <= acc:
                    w = (name, s, e)
                    break
        prefix = "Grocer" if kind == "grocer" else random.choice(["Sari-sari", "Mini-mart", "Store"])
        stores.append({
            "store_id": f"S{i+1:03d}", "name": f"{prefix} {i+1:03d}", "type": kind,
            "lat": round(lat, 5), "lon": round(lon, 5),
            "buys_frozen": random.random() < FROZEN_BUYER_SHARE,
            "window_label": w[0], "window_start": w[1], "window_end": w[2],
        })
    return stores


def dry_kg(kind):
    return random.uniform(300, 800) if kind == "grocer" else random.uniform(30, 80)


def frozen_kg(kind):
    return random.uniform(50, 150) if kind == "grocer" else random.uniform(10, 30)


# ---------------------------------------------------------------- 5-year daily history
def make_history(stores):
    rows, d = [], HISTORY_START
    spikes = set(random.sample(range((HISTORY_END - HISTORY_START).days + 1), ONE_OFF_DAYS))
    idx = 0
    while d <= HISTORY_END:
        # level grows ~8%/yr and reaches the base level (~100 orders/day) in the last history year
        g = (1 + GROWTH) ** ((d.year - HISTORY_END.year) + (d.timetuple().tm_yday / 365) - 0.5)
        m = d.month
        spike = 1.5 if idx in spikes else 1.0
        p_order = min(0.95, ORDER_PROB * DRY_SEASON[m] * WEEKDAY[d.weekday()] * g * spike)
        # ice cream follows its own calendar, not the dry-goods peak: divide out the dry season factor
        q_ice = min(0.95, ICE_SHARE * FROZEN_SEASON[m] / DRY_SEASON[m])
        dry_stops = dry_tot = dry_svc = fro_stops = fro_tot = fro_svc = 0
        for s in stores:
            if random.random() >= p_order:
                continue
            dry_stops += 1
            dry_tot += dry_kg(s["type"]) * DRY_KG_SEASON[m]
            dry_svc += SERVICE_MIN[s["type"]]
            if s["buys_frozen"] and random.random() < q_ice:
                fro_stops += 1
                fro_tot += frozen_kg(s["type"])
                fro_svc += SERVICE_MIN[s["type"]]
        rows.append({"date": d.isoformat(), "dry_stores": dry_stops, "dry_kg": round(dry_tot),
                     "dry_service_min": dry_svc, "frozen_stores": fro_stops, "frozen_kg": round(fro_tot),
                     "frozen_service_min": fro_svc, "one_off_spike": int(spike > 1)})
        d += timedelta(days=1)
        idx += 1
    return rows


# ---------------------------------------------------------------- BJ's recipe
def avg_travel_min_per_stop(speed_kmh):
    # average distance between neighbouring stops in the zone, plus depot legs spread over a route
    return (1.1 * ROAD_FACTOR) / speed_kmh * 60


def run_recipe(history):
    """Steps 1-6 of BJ's Part 1 recipe, per vehicle type and season.

    Step 6 follows BJ's example ("10 trucks last year + 10% growth -> 11 next year"):
    size the fleet on last year's days only, then add the growth measured over the 5 years.
    """
    years = sorted({int(r["date"][:4]) for r in history})
    # measure growth from the data (average year-on-year change in stores ordering)
    yearly = {y: sum(r["dry_stores"] + r["frozen_stores"] for r in history if r["date"].startswith(str(y))) for y in years}
    yoy = [(yearly[years[i]] / yearly[years[i - 1]]) - 1 for i in range(1, len(years))]
    growth = sum(yoy) / len(yoy)
    out = {"measured_growth": round(growth, 4), "coverage": COVERAGE, "backup": BACKUP, "plan_year": PLAN_YEAR,
           "periods": {}}
    for period, months in PERIODS.items():
        speed = SCENARIOS["peak"]["speed_kmh"] if period == "Sep–Dec" else SCENARIOS["normal"]["speed_kmh"]
        extra = SCENARIOS["peak"]["extra_service_min"] if period == "Sep–Dec" else 0
        travel = avg_travel_min_per_stop(speed)
        shift = SHIFT["end_min"] - SHIFT["start_min"]
        out["periods"][period] = {}
        for vt, key in (("B", "dry"), ("A", "frozen")):
            cap = VEHICLES[vt]["capacity_kg"]
            needed = []
            for r in history:                                            # step 1: filter (last year, this season)
                y, m = int(r["date"][:4]), int(r["date"][5:7])
                if m not in months or y != years[-1]:
                    continue
                stores = r[f"{key}_stores"]                              # step 2: stores and kg per day
                kg = r[f"{key}_kg"]
                if stores == 0:
                    needed.append({"date": r["date"], "n": 0, "by_weight": 0, "by_stops": 0, "one_off": r["one_off_spike"]})
                    continue
                avg_svc = r[f"{key}_service_min"] / r[f"{key}_stores"] + extra
                stops_per_vehicle = shift / (avg_svc + travel)
                by_w = math.ceil(kg / cap)                               # step 3: bigger of the two sums
                by_s = math.ceil(stores / stops_per_vehicle)
                needed.append({"date": r["date"], "n": max(by_w, by_s), "by_weight": by_w, "by_stops": by_s,
                               "one_off": r["one_off_spike"]})
            ns = sorted(x["n"] for x in needed)
            k = math.ceil(COVERAGE * len(ns)) - 1                         # step 4: enough on >= 90% of days
            last_year_core = ns[k]
            fleet_core = math.ceil(last_year_core * (1 + growth))          # step 6: add growth for next year
            covered = sum(1 for x in ns if x <= last_year_core) / len(ns)
            dist = {}
            for x in ns:
                dist[x] = dist.get(x, 0) + 1
            out["periods"][period][vt] = {
                "days": len(ns), "last_year_core": last_year_core, "core_fleet": fleet_core, "backup": BACKUP, "fleet": fleet_core + BACKUP,
                "covered_share": round(covered, 3), "max_day": ns[-1], "median_day": ns[len(ns) // 2],
                "days_needing_rental": sum(1 for x in ns if x > last_year_core),
                "weight_bound_days": sum(1 for x in needed if x["by_weight"] > x["by_stops"]),
                "distribution": [{"trucks": t, "days": c} for t, c in sorted(dist.items())],
            }
    return out


# ---------------------------------------------------------------- one day of orders
def make_day(stores, scen_key, growth):
    sc = SCENARIOS[scen_key]
    rng = random.Random({"normal": 11, "peak": 29}[scen_key])
    m = int(sc["date"][5:7])
    g = (1 + growth) ** (PLAN_YEAR - HISTORY_END.year)
    p = min(0.95, ORDER_PROB * DRY_SEASON[m] * WEEKDAY[date.fromisoformat(sc["date"]).weekday()] * g * sc["busy"])
    q_ice = min(0.95, ICE_SHARE * FROZEN_SEASON[m] / DRY_SEASON[m])
    orders = []
    for s in stores:
        if rng.random() >= p:
            continue
        mix = {k: 0.0 for k in ("toothpaste", "soap", "tea", "water_purifier")}
        total = (rng.uniform(300, 800) if s["type"] == "grocer" else rng.uniform(30, 80)) * DRY_KG_SEASON[m]
        w = [rng.random() for _ in mix]
        for (k, wi) in zip(mix, w):
            mix[k] = round(total * wi / sum(w), 1)
        ice = 0.0
        if s["buys_frozen"] and rng.random() < q_ice:
            ice = round((rng.uniform(50, 150) if s["type"] == "grocer" else rng.uniform(10, 30)), 1)
        orders.append({"order_id": f"{scen_key[0].upper()}{len(orders)+1:03d}", **{k: s[k] for k in (
            "store_id", "name", "type", "lat", "lon", "window_label", "window_start", "window_end")},
            **{f"{k}_kg": v for k, v in mix.items()}, "dry_kg": round(sum(mix.values()), 1), "ice_cream_kg": ice,
            "service_min": SERVICE_MIN[s["type"]] + sc["extra_service_min"]})
    return orders


def write_csv(path, rows):
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def main():
    stores = make_stores()
    history = make_history(stores)
    recipe = run_recipe(history)
    days = {k: make_day(stores, k, recipe["measured_growth"]) for k in SCENARIOS}
    write_csv(ROOT / "data/stores.csv", stores)
    write_csv(ROOT / "data/history_daily.csv", history)
    for k, rows in days.items():
        write_csv(ROOT / f"data/orders_{k}.csv", rows)
    (ROOT / "data/fleet_recipe.json").write_text(json.dumps(recipe, indent=2, ensure_ascii=False))
    payload = {"depot": DEPOT, "vehicles": VEHICLES, "shift": SHIFT, "scenarios": SCENARIOS,
               "road_factor": ROAD_FACTOR, "recipe": recipe, "orders": days}
    (ROOT / "app/data.js").write_text("// Generated by data/generate.py. Synthetic data only.\nwindow.DATA = "
                                      + json.dumps(payload, ensure_ascii=False) + ";\n")
    for k, rows in days.items():
        print(k, len(rows), "orders; dry kg", round(sum(r["dry_kg"] for r in rows)),
              "; ice cream orders", sum(1 for r in rows if r["ice_cream_kg"] > 0),
              "kg", round(sum(r["ice_cream_kg"] for r in rows)))
    print("growth", recipe["measured_growth"])
    for p, v in recipe["periods"].items():
        print(p, {t: (x["core_fleet"], x["fleet"], x["max_day"], x["median_day"], x["days_needing_rental"], x["weight_bound_days"]) for t, x in v.items()})


if __name__ == "__main__":
    main()
