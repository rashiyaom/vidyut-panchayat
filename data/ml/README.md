# Bundled Browser Datasets (`data/ml/`)

This directory contains **precomputed, static JSON replay episodes and forecast evidence** consumed directly by the client-side Three.js frontend and Web Worker engine.

---

## Why This Folder Exists

The browser client cannot run heavy Python dependencies (`xgboost`, `torch`, `scipy`) on client devices without massive bundle overhead or cloud round-trips. 

Instead, the offline Python pipeline in `ml/` evaluates held-out dates and exports clean, self-contained JSON datasets to `data/ml/`. This allows:
1. **100% Offline Demonstration**: The 3D browser simulation runs completely offline without network latency, external APIs, or server processes.
2. **Deterministic Replay**: Every browser session sees the exact same historical forecast and measured ground truth.
3. **Zero Dependencies**: Pure TypeScript interfaces consume the typed schemas directly without native binaries.

---

## Key Files

| File | Purpose | Consumer |
|---|---|---|
| `browser_replay_v1.json` | 3-hour held-out electricity demand forecasts, measured actuals, and council allocations for `2014-08-10`. | `src/ui/RealityPage.ts`, `src/ui/MLEvidence.ts`, `src/app/main.ts` |
| `weather_browser_replay_v1.json` | Hourly wind speed and precipitation forecasts for the historical replay episode. | `src/ui/RealityPage.ts`, `src/ui/MLEvidence.ts`, `src/world3d/environment.ts` |
| `evidence_v1.json` | Model performance summary, horizon MAEs, training periods, and jury verification hashes. | `src/ui/MLEvidence.ts`, `src/ui/RealityPage.ts` |

---

## Regeneration

These files are populated by:
```bash
npm run ml:infer -- --date 2014-09-15 --activate
npm run weather:infer -- --date 2014-09-15 --activate
npm run evidence:ml
```
