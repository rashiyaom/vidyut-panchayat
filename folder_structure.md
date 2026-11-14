crisis-grid/                          (rename to your project name)
│
├── README.md                         # 1-page: what it is, how to run, team roles
├── Makefile                          # make sim | make batch | make sync | make web | make demo
├── .gitignore                        # node_modules, __pycache__, .venv, big videos
│
├── contract/                      ★  # THE shared source of truth
│   ├── CONTRACT.md                   # plain-English field explanations + changelog
│   ├── scene.schema.json             # city layout format
│   ├── scenario.schema.json          # supply timeline + disaster events format
│   ├── tick.schema.json              # one simulation tick (what the frontend plays)
│   ├── metrics.schema.json           # summary numbers per run
│   └── examples/
│       ├── scene.example.json
│       └── replay.example.json       # tiny hand-written log so you can start in hour 1
│
├── data/                             # config, not code: change behavior without editing code
│   ├── scenes/
│   │   └── city_v1.json           ★  # grid, facility positions, power edges, dependencies
│   ├── scenarios/
│   │   ├── cyclone_24h.json       ★  # the main demo scenario
│   │   ├── substation_failure.json
│   │   └── agent_crash.json          # shows decentralization surviving a failure
│   └── agents/
│       └── profiles.json             # per-agent priority, reserves, demand curve, damage weight
│
├── engine/                           # Python: simulation + agents + baselines
│   ├── requirements.txt              # numpy, scipy, jsonschema, pytest (fastapi only if live mode)
│   ├── crisisgrid/
│   │   ├── cli.py                    # python -m crisisgrid run --scenario ... --strategy ... --seed 1
│   │   ├── config.py                 # loads data/ files
│   │   ├── sim/
│   │   │   ├── world.py              # global state: supply, facilities, graph
│   │   │   ├── clock.py              # tick loop, simulated hours
│   │   │   ├── events.py             # injects scenario events (collapse, restoration, surge)
│   │   │   ├── dependency_graph.py   # who depends on whom
│   │   │   └── damage.py             # cascade + total-damage model
│   │   ├── agents/
│   │   │   ├── base_agent.py         # private state, own utility function
│   │   │   ├── utility_agent.py      # bid / counter / concede logic
│   │   │   └── strategies.py         # concession strategies (swap-able)
│   │   ├── protocol/
│   │   │   ├── messages.py           # Bid, Counter, Accept, Prepare, Commit, Abort
│   │   │   ├── bus.py                # message bus with injectable delay / drops / crashes
│   │   │   ├── negotiation.py        # multi-round bidding loop (must terminate)
│   │   │   └── two_phase_commit.py   # no allocation applies until all confirm
│   │   ├── policy/
│   │   │   ├── fairness.py           # weighted alpha-fairness + Jain's index
│   │   │   └── priority.py
│   │   ├── baselines/
│   │   │   ├── static_priority.py
│   │   │   ├── equal_split.py
│   │   │   └── centralized_lp.py     # theoretical best (scipy linprog)
│   │   ├── metrics/
│   │   │   ├── invariants.py         # asserts capacity limit + consistency EVERY tick
│   │   │   └── scoring.py            # damage, fairness, violations, % of optimum
│   │   └── replay/
│   │       ├── recorder.py           # writes tick logs matching the contract
│   │       └── validate.py           # validates logs against the schema before export
│   ├── tests/
│   │   ├── test_invariants.py        # capacity never exceeded
│   │   ├── test_determinism.py       # same seed gives same log
│   │   ├── test_protocol.py          # terminates, survives dropped messages
│   │   └── test_baselines.py
│   └── live_server.py                # (stretch) FastAPI + WebSocket for live streaming
│
├── experiments/                      # reproducible results for your slides
│   ├── run_batch.py                  # N seeds × scenarios × strategies
│   ├── make_report.py                # builds the results table + charts
│   └── results/                      # CSVs and PNGs (commit the final ones)
│
├── replays/                       ★  # engine output = frontend input
│   └── cyclone_24h__negotiation__seed1.json    # naming: scenario__strategy__seedN
│
├── web/                              # Vite + TypeScript + three.js (your domain)
│   ├── package.json, vite.config.ts, tsconfig.json, index.html
│   ├── public/
│   │   ├── models/                   # Kenney .glb files, custom landmarks
│   │   ├── replays/                  # copied from /replays by `make sync`
│   │   ├── scenes/                   # copied from /data/scenes
│   │   └── textures/
│   └── src/
│       ├── main.ts
│       ├── state/                    # app store: selected scenario, current tick, mode
│       ├── contract/
│       │   ├── types.ts              # TypeScript types matching the schemas
│       │   └── loader.ts             # fetch + validate scene and replay JSON
│       ├── playback/              ★  # the heart of the frontend
│       │   ├── player.ts             # one clock: play / pause / speed / scrub
│       │   └── interpolate.ts        # smooth values between ticks
│       ├── world/
│       │   ├── createWorld.ts        # builds the whole 3D city from scene.json
│       │   ├── camera.ts · lights.ts · postfx.ts
│       │   ├── city/
│       │   │   ├── roads.ts · parks.ts
│       │   │   ├── fillers.ts        # seeded procedural houses/shops (InstancedMesh)
│       │   │   └── facilities.ts     # hospital, pump, tower, etc. + glow markers
│       │   ├── power/
│       │   │   ├── lines.ts          # thickness = allocated power
│       │   │   └── particles.ts      # flowing energy particles
│       │   ├── negotiation/
│       │   │   ├── bidArcs.ts        # arcs between buildings during bids
│       │   │   └── speechBubbles.ts
│       │   ├── effects/
│       │   │   ├── stateColors.ts    # green / amber / red / black
│       │   │   ├── flicker.ts
│       │   │   └── cascade.ts        # failure ripple
│       │   └── assets.ts             # model loader + manifest
│       ├── compare/
│       │   └── splitScreen.ts     ★  # two worlds, ONE shared clock (baseline vs negotiation)
│       ├── ui/
│       │   ├── MetricsPanel.ts       # damage, fairness, violations: 0, rounds
│       │   ├── Timeline.ts           # scrubber with event markers
│       │   ├── EventLog.ts
│       │   ├── ScenarioPicker.ts · DisasterButton.ts · Legend.ts
│       │   └── presenterMode.ts      # hide debug, big fonts, one-key camera presets
│       └── styles/
│
├── demo/
│   ├── offline_bundle/               # production build + replays, runs with no internet
│   └── fallback_demo.mp4             # screen-recorded backup (gitignore if large)
│
├── docs/                             # answers to judges' hard questions
│   ├── architecture.md               # one diagram of the whole system
│   ├── protocol.md                   #




