# Build prompt: Vidyut Panchayat agent council

Copy everything below the line into a coding-agent session opened at the repository root. Treat this as an implementation request, not a request for another plan. Work through the checkpoints in order, run the checks, and continue until the complete council is integrated.

---

You are building the **Vidyut Panchayat agent council** in this existing TypeScript/Vite/Three.js repository. The city explorer, facilities, cars, buses, trains, camera and beach are already implemented. Your task is to build the missing simulation, negotiation, safety, planning, worker, UI integration and evidence pipeline end to end. Make the existing city display real engine output. Keep the project usable offline and avoid any external API or LLM dependency.

## Read these files first

1. `architecture.md`: authoritative product and algorithm specification. Read sections 1–15 and 17–24, especially the ten agents (6), power network and cyclone scenario (7), tick pipeline (8), negotiation and failure protocol (9), Constitution (10), damage and metrics (11), baselines (12), plan/approval/pre-simulation/verification (13), worker contract (15), and acceptance tests (19). Resolve contradictions explicitly and document the decision. The numerical profile values and scenario timings are **initial**, so preserve their intent while validating any changes.
2. `timeline.md`: team ownership, checkpoint definitions C0–C4, cut order and integration handoffs. Treat the 24-hour clock as a planning reference, not an excuse to omit work.
3. `CONTRACT.md`: shared-contract change log. Update it whenever contract or data fields change.
4. `data/scenes/city_v1.json` and `src/world3d/sceneSchema.ts`: actual visual city data, facility IDs and placement rules. Preserve this file's working visual layout and customization fields. Add electrical data separately or extend it with a validated versioned field; do not confuse visual road buses with electrical distribution buses.
5. `src/app/main.ts`, `src/app/store.ts`, `src/app/modes.ts`, `src/app/mockEngine.ts`, `src/ui/CityExplorer.ts`, `src/world3d/city.ts`, `src/world3d/powerLines.ts`, `src/world3d/particles.ts`, `src/world3d/bidArcs.ts`, `src/world3d/cascade.ts`, `src/compare/splitScreen.ts`, `src/worker/bridge.ts`, `src/worker/engine.worker.ts`. Inspect existing behavior and preserve navigation, selection and transport animation. Many future-feature files are zero-byte placeholders: **check contents before assuming anything is implemented**.
6. `docs/city_customization.md`, `docs/protocol.md`, `docs/damage_model.md`, `docs/impact_model.md`, `docs/demo_script.md`, `docs/qa_cheatsheet.md`, `scripts/batch.ts`, `package.json` and the current tests. The protocol/damage/impact docs and batch script are presently placeholders. Fill them with the implemented behavior.

First report a short inventory of what is already functional and what is still placeholder. Then implement the system. Do not replace the city renderer wholesale, overwrite authored geometry, or leave a mock allocation as the final behavior.

## Core architecture and constraints

- `src/engine/` is pure deterministic TypeScript. It can import from `src/contract/` and its own modules, never DOM, Three.js, UI or Web Worker globals. The same entry point must run in Node for batch experiments and in a browser worker.
- `src/contract/types.ts` and `schemas.ts` define and validate the data shared by engine, worker and UI. Validate JSON on load and every worker message at the boundary. Reject invalid input with a visible error instead of silently defaulting.
- `src/worker/bridge.ts` is the only application entry to engine operations. The app/world/UI should consume contract types and worker messages, not call `src/engine` internals.
- No server, database, network call, API key or learned AI model is needed. The ten autonomous agents are deterministic software actors with private state and a message-driven negotiation protocol, not chatbot prompts.
- Use seeded randomness only (`src/engine/rng.ts`), stable agent ordering and quantized allocation values. No `Math.random()` or `Date.now()` inside the engine. Identical inputs must yield a byte-identical serialized tick log.
- The Constitution is a stateless validator. It rejects illegal proposals but **never chooses allocations**. Each live agent computes a candidate from its own received bids; a coordinator may advance ticks and deliver messages but cannot make the allocation decision.
- Keep the existing browser city interactive and performant. Simulation animation comes from tick data; transport ambience can remain independent. Clearly label synthetic population exposure and modelled harm.

## Checkpoint 1 — contracts and deterministic world

Implement the currently empty `src/contract/types.ts` and `schemas.ts`. Define versioned schemas/types for the electrical network, profiles, scenario events, `Tick`, `AgentTick`, line flows, negotiation messages/traces, metrics, plan blocks, pre-sim distributions, verification and all worker commands/replies. Add `data/agents/profiles.json` with the ten agents and initial values from architecture section 6. Add `data/scenarios/cyclone_24h.json` with the 144-tick schedule from section 7.4. Model the substation, East/Central/West electrical buses and feeder capacity graph from section 7.2; make the mapping to actual facility IDs explicit. The Panchayat Square is a civic landmark, not a utility agent.

