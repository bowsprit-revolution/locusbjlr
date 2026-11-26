# Part 2 build log

A running record of how the prototype was built, for the "How you built it" part of the presentation (tools, prompts, where it got stuck). Newest entries go at the bottom.

## Tools

| Tool | Used for |
|---|---|
| Claude (Claude Code, in a Claude project thread) | Proposing data assumptions, writing the data generator, the routing solver and the web page |
| Python 3 (standard library only) | `data/generate.py`: synthetic stores, 5-year order history, the two sample days, and BJ's sizing recipe |
| Plain HTML, CSS and JavaScript | The app itself. No framework and no build step, so it runs from GitHub Pages as static files |
| Leaflet 1.9.4 with OpenStreetMap tiles | The map |
| Playwright (headless Chromium) | Screenshots to check the page after each change |
| GitHub | Repository, and GitHub Pages hosting for the app link |

## How the work was split (Locus's AI rule)

- **Part 1 (BJ only):** the approach, the variables and the sizing recipe are BJ's. Claude only asked questions and kept a log of BJ's answers.
- **Data assumptions (AI allowed):** Claude proposed values with options; BJ picked (`docs/part2/data-assumptions.md`).
- **Prototype (AI allowed):** Claude built it after BJ's go-ahead. The recipe is coded exactly as BJ defined it; the code doesn't change it.

## Key prompts (BJ's words)

1. Setting the working style: *"I want it to be interactive, more of you asking me questions with sensible choices rather than giving the answers straight away."*
2. Asking for assumptions: *"ok can you work on the data assumptions you will propose so I approve?"*
3. Approving and starting the build: *"1. OK on Quezon City 2. OK 3. yes with a toggle 4. yes generate this 5. ok as-is … for now build it, so I come back to it after my break. I want this to be simple but effective in demonstrating the model we've built."*

## What was built (Nov 25, 2026)

1. **Synthetic data** (`data/generate.py`, fixed seed so results repeat):
   - 600 stores in one Quezon City zone (85% sari-sari and minimarts, 15% grocers), each with a delivery window.
   - 5 years of daily orders (2022–2026) with BJ's calendar (dry peak Sep–Dec, ice cream peak Mar–May, off-season Jun–Aug), 8% yearly growth, busier weekends and a few one-off spikes.
   - Two sample days for 2027: a normal Tuesday in February (98 orders) and a peak Tuesday in December (155 orders).
2. **BJ's recipe in code** (`run_recipe` in the generator): per season and vehicle type, it counts stores and kg per day, takes the bigger of kg ÷ capacity and stores ÷ stops per vehicle, keeps enough vehicles for 90% of days, adds 1 backup, and brings past years up to 2027 with the measured growth. Output: `data/fleet_recipe.json`.
3. **Dispatch planner** (`index.html`, `app/`):
   - Splits each order into a dry job (Type B only) and an ice cream job (Type A only).
   - Builds routes by cheapest insertion that respects capacity, time windows and the 10-hour shift, then improves them by moving stops between routes and reversing route segments (2-opt). It tries three starting orders and keeps the cheapest plan.
   - Shows the routes on a map, a list of vehicles with load, hours and cost, the KPIs from the brief, and a verdict for each vehicle type: too small, too big or about right.
   - Lets the viewer change the number of vans and trucks and see the verdict change.
   - Shows where the fleet comes from: the recipe table per season and a chart of vehicles needed per day.

## Where it got stuck, and what fixed it

| Problem | What happened | Fix |
|---|---|---|
| History didn't match the sample day | The 5-year history averaged ~159 orders a day, but the sample day had ~100, so the recipe sized for a busier zone than the demo showed | Rebased growth so the last history year matches today's level, and generated the sample day with the same ordering rules as the history |
| Map library blocked | The build sandbox's network blocked the usual CDN links, so the map didn't load ("L is not defined") | Bundled Leaflet's files in the repo (`app/vendor/leaflet`). This also means the demo doesn't depend on a CDN |
| Messy routes | The first version drew crossing routes and ran 204 km on the normal day | Added a local search pass (move stops, reverse segments) and multiple starting orders: 146 km for the same deliveries |
| Map cut off and cramped numbers | Routes ran past the map edge; two-value KPI tiles wrapped | Fit the map to all stops; split the A and B values in the tiles |

## Results at the time of writing

| Day | Fleet | Type A verdict | Type B verdict | Delivered | Distance | Cost |
|---|---|---|---|---|---|---|
| Normal (Feb) | Recipe: A 2, B 6 | About right (1 spare) | About right (1 spare) | 120 of 120, all on time | 146 km | ₱21,580 |
| Peak (Dec) | Recipe: A 3, B 9 | About right | About right | 181 of 181 | 244 km | ₱35,553 |
| Peak (Dec) | Normal-season fleet: A 3, B 6 | About right | Too small | 142 of 181 (39 dry deliveries missed) | 188 km | ₱28,146 |

The last row is the demo's main point: the normal-season fleet can't cope with a December day, and the peak fleet from BJ's recipe can.

## Open items

- Confirm the way step 6 (growth) is applied: each past year is scaled up to 2027 by the measured growth rate before counting days.

## Nov 26, 2026

- Simplified the page for a 30-minute presentation: removed the recipe table and chart (they move to a slide) and merged the two utilisation tiles into one.
- Decided with BJ: no AI inside the app; host it on GitHub Pages.
- Tried a claude.ai artifact as the app link. Artifacts block images from other sites, so the street map would not show there. GitHub Pages was chosen instead.
