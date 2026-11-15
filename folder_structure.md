# Vidyut Panchayat — Repository Structure & Architecture Guide

This document provides a clean, comprehensive map of the **Vidyut Panchayat** codebase, explaining the role of every directory, how components interact, and clarifying the boundaries between code, simulation, data, and machine learning pipelines.

---

## 1. High-Level Directory Overview

```
vidyut-panchayat/
├── src/                      # Frontend UI, 3D WebGL Digital Twin, and Pure TS Multi-Agent Engine
│   ├── engine/               # Pure TypeScript simulation engine (zero DOM; runs in worker/node)
│   ├── worker/               # Web Worker runtime and typed message bridge
│   ├── world3d/              # Three.js 3D city scene, atmospheric weather, and dynamic lighting
│   ├── audio/                # Procedural Web Audio synthesizer and spatial cues
│   ├── compare/              # Split-screen baseline comparison renderer
│   ├── contract/             # Typed data schemas (Zod) and engine interface definitions
│   ├── ui/                   # Council chamber UI, operator decision guide, and reality pages
│   └── app/                  # Application bootstrap, state store, and main loop
│
├── ml/                       # Python Machine Learning Pipeline (Training, Inference & Data Prep)
│   ├── train_xgboost.py      # Multi-output electricity demand model training
│   ├── train_weather.py      # Wind and precipitation forecasting models
│   ├── infer_*.py            # Multi-horizon inference scripts for held-out dates
│   ├── prepare_*.py          # Raw telemetry and weather dataset ingesters
│   └── Informer2020/         # Transformer benchmark baseline repository
│
├── data/                     # Scenarios, Scene Geometries & Client-Side Replay Datasets
│   ├── scenes/               # Authored 8x8 city layout and district styles (city_v1.json)
│   ├── scenarios/            # 24-hour disaster event timelines (cyclone_24h.json, etc.)
│   ├── network/              # Electrical substation, bus, and feeder topologies
│   ├── agents/               # 10 utility profiles, priorities, and backup capacities
│   ├── raw/                  # Downloaded raw historical datasets (electricity, weather, telemetry)
│   ├── processed/            # Cleaned, hourly time-series CSVs
│   └── ml/                   # Static JSON replay episodes bundled into client browser
│
├── experiments/              # Experimental Validation, Benchmarks & Audit Trails
│   ├── results/              # Core engine CSV logs, summary benchmarks, and trace recordings
│   └── ml/                   # Frozen ML policy audits, candidate sweeps, and jury evidence
│
├── artifacts/                # Trained Model Weights & Offline Checkpoints
│   ├── xgboost/              # Exported booster models and validation error buffers
│   ├── weather/              # Coastal wind and rainfall model checkpoints
│   └── informer/             # PyTorch Informer transformer model checkpoints
│
├── docs/                     # Technical Architecture, Impact Models & Validation Documentation
│   ├── assets/               # Showcase screenshots, diagrams, and demonstration GIFs
│   ├── implementation_validation.md  # Formal verification record across all deliverables
│   ├── ml_and_policy_evidence.md     # Electricity demand & weather benchmarks, telemetry, and frozen audits
│   ├── protocol.md           # Multi-agent negotiation protocol (BID, CONCEDE, COMMIT) & Invariants
│   ├── damage_and_impact_model.md    # Cascade degradation mathematics & synthetic population exposure (PHL)
│   ├── audio_and_visual_design.md    # Spatial Web Audio synthesizer & dynamic 3D lighting cycles
│   ├── demonstration_and_qa_runbook.md # Jury walkthrough, presentation script & technical Q&A defense
│   ├── city_customization.md # 3D city scene customization and procedural block overrides
│   └── civic_discussion.md   # Disaster council dialogue and scenario briefing model
│
├── scripts/                  # Automated Test Suites, Batch Runners & Packaging
│   ├── batch.ts              # Multi-seed Monte Carlo matrix batch execution
│   ├── browser-smoke.ts      # Playwright end-to-end browser smoke test
│   ├── council-room-smoke.ts # 3D Council chamber interactive inspection test
│   ├── disaster-visual-smoke.ts # Cyclone storm weather and signal verification
│   ├── jury-verify.ts        # One-command full jury verification harness
│   └── package-offline.ts    # Single-command offline deployment packager
│
├── tests/                    # Vitest Unit & Integration Test Suite (18 test files)
├── presentation/             # Architecture slide decks and high-resolution diagrams
├── demo/                     # Offline bundle directory (gitkeep)
├── package.json              # NPM scripts and dependency definitions
├── tsconfig.json             # Strict TypeScript compiler configuration
├── vite.config.ts            # Vite client build & Vitest test runner configuration
├── architecture.md           # Master architectural blueprint and design invariants
├── Hackathon Final Report Vidyut Panchayat (विद्युत पंचायत).pdf # Official Hackathon Final Report Document
└── README.md                 # Primary project overview, quickstart & visual showcase
```

