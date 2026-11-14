# Shared data contract

This file is the change log and plain-language reference for the TypeScript and JSON contracts shared by the engine, worker bridge, and frontend. Keep definitions in `src/contract/` and validate data at system boundaries.

## Contract versions

The implemented simulation, negotiation, planning and worker contracts are version 1 in `src/contract/`.

The city exploration phase introduces a visual layout in `data/scenes/city_v1.json`, validated by `src/world3d/sceneSchema.ts`. It defines a deterministic district grid and stable facility IDs with placement, rotation, scale and display metadata. This visual layout is separate from the versioned electrical graph, supply timeline, agent profiles and simulation metrics described below.

## Change log

- Scaffold: reserve this document as the shared contract change log.
- City exploration: add the visual scene layout and validated facility transforms. See `docs/city_customization.md` for coordinate conventions and the live editing API.

- City visual refinement: optional `blockStyles` and `blockTransforms` configure reusable neighborhood geometry independently of utilities. No simulation contract changes.

## Simulation contract v1 (implementation)

Electrical layout is separate in `data/network/electrical_v1.json`; visual geometry is unchanged. Agent IDs equal facility IDs: commercial, emergency, fuel, hospital, residential, shelter, telecom, traffic, transit, water. Substation is the root, east/central/west are electrical buses, and Panchayat Square is not an agent. JSON is validated on load. Power/demand/capacity/allocation use abstract PU; reserves use hours at full demand; service and fairness are [0,1]; one tick is 1/6 hour. Allocations round DOWN to 0.01 PU. Profiles and scenario are version 1; engine version 1.1.0.

Worker envelopes use requestId, branch and monotone sequence. All commands/replies are schema validated. Ticks contain actual messages, delivery status, proposal hash, fallback and blocked counts, line flows, service, reserves and cumulative metrics. Plans bind approval to ID and hash; presim distributions carry seeds and baseline evidence. All exposure numbers are synthetic per-service counts (overlap allowed).

Decisions resolving initial specification ambiguities: the central feeder is repaired at 14h with restoration; live demo event times are exact (jitter is enabled in futures); commercial backup covers at most 50% demand; fuel stockpile is not electrical backup. I5 applies to negotiated/plan commits; deterministic emergency fallback and named baselines are explicit exceptions, still checked against I1–I4/I6. Reserve backup is capped by available energy within the tick, avoiding a free final tick of service. No team merge/review or submission is claimed by local implementation.

### Boundary and lifecycle details

`Config` contains validated profiles/network/scenario, seed, strategy and participating IDs. `Tick` identifies strategy/seed/scenario and carries ordered agents, 13 lines, actual trace, cumulative metrics and safety report. `AgentTick` separates own/backup/effective service and software DOWN from physical status. Private engine snapshots include a reserve-threshold latch so an already-low reserve does not repeatedly alarm. `Metrics.weightedService` is cumulative ΣW×grid PU; `adherence` is the fraction of ticks committed from a plan. All-zero tier fairness is zero.

`PlanBlock` carries its pessimistic supply, bus/feeder caps, bounded demand, inclusive tick range and quantized allocations. Validation checks these envelopes against the source world as well as allocation legality. Plan IDs combine start, revision and content checksum; approving stale ID/hash/start is rejected. Rejection notes participate in identity. Pre-sim seeds start at 1000, skip the live seed, and apply demand noise, ±15% supply error, 0–5% directed message loss and ±3 tick timing jitter. All four future strategies start from the same observed private state; these are conditional forecasts, not whole-day restarts. The `fan` field carries tick-indexed cumulative PHL quantiles for the time-series band; horizon tables show all metric quantiles and min/max.

Each worker reply includes increasing sequence, requestId and branch. Commands are serialized with timer steps; timer generations invalidate obsolete callbacks. SEEK returns recorded ticks. Mutations from the cursor copy a prefix to a new branch; old histories are retained in memory, not persisted to disk. A plan is required before new council execution; already-recorded ticks replay without a new approval. Physics-safe fallback/contingency is preauthorized within approved execution. AUTO escalates on failed guardrails or FAIL verification. The bridge rejects malformed replies visibly.

Additional documented specification corrections: fuel↔traffic makes the initial dependency graph cyclic (prior-tick evaluation remains defined); Central has three Tier-1 agents plus Tier-2 Traffic, not four Tier-1 agents; fixed-weight static priority and the stated linear tree optimum coincide. None requires changing authored city geometry.

### Engine 1.1 hardening

Negotiation messages add optional `phase: bus | root | plan`; rounds are numbered 1–8 within each price-search phase. Every shown counter uses the exact feasible bound from that actor's local search, and planned counters show the approved schedule instead of unrelated clearing allocations. Scheduled proposals still require current bid views; missing bids cannot silently agree by copying the plan. Every participant's proposal is physically validated, and I3 additionally rejects non-cent PU allocations. Malformed commands preserve their request ID in ERROR replies. Worker faults terminate the bridge and reject pending/future operations on the current branch. Comparison revisions discard obsolete results after strategy/intervention changes and recover after rejected sync operations.

Facility instance colors now multiply their authored colors by `0.25 + 0.75 × effective service`. Geometry, transforms and shared draw batches are preserved; full service restores the exact authored color. Street trees and untagged city geometry stay independent. Both comparison viewports apply their own tick's service colors.

### Conference-room presentation

No engine or data contract changes. The room consumes the same committed Tick and negotiation Message records through the existing bridge/store. Conversation entries group copies of the same sender/type/attempt/phase/round/payload in first-seen order and preserve delivered/lost counts. They omit heartbeat noise. ACCEPT is explicitly local agreement; COMMIT is council agreement. Replay cursor and discussion speed are presentation-only state, separate from the engine clock. Agent detail labels distinguish the revealed statement from the completed tick's applied allocations. Human gestures are illustrative and do not claim additional agent decisions or emotional reactions.

### Separate city and disaster modes

The initial website is normal-city exploration: ambient transport runs, and the worker is not initialized with a disaster run until an explicit entry button is pressed. Selecting Panchayat Square offers that button; it does not start a scenario by itself. Disaster simulation, message replay, and ambient transport have separate playback state/speeds. Exiting the council pauses the simulation and restores authored facility colors/normal fog; the approved plan/history remain available on re-entry. City impact is an in-disaster viewport of the same city renderer. Your decision translates existing plan/evidence fields; it does not change guardrails, allocations or approval identity checks. Speaking animations are illustrative mouth, head and forearm motions, active during message replay, without synthetic audio.