Implement `rng.ts`, `clock.ts`, `events.ts`, `world.ts` and reserve updates. A tick represents ten simulated minutes; 24 hours is 144 ticks. Demand noise, supply changes, feeder failures, backup use/recharge and agent down/rejoin events follow the same seeded scenario on replay. Provide a pure `run`/`step` interface that has no browser dependencies. Handle disabled agents as unmanaged loads exactly as described in architecture section 6, including capacity and supply clipping; surface the modelling assumption in the UI.

**C0 acceptance:** JSON schemas reject duplicate/unknown IDs, invalid negative capacities, malformed event timing and impossible network references. A short 10-tick replay is deterministic in Node. `npm run typecheck` and `npm test` pass. Update `CONTRACT.md` with units, IDs, version and field meanings.

## Checkpoint 2 — actual agent negotiation

Implement `src/engine/agents/{baseAgent,valueFunction,concession}.ts` and `src/engine/protocol/{messages,bus,clearing,triage,negotiation,twoPhaseCommit}.ts`. Each agent holds its private reserve, urgency, dependency stress, last bid and last committed allocation. Build the `BID`, `COUNTER`, `CONCEDE`, `ACCEPT`, `PREPARE`, `COMMIT`, `ABORT` and `HEARTBEAT` trace with sender/recipient/tick/round/reason. The message bus deterministically supports drops, delay and crash injection. Keep messages available to the UI; do not generate fictional negotiation text later in the renderer.

Use the architecture's monotone concession curve, bus-local and root price clearing, feasible upper bound at the round cap, and the triage ladder when supply or a feeder cannot cover minimum viable demand. Implement tier-aware fairness rotation. Every live agent runs the same clearing function over **its own view** of received bids. Quantize allocations to 0.01 PU before hashing. Two-phase commit applies an allocation only when all live agents agree on the hash and the Constitution passes. On mismatch: abort, rebroadcast/retry once, then project the previous committed allocation onto current constraints using the documented safe fallback. On crash: heartbeat detection, hold last allocation clipped to feasibility, re-clear the remainder, and allow rejoin.

Implement `src/engine/constitution/invariants.ts` with I1–I7 from architecture section 10. Make zero *applied* violations an invariant, and separately count rejected illegal proposals. Cover feeder as well as electrical-bus caps. Document any numeric tolerance/rounding policy. Update `docs/protocol.md` with the **actual** message sequence, price search, failure behavior and trace example.

**C1/C2 acceptance:** Tests prove concession monotonicity, bisection termination and feasibility, triage under 55 PU and Bus-Central failure, consistent consensus, dropped-message abort/fallback, crash/rejoin, and no applied capacity violation. A normal tick and a crisis tick include real message traces and allocations.

## Checkpoint 3 — consequences, metrics and baselines

Implement `src/engine/dependencyGraph.ts`, `damage.ts`, `policy/{fairness,rotation}.ts`, `metrics/{scoring,impact}.ts` and the three baselines. Use prior-tick service levels for the dependency cascade. Account for reserve-backed service, reserve depletion/recharge, priority-weighted harm, critical uptime, hospital minimum service, within-tier Jain fairness, and synthetic person-hours of essential-service loss. Do not claim lives saved. Report exactly which synthetic exposures are used.

Run static priority, equal split and centralized one-tick optimum against **the same** scenario and seed. The optimum maximizes the documented one-tick weighted objective subject to the tree's supply and line caps; test it against a small brute-force oracle or exhaustive discrete cases before claiming exactness. Do not claim the council wins every metric or every seed. If a result is unfavorable, report it honestly.

**Acceptance:** All four strategies produce complete 144-tick records with the same metrics. A regression test covers lagged cascade and reserve exhaustion. Batch tests over at least 200 seeds check I1–I4, zero applied violations and deterministic replay. Fill `docs/damage_model.md` and `docs/impact_model.md` with formulas, assumptions and units.

## Checkpoint 4 — plans, pre-simulation and approval

Implement `src/engine/planning/{planner,planDocument,presim,verify}.ts` and `constitution/planValidator.ts`. Agents negotiate a three-hour (18-tick) forward plan from forecast supply in 30-minute blocks with explicit contingencies. Validate every plan block and branch against pessimistic supply (I8). Generate a readable plan document with allocation schedule, protected services, expected concessions, safety report, risks, contingency triggers and the exact proposal ID/hash.

Pre-simulate 30 seeded futures (plan and baselines) with bounded demand noise, forecast error, message drops and event timing. Return p10/p50/p90 and min/max for PHL, damage, hospital minimum service, fairness and violations. Keep pre-simulation reproducible and separate its seeds from the live run. Implement the state machine in architecture section 13.4: HUMAN mode pauses at the plan screen for approve/reject; AUTO mode approves only if every guardrail passes and otherwise escalates to human. Rejection with a note triggers renegotiation; drift or failed contingency triggers replan. Verification compares actual values with the pre-sim envelope and reports PASS/DRIFT/FAIL with per-metric evidence.

