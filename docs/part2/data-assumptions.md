# Data assumptions (approved)

Status: **APPROVED by BJ on Nov 25, 2026** (proposed by Claude the same afternoon). Choices: Quezon City; one zone of ~600 stores; normal and peak toggle; synthetic 5-year history with BJ's recipe run in code; B, C and D as proposed. BJ may revise any value after reviewing the prototype.
Locus's brief allows AI to generate data assumptions. All values are synthetic and illustrative, not real market data. Items marked **[pick]** need BJ's choice; everything else is a default he can change.

These assumptions feed the Part 2 prototype. They are built to fit BJ's Part 1 recipe (stops-per-day and weight sums, 90% coverage, backups, growth), but they don't change it.

---

## A. Scope of the prototype

**A1. Demo distributor [pick]**
- **Recommended: Quezon City.** It's the one used in all of BJ's worked examples, so the demo and Part 1 tell one story.
- Alternatives: Pasig (compact and central), Cavite (longer distances).

**A2. How 100 orders fit a real distributor [pick]**
The brief asks for ~100 orders. A real distributor serving ~8,000 stores would get hundreds of orders a day, so the 100 have to be framed somehow.
- **Recommended: one delivery zone.** The prototype covers one Quezon City zone of ~600 stores, which places ~100 orders a day. BJ's recipe is applied to that zone's history, and the full distributor works the same way, zone by zone.
- Alternative: treat the 100 as the whole distributor's day and don't address scale. This is simpler but easier for the panel to poke at.

**A3. Which day to show [pick]**
- **Recommended: two scenarios with a toggle.** A normal day (February) and a peak day (mid-December), run on the same fleet, so the planner sees "fine on a normal day, too small on peak" (or the reverse).
- Alternative: one normal day only.

## B. Retailers and orders (the ~100 orders)

| Item | Proposed value | Why |
|---|---|---|
| B1. Store mix | 85 sari-sari stores and minimarts, 15 grocers | BJ's own split (daily small buyers vs bulk buyers) |
| B2. Dry order size | Sari-sari 30–80 kg; grocer 300–800 kg | Makes most days stop-limited, with a few heavy grocer drops, as in BJ's examples |
| B3. Ice cream orders | ~30% of stores order ice cream; sari-sari 10–30 kg, grocer 50–150 kg | Ice cream is a minority product outside its season |
| B4. SKU mix within dry | Random mix of toothpaste, soap, tea, water purifier per order | Only total kg matters for routing |
| B5. Locations | Random points inside the zone, on land, clustered around main roads | Synthetic, no real addresses |
| B6. Delivery time windows | 50% any time 8 AM–5 PM; 30% morning (8 AM–12 PM); 20% afternoon (1–5 PM). Grocers get set receiving windows. | Typical store-receiving patterns |
| B7. Peak-day changes | Orders up ~33% (100 → ~133) and ~20% heavier | Same direction as BJ's December example (600 → 800 stores) |

## C. Vehicles (illustrative costs, to state as assumptions)

| Item | Type A (refrigerated van) | Type B (dry box truck) |
|---|---|---|
| C1. Capacity | 1,000 kg | 4,000 kg |
| C2. Cost per km | ₱35/km (fuel plus refrigeration) | ₱25/km |
| C3. Fixed cost per vehicle per day | ₱2,500 (driver, upkeep, depreciation, parking) | ₱3,000 |
| C4. Carries | Ice cream only (BJ's "always split" rule) | Dry goods only |

The brief fixes the relationships: A is smaller with a higher cost per km, and B is larger with a lower cost per km. The peso values are placeholders, so the cost per km and fixed cost should be stated as assumptions in the PDF.

## D. Time and travel

| Item | Normal day | Peak day | Why |
|---|---|---|---|
| D1. Shift | 7 AM–5 PM (10 hours, back at depot) | Same | Matches BJ's 10-hour example |
| D2. Service time per stop | Sari-sari 15 min; grocer 30 min | +5 min each (busy streets, longer unloading) | BJ: "it may take more time to unload if streets are busy" |
| D3. Average driving speed | 18 km/h | 14 km/h | Metro Manila traffic; BJ: "traffic is heavier" in peak |
| D4. Road distance | Straight-line distance × 1.4 | Same | Keeps the prototype free, with no paid map routing; standard approximation |
| D5. Trips per day | 1 trip per vehicle (option to allow a 2nd trip) | Same | BJ raised multiple trips; default to 1 for clarity |

## E. Fleet sizing input (how the prototype gets "the fleet your approach allocates")

**E1. [pick]**
- **Recommended: generate a synthetic 5-year daily history for the demo zone, then run BJ's 6-step recipe on it in code.** This produces the zone's Type A and Type B numbers for each season. The prototype then tests that fleet on the sample day. This also lets BJ show his Part 1 method working end to end.
  - History settings: each store orders ~1 in 6 days; seasonality follows BJ's calendar (dry +30% Sep–Dec, frozen +60% Mar–May, both −10% Jun–Aug); growth +8% a year; weekends a bit busier for sari-sari; random noise and a few one-off spikes (so BJ's "ignore one-offs, cover 90%" rule has something to do).
  - Backups: +1 vehicle of each type, per BJ's "+1 or 2" (the prototype can show both).
- Alternative: skip the history and type fleet numbers in by hand. This is faster, but the demo then doesn't show where the numbers come from.

## F. How the prototype reports results (from the brief)

Vehicles used versus available; utilisation (load % and hours %, matching BJ's "hours used vs available" signal); total km; on-time rate (deliveries inside their window); total cost (fixed cost for each vehicle used plus per-km cost); a verdict of fleet "too small" (unserved or late orders), "too big" (idle vehicles or low hours %) or "about right".

---

## Decisions needed from BJ

1. A1 Demo distributor: **Quezon City** / other
2. A2 Scale framing: **one zone of ~600 stores** / whole distributor
3. A3 Days: **normal and peak toggle** / normal only
4. E1 Fleet input: **synthetic 5-year history + BJ's recipe in code** / typed in by hand
5. Everything in B, C and D: **approve as is**, or name what to change