Design decisions

1. contract/ is the only thing you must agree on early. If the tick format is stable, the engine and the frontend can be built completely independently. Changing it later is expensive, so change it only by telling everyone, and log it in CONTRACT.md.

2. data/ is config, not code. The scene (city layout) is one JSON file read by both sides: the engine uses it as the dependency graph, and your frontend uses it to build the 3D city. That’s your single source of truth, so the visuals and the simulation can’t drift apart. New disaster scenarios are just new JSON files.

3. replays/ is a handoff folder. The engine writes finished logs there, and you only read them. The naming scenario__strategy__seedN lets split-screen auto-pair the baseline and negotiation runs: same scenario, same seed, different strategy.

4. The frontend works without a backend. The demo is a static site playing pre-computed logs, so there’s no server to crash on stage. Live streaming (live_server.py) is a stretch feature, not a dependency.

5. experiments/ is separate from engine/. Engine code simulates one run. Experiments code runs 30 to 50 seeded batches and produces the results table. Keeping them apart means the headline numbers on your slides are reproducible with one command.

6. docs/ is for the Q&A. protocol.md and qa_cheatsheet.md are where you prepare for “what if two agents bid at the same time?” and “what if the network drops?”

Ownership, to avoid merge conflicts
Person	Owns	Touches only by agreement
You	web/, demo/, presentation/	contract/
Engine teammate	engine/sim, agents, protocol, data/agents	contract/
Metrics teammate	engine/baselines, metrics, policy, experiments/, docs/damage_model.md	contract/
Everyone	data/scenes and data/scenarios (agree first)	
Commands to set up in the Makefile
make sim      # engine: run the main scenario for all strategies → replays/
make sync     # copy replays + scenes into web/public/
make batch    # experiments: full seeded batch + results table
make web      # start the dev server
make demo     # build the offline bundle