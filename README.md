# Locus pre-sales assignment

Ben Joseph Ricafrente's submission for the Locus Presales Manager (Philippines/Thailand) assignment: sizing the Type A (refrigerated) and Type B (dry) fleet for six Metro Manila distributors of an FMCG company.

This repository holds Part 2, the dispatch planner prototype. The Part 1 approach is in the PDF sent with this link.

## Contents

| Path | What it is |
|---|---|
| `docs/part2/data-assumptions.md` | Synthetic data assumptions for the prototype (approved by Ben Joseph Ricafrente) |
| `docs/part2/build-log.md` | How the prototype was built: tools, prompts, sticking points, results |
| `index.html`, `app/` | The dispatch planner prototype (static web page, no build step) |
| `data/generate.py` | Generates the synthetic stores, 5-year history, sample days and runs Ben Joseph Ricafrente's sizing recipe |
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

Per the brief, AI is not used for the Part 1 thinking, approach or models. For Part 1, Claude only asked questions, checked arithmetic and summarised Ben Joseph Ricafrente's own answers; every decision is Ben Joseph Ricafrente's. AI was used to build the Part 2 prototype and to propose the synthetic data assumptions, which Ben Joseph Ricafrente approved.
