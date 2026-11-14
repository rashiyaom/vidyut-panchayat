# Damage, Cascading Dependencies and Synthetic Impact Model

This document specifies the mathematical formulations governing energy reserve dynamics, cascading service dependencies, harm aggregation, within-tier fairness, and synthetic population exposure used by the Vidyut Panchayat simulation engine.

---

## 1. Simulation Time and Energy Reserves

The engine discretizes time into uniform intervals:
- **Tick duration**: $\Delta t = \frac{1}{6}\text{ hour} = 10\text{ minutes}$.
- **Scenario Horizon**: 144 ticks = 24 hours.

For each agent $i$ with requested power demand $d_i$ and committed grid allocation $a_i$:

1. **Grid Service Fraction**:
   $$f_{\text{grid}, i} = \min\left(1, \frac{a_i}{d_i}\right)$$

2. **Backup Generator Fraction**:
   $$f_{\text{backup}, i} = \min\left(1 - f_{\text{grid}, i}, \, c_i, \, \frac{R_i}{\Delta t}\right)$$
   where $c_i$ is the agent's maximum backup coverage ratio ($c_i \le 0.5$ for commercial; $c_i \le 1.0$ for critical utilities), and $R_i$ is the remaining fuel/battery reserve in hours.

3. **Reserve Depletion & Recharge**:
   - When backup is active ($f_{\text{backup}, i} > 0$), reserve decreases linearly:
     $$R_i(t + 1) = \max\left(0, R_i(t) - f_{\text{backup}, i} \cdot \Delta t\right)$$
   - When grid coverage is adequate ($f_{\text{grid}, i} \ge 0.95$), reserves recharge at $0.25 \times \Delta t$ hours per tick up to initial capacity $R_{\max, i}$.
   - **Fuel Dependency**: Diesel backup recharge additionally requires prior-tick Fuel utility service $s_{\text{fuel}}(t-1) \ge 0.5$. Active flood conditions halt fuel refilling immediately.

4. **Own Physical Service**:
   $$s_{\text{own}, i} = \min\left(1, f_{\text{grid}, i} + f_{\text{backup}, i}\right)$$
   *(Note: Physical flood damage forces Fuel utility own service directly to 0).*

---

## 2. Upstream Cascading Dependencies

To prevent instantaneous or order-dependent cascade loops, all cross-utility dependencies are evaluated strictly using **prior-tick service states** $s_j(t-1)$ (initialized to 1.0 at $t=0$):

$$s_{\text{effective}, i} = s_{\text{own}, i} \times \prod_{j \in \text{dep}(i)} \left(1 - w_{ij} \cdot \left(1 - s_j(t - 1)\right)\right)$$

where:
- $\text{dep}(i)$ is the set of upstream services agent $i$ depends upon (e.g., Hospital depends on Water and Telecom; Water depends on Telecom and Fuel; Telecom depends on Substation).
- $w_{ij} \in [0, 1]$ represents the coupling weight or vulnerability factor.
- Lagged evaluation guarantees that cyclical dependencies (such as Fuel $\leftrightarrow$ Traffic coordination) remain mathematically well-defined and deterministic.

---

## 3. Harm, Damage and Health Metrics

### 3.1 Harm and Priority-Weighted Damage
For an agent with priority weight $W_i$:
$$\text{Harm}_i(t) = W_i \cdot \left(1 - s_{\text{effective}, i}(t)\right)^{1.5} \cdot \Delta t$$

**Cumulative Damage** is the sum of harm across all agents over the evaluation window:
$$\text{Damage} = \sum_{t} \sum_{i} \text{Harm}_i(t)$$

### 3.2 Service Status Classifications
- **Normal**: $s_{\text{effective}} \ge 0.90$
- **Rationed**: $0.50 \le s_{\text{effective}} < 0.90$
- **Critical**: $0.01 \le s_{\text{effective}} < 0.50$
- **Down**: $s_{\text{effective}} < 0.01$

### 3.3 Critical Uptime & Hospital Minimum
- **Tier-1 Critical Uptime**: The percentage of Tier-1 agent-ticks maintaining $s_{\text{effective}} \ge 0.90$.
- **Hospital Minimum Service**: $\min_{t} s_{\text{hospital}}(t)$, tracking worst-case vulnerability.

---

## 4. Within-Tier Fairness Index

Within each priority tier $k \in \{1, 2, 3\}$, fairness is measured using Jain's Index over effective service levels $s_i$:

$$J_k = \begin{cases} 0, & \text{if } \sum_{i \in T_k} s_i = 0 \\ \frac{\left(\sum_{i \in T_k} s_i\right)^2}{|T_k| \cdot \sum_{i \in T_k} s_i^2}, & \text{otherwise} \end{cases}$$

*(A completely unserved tier scores 0.0; equal sharing of blackout is not scored as positive fairness).*

Headline fairness is the demand-weighted harmonic mean across all three tiers:
$$\text{Fairness} = \frac{\sum_{k} D_k \cdot J_k}{\sum_{k} D_k}$$

---

## 5. Synthetic Population Exposure (PHL Model)

Synthetic Person-Hours of essential-service Loss (PHL) quantifies civilian impact:
$$\text{PHL} = \sum_{t} \sum_{i} \left(\text{Exposure}_i \cdot \left(1 - s_{\text{effective}, i}(t)\right) \cdot \Delta t\right)$$

### Synthetic Exposure by Utility
| Utility Agent | Priority Tier | Synthetic Exposure | Real-World Context |
| :--- | :---: | :---: | :--- |
| **Hospital** | Tier 1 | 3,000 | Inpatients, acute trauma, ICU life-support |
| **Emergency Services** | Tier 1 | 10,000 | Ambulance dispatch, fire rescue, civil response |
| **Water Supply** | Tier 1 | 150,000 | Pumping stations, drinking water reservoirs |
| **Telecommunications** | Tier 1 | 150,000 | Cell towers, emergency radio, civic alerts |
| **Emergency Shelter** | Tier 2 | 12,000 | Evacuated citizens, displaced families |
| **Traffic Signaling** | Tier 2 | 30,000 | Evacuation route controls, major intersections |
| **Fuel Distribution** | Tier 2 | 10,000 | Emergency diesel pumps, transport replenishment |
| **Residential Grid** | Tier 3 | 150,000 | Domestic lighting, household refrigeration |
| **Commercial Zone** | Tier 3 | 20,000 | Retail centers, markets, cold storage |
| **Public Transit** | Tier 3 | 25,000 | Metro rail line, urban electric bus network |

> [!IMPORTANT]
> **Modelling Boundaries**:
> 1. Synthetic exposures represent overlapping service populations, not unique individuals. PHL is a comparative optimization index, **not a casualty estimate or mortality prediction**.
> 2. Disabling an agent from participation models an unmanaged physical draw that takes priority over negotiated lines, testing protocol robustness.
