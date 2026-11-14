# Implementation and validation — 14 November 2026

Engine 1.1.0 / contract v1. Local implementation is complete through the six build-prompt checkpoints, with the limitations below. This is a local validation record, not a merge, publication, team review, or event submission claim.

## Delivered behavior

- Ten private-state deterministic utility actors, independent received-bid views, bus/root price clearing, minimum-load triage, bounded fairness rotation, two-phase hash agreement, one retry and physically safe fallback.
- Stateless Constitution with supply, bus, feeder, demand, quantization, reserve and agreement checks; blocked proposals separated from applied violations. Unmanaged participation toggles and software crash hold/rejoin.
- Lagged dependency service, partial backup exhaustion/recharge, synthetic overlapping person-hours, damage, critical uptime, hospital minimum, tier fairness and weighted allocation objective.
- Static priority, equal water filling and exact linear tree optimum. Brute-force discrete oracle tests the optimum. Static and optimum coincide under the specified weights/objective.
- Six-block forward planning, pessimistic envelope and contingency validation, content-bound approval, rejection/replanning, 30 seeded futures, PHL fan chart, all metric distributions, AUTO guardrails and PASS/DRIFT/FAIL verification.
- Typed worker-only application boundary, serialized command/timer operations, visible errors, replay and immutable past branches. Generation-checked synchronized comparison with recovery after errors.
- Original authored city, coast, transport, navigation and customization preserved. Real ticks drive facility colors, status rings, line loading/particles, negotiation arcs and dependency ripples. No live mock source.

## Exact final checks

| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run check:boundaries` | Pass: engine imports only itself/contract; no engine randomness/time/browser globals; UI/app/world do not import engine |
| `npm test` | 9 files, 38 tests passed; 28.32 seconds |
| Safety matrix inside Vitest | 200 seeds × four strategies × 144 ticks = 115,200 applied ticks; zero violations; periodic serialized replay checks |
| `npm run benchmark` | Apple M3, Node v26.13.1: tick median 0.414 ms, p 95 0.686 ms, max 2.443 ms; 30 futures ×18 ticks ×4 strategies in 432.586 ms |
| `npm run batch` | 1 implemented scenario ×4 strategies ×50 seeds =200 measured full-day runs; CSV and quantile summary saved |
| `npm run demo` | Production build succeeds; refreshed static offline bundle; Vite advisory chunk-size warning remains |
| `npm run test:browser` | Production Chrome completes all 144 ticks, rejection/approval, crash/rejoin, compare, seek/fork, forced abort/fallback, facility rebuild/selection, offline stepping and unmanaged toggle |
| Browser network/errors | No external requests; no console errors; network disabled after load and simulation continues |
| Comparison frame rate | 60.175 fps in the headless Chrome measurement; not a guarantee across devices |
| `git diff --check` | Pass |

Machine-readable evidence: `experiments/results/browser-smoke.json`, `performance.json`, `cyclone.csv`, `summary.md`, `crisis_trace.json`; screenshot: `browser-smoke.png`. The browser records an actual FAIL verification and escalation, rather than arranging a successful prediction. Frame count/draw-call evidence is recorded without claiming the initial 150-draw-call target is always met (final smoke snapshot: 200 calls including overlays).

## One measured crisis tick

Seed 0, cyclone timing jitter enabled, tick 56 (09:20), supply 55 PU and Central cap 30 PU:

1. Hospital bids demand 30.42, minimum 17, value 2.32416, reserve 2.00119h. Other live actors broadcast their own bids.
2. Actors clear their individual views and exchange PREPARE hashes. Directed message losses cause ABORT, rebroadcast/retry, then another ABORT.
3. The deterministic fallback projects the previous committed vector to current constraints: total 50.16 PU; Central 30.00, West 20.16, East 0.00. Applied hash `5aa9ea51`. Zero applied violations.
4. Hospital receives 12.39 PU. Backup covers 0.59270 of demand, leaving 1.90240h reserve and own service 1.00; lagged dependency loss reduces effective service to 0.68260 (rationed).

Agents compute the normal candidate vectors and concessions. The emergency projection is the documented fallback policy. The Constitution only checks legality; it does not choose an allocation or protect minimum service when capacity cannot support it.

## Contract/data changes

- `src/contract/types.ts` and `schemas.ts`: shared configuration, tick, trace, metrics, plan, distributions/fan, approval, verification and worker envelopes.
- `data/agents/profiles.json`: ten IDs matching utility facility IDs, priorities, demand/minima, reserves and synthetic exposures/dependencies.
- `data/network/electrical_v1.json`: substation → East/Central/West → ten feeders, separate from transport buses.
- `data/scenarios/cyclone_24h.json`: complete 144-tick schedule; exact live timing, randomized robustness/future timing.
- `CONTRACT.md`: units, fields, identity and lifecycle rules, plus documented resolutions of specification conflicts. Existing `data/scenes/city_v1.json` geometry/layout was preserved.

## Material limits

Only cyclone is implemented: no fabricated extra scenarios or 600-run result. No video, slides, hosted publication or submission was produced. Actors share one process, bids are assumed honest, the checksum is not cryptographic, and the electrical tree is not AC load flow. No stale-bid cache is used; late bids are dropped at the barrier. COMMIT application is atomic inside the simulator; fault injection applies to BID/PREPARE. Human approval pauses simulated time. Rejection notes are recorded, not interpreted as natural-language policy. Histories are in memory and are lost on reload.

The council does not win every metric. In the measured matrix its median PHL is worse than static/optimum, although its fairness and damage are better than static. All exposures are synthetic and overlapping; no lives-saved claim is supported.

## Launch

`npm run dev`, then use the displayed local URL with `?seed=42`. Read **Plan & approval**, approve the exact proposal, then Run or Step. Full controls and offline instructions are in README and `docs/demo_script.md`.


## Conference-room redesign and mode separation

The site now starts in an animated ordinary city with working independent pause/speed controls. Disaster planning is initialized only after pressing the dedicated entry button. Selecting Panchayat Square shows an entry action rather than silently starting the simulation. Leaving disaster mode pauses its clock and restores normal city colors and fog; re-entry retains the simulation history and approved proposal.

The dedicated chamber includes ten Indian-attired procedural human representatives, tabletop name cards, orbit/overhead cameras, speaker highlighting, coordinated forearm gestures, head movement and animated mouths during actual-message replay. Figures remain stylized 3D illustrations; there is no generated voice audio. Group conversation preserves real message order and delivery failures, while collapse of broadcast copies reduces repetition. Collective result and City impact show the same committed decision.

Your decision replaces the default technical dashboard with a guided situation/forecast/approval flow. It explains cautious power estimates, hospital service, synthetic service loss and failed guardrails. Original schedule, metrics, toggles, disruptions and raw evidence remain under an optional Advanced controls section. A walnut/green chamber, rounded seating, inset windows, acoustic wall panels, plants, clearer typography and responsive panels replace the earlier cramped interface.

Validation: 42 Vitest tests across 11 files passed, including conversation fidelity and guided-evidence tests. Typecheck, production build and import boundaries pass. Chrome tests cover normal-city startup without a disaster plan, normal controls, explicit entry, overhead/agent selection, guided approval, actual chat, result charts, city impact, exit/re-entry, mobile layout, plus the complete 144-tick scenario. See `experiments/results/council-room-smoke.json`, `browser-smoke.json`, and `council-room.png`, `council-decision.png`, `council-chat.png`, `council-city-impact.png`, `council-mobile.png`. Offline build refreshed. The existing large-chunk advisory remains.
