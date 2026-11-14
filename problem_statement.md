Problem Statement 1.1, explained
The real-world problem

In a disaster like a cyclone, flood or grid failure, a city’s power supply collapses. Say normal supply is 100 units and it drops to 40. Every critical service still wants its full share:

Hospital: ventilators, ICUs, operating theaters
Water pumping: drinking water and firefighting pressure
Emergency services: dispatch centers, control rooms
Telecom: cell towers, which carry 112/108 calls and coordination

Today these services run independently. Each one grabs what it can, or follows a fixed rule set in advance. That causes two failures:

Bad use of scarce power. One service may hoard power it doesn’t urgently need while another starves.
Cascading failures. The services depend on each other. If the water pumps die, the hospital loses cooling and sanitation. If telecom dies, emergency dispatch can’t coordinate. One failure triggers the next.
What you’re asked to build

A system where each utility is its own autonomous agent (a small program with its own goals and private information), and the agents negotiate with each other over how to split the limited power, with no central controller deciding for them.

Here is each phrase of the statement in plain terms:

Phrase	Meaning
Decentralized	No boss program. If one agent crashes, the others keep negotiating. There is no single point of failure.
Autonomous agent per utility	The hospital agent knows its own needs, its backup reserves and how urgent it is. It decides for itself what to ask for and what to give up.
Negotiate in real time	Agents exchange messages while the situation changes, not once at the start.
Bids	“I need 30 units, and here’s how urgent that is.”
Priorities	A hospital ICU outranks a shopping mall, and the system must know that.
Concessions	“I’ll accept 20 now, because my backup generator covers me for 3 hours.” Agents give ground when it helps the whole city.
Fluctuating power supply	Supply isn’t constant. The grid collapses, partially recovers, then fails again, so allocation must be re-negotiated repeatedly.
Hard capacity limits	Total allocated power can never exceed available supply, and no building can be given more than its infrastructure can handle. This is a rule that must not be broken, not a preference.
Avoid inconsistent states	Two agents must never both believe they own the same power. If messages are delayed or an agent crashes mid-negotiation, the system must not end up in a contradictory state.
Balance priority against fairness	Pure priority starves low-ranked services entirely. Pure equal split wastes power on things that aren’t critical. You need a principled middle.
Minimize total damage	The score is a damage number (lives at risk, outage hours, cascade effects) summed across the whole city, not how well any single agent does.
Simulated multi-hour disaster scenario	You test it on a simulated timeline, e.g. 12 to 24 hours, with scripted events.
One round of what this looks like

Supply drops from 100 to 40. Demands are hospital 30, water 25, emergency 15, telecom 20 and shelter 10, which is 100 in total and obviously can’t be met.

Bid: each agent announces its demand and urgency.
Counter and concede: the hospital says it has a diesel generator good for 4 hours, so it can accept less for now. Telecom says its towers have battery backup for 1 hour, so it needs power soon. Water says pumps are at 20% reservoir, which is critical.
Converge: over a few rounds the agents settle on something like hospital 15, water 12, emergency 7, telecom 4, shelter 2 (total 40).
Commit: the allocation only takes effect once all agents confirm, so nobody acts on a half-agreed state.
Re-negotiate: at hour 3 the hospital’s generator runs low, supply changes, or a substation fails, and the cycle repeats.

At the end you measure how much total damage occurred across the whole timeline.

What the problem is not
Not a machine-learning problem. You don’t need to train a neural network. Rule-based and optimization-based agents are completely valid.
Not a realistic power-grid simulator. You don’t need load-flow equations or real electrical engineering. A simplified “units of power” model is fine.
Not an AI chatbot problem. The agents’ negotiation is structured messages (bids, counters, accepts), not natural-language conversation.
What judges will look for

Reading the statement as a rubric, the strongest answers will show:

Real decentralization. Agents genuinely act independently, and the system survives an agent failing.
A clear negotiation protocol. There is a defined sequence of messages that terminates, not just a pile of hardcoded numbers.
Provable safety. Capacity is never exceeded, which you show with a live counter. No inconsistent states, which you can show with the two-phase commit.
A defensible fairness and priority policy. You can explain the trade-off, e.g. with a weighted fairness measure, and show a fairness number.
Evidence of lower damage. A comparison against baselines such as static priority and equal split, ideally with a centralized optimizer as the theoretical best.
A disaster scenario with real dynamics. Supply changes, cascades happen and agents fail.
The core idea in one sentence

Instead of one controller or a fixed rulebook deciding who gets power in a disaster, let each service speak for itself, negotiate with the others, and prove that this produces less total harm, without ever breaking the hard safety limits.

That sentence is also the pitch you’ll open your presentation with.

Does this match how you understood it? If so, I’d suggest we next lock your scenario (which 5 agents, what events happen when), since everything else, including your city layout, follows from it.