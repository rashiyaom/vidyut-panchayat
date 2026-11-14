# Demonstration, Jury Walkthrough & Technical Q&A Runbook

This guide contains everything required to present, verify, and understand the technical and operational nuances of the Vidyut Panchayat system.

---

## 1. Quick Verification & Jury Audit

Run the automated end-to-end verification suite:

```bash
# Install dependencies
npm ci
python3 -m venv ml/.venv
ml/.venv/bin/python -m pip install -r ml/requirements-inference.txt

# Run complete jury verification gate
npm run jury:verify
```

### What `npm run jury:verify` Proves
- Validates processed dataset checksums and trained model weights.
- Re-runs out-of-sample inference for electricity demand and ERA5 weather forecasting.
- Confirms the frozen 30-day policy revision audit against strict fairness and capacity gates.
- Executes TypeScript unit tests, engine boundary checks, and production browser smoke tests.
- Writes the signed audit manifest to `experiments/ml/jury_evidence_manifest.json`.

---

## 2. Five-Minute Technical Walkthrough

1. **The System Architecture**:
   - Start the local preview: `npm run preview` (serves at [http://127.0.0.1:4174/](http://127.0.0.1:4174/)).
   - Open the **Living 3D City**: Walk through Nagar, demonstrate day/night/golden lighting transitions, and toggle sunny vs. cyclone rainfall weather.
2. **The Council Chamber**:
   - Enter **Panchayat Square** (`Enter disaster council` or `?council=1`).
   - Observe the 10 utility agents deliberating around the circular council table.
   - Inspect individual seats (Hospital, Telecom, Water) to see requested vs. allocated power, battery reserve levels, and upstream dependencies.
3. **The Two-Phase Commit Protocol**:
   - Advance the simulation (`Next decision →`).
   - View the live message feed: `BID` $\rightarrow$ `COUNTER` $\rightarrow$ `CONCEDE` $\rightarrow$ `PREPARE` $\rightarrow$ `COMMIT`.
   - Explain how the stateless Constitution enforces invariants I1–I4 (Supply limit, Feeder capacity, Demand bounds, Unanimous hash match).
4. **Machine Learning & Historical Replay**:
   - Navigate to `?historical=1` or click **Explore the real system**.
   - Show how held-out UCI customer meter data and ERA5 weather forecasts feed the multi-agent negotiation engine.
   - Review the frozen 30-day revision audit results (meeting the $\ge 0.970$ fairness threshold at $0.9804$).
5. **Interactive Failure Injection**:
   - Click **Drop bids** to inject communication loss: observe unanimous hash mismatch, automatic abort, and deterministic safe fallback.
   - Toggle **Residential agent** off: observe unmanaged load behavior taking physical priority over negotiated allocations.

---

## 3. Step-by-Step Scenario Timeline (Cyclone 24h)

| Simulated Time | Tick | Scenario Event | Expected System Behavior |
| :--- | :---: | :--- | :--- |
| **00:00** | 0 | Normal baseline (200 PU) | All utilities receive 100% service. Full mobility. |
| **02:00** | 12 | Grid collapse (200 $\rightarrow$ 70 PU) | Triage activates. Tier-1 utilities draw on reserves. Within-tier fairness preserved. |
| **06:00** | 36 | Partial restoration (70 $\rightarrow$ 110 PU) | Grid stabilizes; battery reserves begin recharging. |
| **08:00** | 48 | Hospital surge & evacuation | Hospital demand increases +40%; Shelter demand +133%. Council re-allocates. |
| **09:00** | 54 | Feeder failure (Central Bus cap 30 PU) | Triage on Central District. Line flows dynamically rerouted. |
| **18:00** | 108 | Telecom crash | Heartbeat missed $\times 2$; agent flagged DOWN. Emergency services hold physical draw. |
| **18:30** | 111 | Telecom rejoins | Telecom re-establishes protocol communication with fresh bids. Normal council resumes. |

---

## 4. Technical Architecture Q&A

### Q: Who actually decides allocations?
**A**: Each live utility agent independently computes a candidate allocation from its own view of received bids using its private utility function and reserve status. The coordinator only routes messages. The Constitution only checks legality; it never generates allocations.

### Q: What happens when network messages are lost?
**A**: Because agents clear allocations from received bids, a lost bid causes hash mismatch during `PREPARE`. A single retry is permitted. If consensus still fails, the engine falls back deterministically to the previous allocation scaled down to fit current physical capacity.

### Q: Is negotiation guaranteed to beat static priority on every metric?
**A**: No. In linear settings, static priority achieves lower service loss because it concentrates energy ruthlessly on Tier 1. However, the multi-agent council achieves vastly superior **within-tier fairness** (0.98 vs 0.92) and prevents complete starvation of Tier-2 and Tier-3 services.

### Q: Does "Zero Violations" mean no harm occurred?
**A**: No. Zero violations means that no physical grid or feeder capacity limits were exceeded, and all Constitutional invariants held. Service loss and civilian harm can still occur under severe supply shortages.

### Q: Can this run completely offline?
**A**: Yes. The production build (`npm run demo`) bundles all Three.js geometries, audio buffers, ML replay data, and Web Worker simulation code with zero external network or CDN calls.