---

## 2. Clarifying the Three ML Directories

A common point of confusion is having multiple directories containing `"ml"`. Each serves a completely different, decoupled function in the system:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       MACHINE LEARNING SUBSYSTEMS                                      │
├───────────────────────────────┬───────────────────────────────┬────────────────────────────────────────┤
│ 1. ml/                        │ 2. data/ml/                   │ 3. experiments/ml/                     │
│ (Python Pipeline)             │ (Browser Replay Assets)       │ (Frozen Audit Reports)                 │
├───────────────────────────────┼───────────────────────────────┼────────────────────────────────────────┤
│ • Written in Python 3.10+     │ • Written in pure JSON        │ • Written in JSON & Markdown           │
│ • Trains XGBoost & Informer   │ • Precomputed test episodes   │ • Frozen audit evidence                │
│ • Ingests raw historical data │ • Bundled into web client     │ • 30-day policy confirmation sweeps    │
│ • Runs feature engineering    │ • Enables 100% offline replay │ • Candidate hyperparameter selection   │
│ • Outputs model weights into  │ • Zero Python dependencies    │ • Master jury evidence manifest        │
│   artifacts/                  │   required in the browser     │   (jury_evidence_manifest.json)       │
└───────────────────────────────┴───────────────────────────────┴────────────────────────────────────────┘
```

1. **`ml/` (Source Code)**:
   The developer's workbench for offline data science. It contains training scripts (`train_xgboost.py`, `train_weather.py`), inference runners (`infer_electricity.py`), and dataset preparation tools.
2. **`data/ml/` (Client Bundles)**:
   Read-only data packages consumed directly by the web application (`src/ui/RealityPage.ts`, `src/ui/MLEvidence.ts`). By bundling precomputed inference for held-out dates (e.g. `browser_replay_v1.json`), the live web application requires **zero Python runtimes, zero APIs, and zero external network calls**.
3. **`experiments/ml/` (Evidence & Audits)**:
   Immutable verification evidence. Contains the parameter validation sweeps (`blend_validation_*.json`), the frozen 30-date policy audit summaries (`revision_audit_summary.json`), and the model error comparison tables (`model_comparison.json`).

---

## 3. Core Engine Architecture (`src/engine/`)

The core multi-agent crisis simulation engine is implemented in pure TypeScript with zero DOM or browser dependencies, allowing it to execute identically inside Web Workers and Node.js batch runners:

- **`agents/`**: Autonomous utility agents (Hospital, Emergency, Water, Telecom, Residential, etc.) with private states, diesel/battery reserves, and dynamic concession curves.
- **`protocol/`**: Decentralized negotiation engine implementing `BID` ➔ `COUNTER` ➔ `CONCEDE` ➔ `PREPARE` ➔ `COMMIT` over a virtual bus.
- **`constitution/`**: Stateless hard safety checker enforcing capacity invariants I1–I4 (physical grid limits, atomic commits, 0.01 PU quantization, and verification guardrails).
- **`planning/`**: 18-tick forward planner, Monte Carlo pre-simulation with 10-seed noise envelopes, and post-execution verification auditor.
- **`baselines/`**: Centralized Optimum, Static Priority, and Equal Split benchmark comparison engines.

---

## 4. Frontend & 3D Digital Twin (`src/world3d/` & `src/ui/`)

- **Three.js City Digital Twin**: Renders the 8x8 authored grid, traffic flow, rail network, coastal boardwalk, and elevated power flow lines.
- **Disaster Atmospheric Weather**: Wind-driven rain streaks, storm sky tones, and atmospheric fog tied to cyclone landfall.
- **Interactive Weather Toggle**: 1-click header control allowing instant switching between **Raining** (cyclone disruption) and **Sunny day** (calm city).
- **3D Council Chamber**: Full-screen courtroom room view featuring 10 procedural delegates around an interactive round table with physical name cards, microphones, and speech cards.
- **Procedural Audio**: Real-time Web Audio synthesizer providing spatial city ambience, coastal waves, traffic hums, emergency sirens, and cyclone storm wind.

---

## 5. Verification Commands

To verify and reproduce all parts of the system cleanly:

```bash
# 1. Typecheck and verify architectural import boundaries
npm run typecheck
npm run check:boundaries

# 2. Run full 18-file Vitest test suite
npm test

# 3. Build optimized production web client
npm run build

# 4. Verify browser smoke tests
npm run test:browser
npm run test:council
npm run test:historical-browser

# 5. Run full jury evidence audit verification
npm run jury:verify
```
