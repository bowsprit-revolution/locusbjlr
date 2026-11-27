# Part 2 build log

A running record of how the prototype was built, for the "How you built it" part of the presentation (tools, prompts, where it got stuck). Newest entries go at the bottom.

## Tools

| Tool | Used for |
|---|---|
| Claude (Claude Code, in a Claude project thread) | Proposing data assumptions, writing the data generator, the routing solver and the web page |
| Python 3 (standard library only) | `data/generate.py`: synthetic stores, 5-year order history, the two sample days, and Ben Joseph Ricafrente's sizing recipe |
| Plain HTML, CSS and JavaScript | The app itself. No framework and no build step, so it runs from GitHub Pages as static files |
| Leaflet 1.9.4 with OpenStreetMap tiles | The map |
| Playwright (headless Chromium) | Screenshots to check the page after each change |
| GitHub | Repository, and GitHub Pages hosting for the app link |

## How the work was split (Locus's AI rule)

- **Part 1 (Ben Joseph Ricafrente only):** the approach, the variables and the sizing recipe are Ben Joseph Ricafrente's. Claude only asked questions and kept a log of Ben Joseph Ricafrente's answers.
- **Data assumptions (AI allowed):** Claude proposed values with options; Ben Joseph Ricafrente picked (`docs/part2/data-assumptions.md`).
- **Prototype (AI allowed):** Claude built it after Ben Joseph Ricafrente's go-ahead. The recipe is coded exactly as Ben Joseph Ricafrente defined it; the code doesn't change it.

## Key prompts (Ben Joseph Ricafrente's words)

1. Setting the working style: *"I want it to be interactive, more of you asking me questions with sensible choices rather than giving the answers straight away."*
2. Asking for assumptions: *"ok can you work on the data assumptions you will propose so I approve?"*
3. Approving and starting the build: *"1. OK on Quezon City 2. OK 3. yes with a toggle 4. yes generate this 5. ok as-is … for now build it, so I come back to it after my break. I want this to be simple but effective in demonstrating the model we've built."*

## What was built (Nov 25, 2026)

1. **Synthetic data** (`data/generate.py`, fixed seed so results repeat):
   - 600 stores in one Quezon City zone (85% sari-sari and minimarts, 15% grocers), each with a delivery window.
   - 5 years of daily orders (2022–2026) with Ben Joseph Ricafrente's calendar (dry peak Sep–Dec, ice cream peak Mar–May, off-season Jun–Aug), 8% yearly growth, busier weekends and a few one-off spikes.
   - Two sample days for 2027: a normal Tuesday in February (98 orders) and a peak Tuesday in December (155 orders).
2. **Ben Joseph Ricafrente's recipe in code** (`run_recipe` in the generator): per season and vehicle type, it counts stores and kg per day, takes the bigger of kg ÷ capacity and stores ÷ stops per vehicle, keeps enough vehicles for 90% of days, adds 1 backup, and brings past years up to 2027 with the measured growth. Output: `data/fleet_recipe.json`.
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

## First results (Nov 25, replaced on Nov 26)

These were the first version's numbers. The recipe and sample days changed on Nov 26 (see below), so the current results are in the Nov 26 entry.

| Day | Fleet | Type A verdict | Type B verdict | Delivered | Distance | Cost |
|---|---|---|---|---|---|---|
| Normal (Feb) | Recipe: A 2, B 6 | About right (1 spare) | About right (1 spare) | 120 of 120, all on time | 146 km | ₱21,580 |
| Peak (Dec) | Recipe: A 3, B 9 | About right | About right | 181 of 181 | 244 km | ₱35,553 |
| Peak (Dec) | Normal-season fleet: A 3, B 6 | About right | Too small | 142 of 181 (39 dry deliveries missed) | 188 km | ₱28,146 |

The last row was already the demo's main point: the normal-season fleet can't cope with a December day, and the peak fleet from Ben Joseph Ricafrente's recipe can.

## The Type A finding

- Type A on the peak day reads "too big": rounding growth up on a small fleet (2 vans x 1.08 = 2.16, so 3, plus 1 backup = 4) gives 2 spare vans on a day that needs 2. Ben Joseph Ricafrente decided (Nov 26) to keep it and present it as a finding: the prototype catching what the recipe alone cannot.

