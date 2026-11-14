# Crisis Grid

A replay driven simulation of autonomous city utilities negotiating limited power during a disaster. The Python engine will generate simulation runs; the Vite frontend will visualize and compare those replays.

## Development setup

- Frontend: `cd web && npm run dev`
- Frontend production build: `cd web && npm run build`
- Python dependencies: `engine/requirements.txt` (installed in `engine/.venv`)
- Planned simulation commands: `make sim`, `make batch`, `make sync`, `make web`, `make demo`

The engine, shared contracts, scenarios, and replay format are scaffolded separately so the simulation and visualization can evolve against the same data.
