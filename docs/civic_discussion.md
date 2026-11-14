# City safety deliberation

The council now opens with a deterministic, authored 19-turn discussion rather than abbreviated electricity messages. It is available before the first simulation tick and refreshes against the current tick as decisions advance.

The agenda covers electricity trade-offs, water distribution, coastal safety, and coordinated responsibilities. All ten existing representatives participate. Hospital challenges Transit, Traffic offers protected access, Water revises its distribution proposal after household/shelter/hospital concerns, and Shelter challenges evacuation plans that lack a verified receiving destination. Replies link back to their parent message. Topic filters let visitors read water or safety discussions immediately.

Six labelled sentiments—Proposal, Concern, Disagreement, Support, Urgent, Context—use separate accent colours and light card backgrounds. The seated speaker bubble and representative detail also show topic/sentiment. Replay allows 7–32 seconds per turn based on text length, adjusted by the existing discussion-speed control.

## Data and boundaries

`src/ui/civicDiscussion.ts` reads contract types and creates a presentation-layer scenario briefing. Actual power supply, requested/allocated PU, effective service and backup reserve values come from the tick; before a tick, baseline requests come from the configuration and are identified as planning values. Disabled or down seats are marked as unavailable/prepared briefings. A fallback is never described as a new agreement.

Water percentages are proposed shares of available treated water, sum to 100%, and are explicitly not measured litres or executed pipe/valve operations. The existing engine continues to model electricity and dependent service availability; this change does not add a hydraulic simulator, live patient counts, shelter occupancy, evacuation routing or completed rescue events.

The **Protocol log** mode retains actual electricity message order, attempts, delivery counts and losses through the existing `conversation()` function. Scenario dialogue never becomes a fabricated protocol Message and does not alter engine allocations or approval state.

The red/amber/readiness notice is labelled as a scenario proposal. Red requires severe current supply loss (below half of initial supply), and in the cyclone scenario also requires the configured landfall phase. Restored supply lowers the alert to amber while services remain strained. The notice appears in group conversation and City impact. It is not an external public warning or a real weather feed.

## Sound controls

The fixed control is now an icon-only pill. The 210px popover contains overall volume; individual music, city ambience and interface sliders and sound credits are collapsed under Fine-tune. Existing mute behavior, settings persistence, spatial audio and keyboard access remain intact.

## Checks

`tests/civic-discussion.test.ts` checks complete agenda coverage, deterministic output, valid reply chains, live value substitution, provisional water actions, alert escalation/recovery, unavailable seats, fallback wording, protocol preservation and reading time. The council browser smoke script covers both discussion modes, water/safety filters, reply navigation, and compact mobile controls. The audio browser smoke script checks the retained mixer functionality with Fine-tune expanded.
