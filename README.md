# Locus pre-sales assignment

Working repository for the Locus Presales Manager (Philippines/Thailand) assignment: allocating Type A (refrigerated) and Type B (dry) vehicles across six Metro Manila distributors of an FMCG company.

Deadline: Friday, November 27, 2026.

## Contents

| Path | What it is |
|---|---|
| `docs/part2/data-assumptions.md` | Synthetic data assumptions for the prototype (approved by BJ) |
| `docs/part2/build-log.md` | How the prototype was built: tools, prompts, sticking points, results |
| `index.html`, `app/` | The dispatch planner prototype (static web page, no build step) |
| `data/generate.py` | Generates the synthetic stores, 5-year history, sample days and runs BJ's sizing recipe |
| `data/*.csv`, `data/fleet_recipe.json` | Generated data and recipe output |

## Running the prototype

Live app: https://bowsprit-revolution.github.io/locusbjlr/

To run it locally, open `index.html` through any static web server, for example:

```
python3 -m http.server 8000
# then open http://localhost:8000
```

To regenerate the data (same seed, same result): `python3 data/generate.py`.

## How AI was used

Per the brief, AI is not used for the Part 1 thinking, approach or models. For Part 1, Claude only asked questions, checked arithmetic and summarised BJ's own answers; every decision is BJ's. AI will be used to build the Part 2 prototype and to generate synthetic data.

## Status

- [x] Part 1 thinking sessions (Nov 25)
- [x] Data assumptions (Nov 25)
- [x] Synthetic data and prototype v1 (Nov 25)
- [ ] Approach PDF
- [ ] Deck and submission