## Nov 26, 2026

- Simplified the page for a 30-minute presentation: removed the recipe table and chart (they move to a slide) and merged the two utilisation tiles into one.
- Decided with Ben Joseph Ricafrente: no AI inside the app; host it on GitHub Pages.
- Tried a claude.ai artifact as the app link. Artifacts block images from other sites, so the street map would not show there. GitHub Pages was chosen instead.
- Step 6 (growth) changed to Ben Joseph Ricafrente's version: size the fleet on last year's days only, then add the growth measured over the 5 years (8.1%), then the backup. Previously every past year was scaled up before counting. New fleets (rounding up): Jan–Feb A 3, B 7; Mar–May A 4, B 7; Jun–Aug A 3, B 7; Sep–Dec A 4, B 10.
- Ben Joseph Ricafrente confirmed step 6 rounds up.
- Sample days changed to busy days (order rates 10% above a typical day for that date), since the recipe sizes the fleet for the busy end of the season (the 90% day), not the average day. Normal day: 111 orders; peak day: 163 orders.
- Fixed the synthetic history so ice cream follows its own calendar (Mar–May peak) instead of rising with the dry-goods peak in Sep–Dec, as Ben Joseph Ricafrente's calendar says.
- Results with the recipe fleets: normal day (A 3, B 7): both about right, 137 of 137 deliveries. Peak day (A 4, B 10): Type B about right, 185 of 185 deliveries; Type A too big (2 of 4 vans idle). Peak day with the normal-season fleet (A 3, B 7): Type B too small, 25 deliveries missed.

## Nov 27, 2026

- Applied Ben Joseph Ricafrente's branding to the app, the deck and the Part 1 PDF. Palette: Bone #C8C6AF, Muted Teal #95A78D, Rosy Taupe #BD897E, Vibrant Coral #F87666, with light sage tints as backgrounds. Fonts: Work Sans for titles and labels, Source Serif 4 for body text (bundled in `app/vendor/fonts` with their OFL licences, so the app needs no font CDN). Icons are flat duotone (teal and coral).
- Ben Joseph Ricafrente picked the look from three mockups (Warm paper, Sage, Blush) and the icon style from two (line + tint, flat duotone).
- Route colours were re-picked to sit with the palette and checked for colour-blind separation and contrast against the map background.
- Made the app easier to follow for someone with no context, at Ben Joseph Ricafrente's request ("the prototype should also assume that the reader has no context"):
  - The title asks the question the app answers: "Is this fleet the right size?"
  - A context strip explains the situation, the question and how to read the colours.
  - Three numbered buttons replace the controls and follow the demo: normal day, peak day with the normal fleet, peak day with the recipe fleet. Each shows one sentence on what is being tested. The + / − fleet controls moved into a closed "Try your own fleet" panel.
  - The verdict is the headline, in plain words, above the five measures from the brief (vehicles used, time on the road, distance, on-time rate, cost).
  - Vehicles are named in plain words everywhere ("refrigerated van" and "dry truck"; Van 1, Truck 1). The map has a legend, the vehicle list shows a fill bar, and idle vehicles are grouped on one line. The assumptions moved into an "About this data" panel.
- Ben Joseph Ricafrente found the page still too busy ("a lot of texts/square tiles") and asked for a simpler mock-up. He approved a one-screen version, which replaced the page above:
  - A narrow panel on the left and the map on the right, with no scrolling on a laptop screen.
  - Each vehicle is drawn as an icon: filled if it went out, faded if it stayed at the depot. Each vehicle type gets one tag (About right, Too small or Too big) and one short line.
  - Four plain numbers without boxes: delivered on time, time on the road, distance, cost. With the vehicle icons, these cover the five measures in the brief.
  - Removed: the context cards, the vehicle list, the "Try your own fleet" and "About this data" panels. The assumptions stay in `docs/part2/data-assumptions.md`.
- New colour palette, chosen by Ben Joseph Ricafrente: Honeydew, Ash Grey, Grey Olive, Faded Copper and Sunlit Clay. It replaces the sage-and-coral palette across the app, the Part 1 PDF and the deck. Route colours and the missed-delivery red are unchanged.
