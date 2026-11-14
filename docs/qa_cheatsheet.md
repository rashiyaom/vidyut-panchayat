# Evidence and implementation Q&A

**Who allocates?** Each live utility independently clears its received BID view. Shared code is not shared authority. The coordinator delivers messages; unanimous hashes and a stateless Constitution gate application. Named baseline algorithms are centralized comparators.

**What if a bid is lost?** Different views can produce different hashes. PREPARE loss also aborts. One retry is allowed; then previous allocations are projected to current physical limits. Only BID/PREPARE delivery is fault-injected; COMMIT application is atomic inside this simulator. Crashed utilities hold clipped last draw, are labelled DOWN after two missed heartbeats, and rejoin with fresh bids.

**Why are static and optimum identical?** The specified static ordering uses the same profile weights as the linear optimum. Greedy is exact on the laminar tree for ΣW×allocated power. A discrete brute-force oracle tests this; it is not an optimum for reserve dynamics, dependency service, PHL or fairness.

**Does negotiation win?** Not universally. Read the measured CSV/summary: council has better fairness than static but worse median PHL in the recorded message-loss experiment. Equal split can have lower damage while its worst hospital service is poor. Safety does not imply good service.

**What does zero violations mean?** Applied supply, line, demand and reserve limits passed. Illegal proposals are counted separately; message aborts are not misreported as physical violations. Capacity checks cannot guarantee minimum service during triage.

**Is this a real distributed grid?** No. Separate actors share one deterministic process, synthetic demands/exposures and an abstract tree. The city is a renderer, not an electrical load-flow solver. Fuel flooding and lagged dependencies can degrade service even with full allocated power.

**Can a human approve a different plan?** Approval includes exact proposal ID and hash, requires pre-sim evidence, and revalidates the live start tick/envelope. Rejecting a note renegotiates; the note is recorded, not interpreted as executable policy. AUTO passes all four guardrails or waits for a human. FAIL verification escalates.

**What was measured?** 200 comparison runs of one scenario and four strategies at 50 seeds; separate 200-seed safety regression; production Chrome smoke test with external requests blocked and post-load offline stepping. No missing scenario, video, slides or submission is represented as complete.