**Acceptance:** Illegal plans are rejected, approval cannot execute a different or stale plan ID, auto guardrail failure stops for a human, rejection causes replan, and verification has tests for all three classifications. Pre-sim is deterministic for a fixed seed and does not block the browser main thread.

## Checkpoint 5 — worker bridge and real city integration

Implement `src/worker/engine.worker.ts` and `bridge.ts` with typed `INIT`, `RUN`, `PAUSE`, `STEP`, `SEEK`, `TOGGLE_AGENT`, `TRIGGER_EVENT`, `SET_MODE`, `REQUEST_PLAN`, `REQUEST_PRESIM`, `APPROVE`, `REJECT` and typed replies listed in architecture section 15. Use a single tick history with replay/fork semantics; toggling or injecting an event from a past point creates a new branch rather than rewriting the previous run. Prevent duplicate timers, stale worker responses and race conditions during pause/seek/approval. Propagate validation and worker errors visibly.

Wire `src/app/main.ts`, `store.ts` and `modes.ts` to the bridge. Fill existing UI placeholders (`MetricsPanel`, `Timeline`, `AgentToggles`, `NegotiationFeed`, `PlanDocument`, `ApprovalBar`, `PreSimPanel`, `VerificationPanel`, `Presenter`) and 3D effect placeholders (`powerLines`, `particles`, `bidArcs`, `cascade`) as necessary to show **actual** tick data. Preserve the current minimal black-glass explorer, camera, facility selection, shoreline, road traffic, buses and elevated rail. Map the ten agent IDs to the existing utility facility IDs. Show supply/demand, allocation, feeder loading, reserve state, service status, negotiation messages, fairness, modelled harm, violations and blocked proposals. City power effects and building status must update from committed ticks, not from mock random timers. Keep disaster visuals tied to scenario events and service outcomes.

The UI's existing pause/speed control currently drives ambient transport. Make simulation pause/speed semantics clear and keep scene motion in sync where practical. Keep the 3D scene a renderer: it never computes allocation. Use `src/app/mockEngine.ts` only for isolated UI development or tests, not as the final live source.

**C3 acceptance:** Browser demo starts without network, negotiates and advances through the cyclone, visibly drops supply at 2h, shows feeder congestion/triage near 9h, can toggle an agent, shows safe fallback on an injected dropped message, opens a real plan and pre-sim evidence, permits approval, and later shows verification. City navigation and selection still work. No console errors. Maintain usable frame rate on the presenting Mac.

## Checkpoint 6 — comparisons, batch evidence and delivery

Implement `src/compare/splitScreen.ts` using two lockstep worker instances or a cheaper synchronized comparison if measured performance requires it. Present the same scenario and seed for council vs baseline with truthful labels. Implement `scripts/batch.ts` using the same pure engine and write CSV plus a concise summary in `experiments/results/`. Run the architecture's experiment matrix when scenarios exist: 3 scenarios × 4 strategies × 50 seeds = 600 runs. If only the cyclone scenario is complete, report a smaller **actual** matrix and do not label missing scenarios as measured. Provide median and p10–p90, plus objective-specific comparison to the centralized optimum. Record seed, scenario, strategy and engine/contract version with every result.

Complete the relevant docs and a short runbook: how to launch locally/offline, replay a seed, inject an event, inspect messages, approve a plan and run batch results. Update `README.md` and `CONTRACT.md`. Make an offline production build with `npm run build`; test it without runtime network requests. Existing city geometry and its customization API must continue to work. Do not invent statistics, successful experiments, or a submission claim.

## Testing and final delivery rules

At each checkpoint, run `npm run typecheck` and the relevant Vitest tests; fix failures before proceeding. Also run `npm run build` and one real browser smoke test at integration. Include tests for malformed input, deterministic replay, per-tick invariants, consensus and fallback, triage, cascading impact, plan approval/guardrails, worker command ordering and baseline fairness. Prefer tests that would fail for a real bug over tests that mirror source code.

Stop and call out a genuine contradiction only if it blocks a correct implementation; otherwise make a documented, reversible decision and continue. If scope must be reduced, preserve the Must tier from `architecture.md`: real negotiation, Constitution and counters, three baselines, tick-driven city, playback, agent toggles and evidence. State any omitted stretch feature plainly. Do not stop after creating files or making tests green if the UI still uses mock data.

At completion provide: implemented behavior, exact checks performed and results, a working local run command, any material limitations, changed contract/data files, and a short trace of one crisis tick showing bids → agreement or abort → applied feasible allocation → service consequence. The final explanation should make clear which decisions came from agents and which were only checked by the Constitution.
