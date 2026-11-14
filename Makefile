.PHONY: sim sync batch web demo

sim:
	cd engine && .venv/bin/python -m crisisgrid.cli run --scenario ../data/scenarios/cyclone_24h.json --strategy all --seed 1

sync:
	mkdir -p web/public/replays web/public/scenes
	cp -R replays/. web/public/replays/
	cp -R data/scenes/. web/public/scenes/

batch:
	.venv/bin/python experiments/run_batch.py

web:
	cd web && npm run dev

demo:
	cd web && npm run build
	mkdir -p demo/offline_bundle
	cp -R web/dist/. demo/offline_bundle/

