import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ??
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--enable-unsafe-swiftshader", "--no-sandbox"],
  });

  const page = await browser.newPage({
    viewport: { width: 2400, height: 1380 },
    deviceScaleFactor: 1.5,
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vidyut Panchayat Agent Architecture</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 2400px;
      height: 1380px;
      background: #090e17;
      color: #e2e8f0;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      position: relative;
      overflow: hidden;
      padding: 44px 56px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* Ambient background glowing accents */
    .bg-grid {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px);
      background-size: 60px 60px;
      pointer-events: none;
    }
    .glow-cyan {
      position: absolute;
      top: -150px;
      left: 15%;
      width: 700px;
      height: 500px;
      background: radial-gradient(circle, rgba(6, 182, 212, 0.16) 0%, transparent 70%);
      pointer-events: none;
    }
    .glow-emerald {
      position: absolute;
      bottom: -150px;
      right: 15%;
      width: 750px;
      height: 550px;
      background: radial-gradient(circle, rgba(16, 185, 129, 0.14) 0%, transparent 70%);
      pointer-events: none;
    }

    /* Header */
    header {
      position: relative;
      z-index: 10;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .header-left {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #38bdf8;
      font-weight: 600;
    }
    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
    }
    h1 {
      font-size: 44px;
      font-weight: 800;
      letter-spacing: -1px;
      background: linear-gradient(135deg, #ffffff 40%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .header-tagline {
      font-size: 17px;
      color: #94a3b8;
      font-weight: 400;
    }
    .header-badges {
      display: flex;
      gap: 12px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 100px;
      font-size: 13px;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
    }
    .badge-accent {
      background: rgba(16, 185, 129, 0.12);
      border-color: rgba(16, 185, 129, 0.35);
      color: #34d399;
    }
    .badge-cyan {
      background: rgba(6, 182, 212, 0.12);
      border-color: rgba(6, 182, 212, 0.35);
      color: #38bdf8;
    }

    /* Main Grid Layout */
    .grid-container {
      position: relative;
      z-index: 10;
      display: grid;
      grid-template-columns: 1fr 1.15fr 1.4fr 1.05fr;
      gap: 22px;
      height: 1040px;
      margin-top: 26px;
      margin-bottom: 22px;
    }

    /* Cards */
    .card {
      background: rgba(15, 23, 42, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      backdrop-filter: blur(16px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .card-title-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .card-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 700;
    }
    .icon-emerald { background: rgba(16, 185, 129, 0.18); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .icon-cyan { background: rgba(6, 182, 212, 0.18); color: #38bdf8; border: 1px solid rgba(6, 182, 212, 0.3); }
    .icon-purple { background: rgba(168, 85, 247, 0.18); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
    .icon-amber { background: rgba(245, 158, 11, 0.18); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }

    .card-title {
      font-size: 18px;
      font-weight: 700;
      color: #f8fafc;
    }
    .card-sub {
      font-size: 12px;
      color: #94a3b8;
      font-family: 'JetBrains Mono', monospace;
    }

    /* Subsections inside cards */
    .module-box {
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 14px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .module-heading {
      font-size: 13px;
      font-weight: 700;
      color: #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .mono-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.06);
      color: #94a3b8;
    }

    /* Agent pills */
    .agent-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow: hidden;
    }
    .agent-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 10px;
      font-size: 12.5px;
    }
    .agent-item-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .agent-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
    }
    .tier-1 { background: #ef4444; }
    .tier-2 { background: #f59e0b; }
    .tier-3 { background: #3b82f6; }

    .agent-name {
      font-weight: 600;
      color: #f1f5f9;
    }
    .agent-specs {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #94a3b8;
    }

    /* Flow diagram & visual blocks */
    .flow-step {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: rgba(15, 23, 42, 0.8);
      border-left: 3px solid #38bdf8;
      border-radius: 0 10px 10px 0;
      font-size: 12.5px;
    }
    .flow-step strong { color: #f8fafc; font-weight: 600; }
    .flow-step p { color: #94a3b8; font-size: 11.5px; }

    /* Invariants */
    .invariant-pill {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      background: rgba(16, 185, 129, 0.05);
      border: 1px solid rgba(16, 185, 129, 0.2);
      font-size: 12px;
    }
    .invariant-code {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      color: #34d399;
      flex-shrink: 0;
    }

    /* Electrical bus representation */
    .bus-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .bus-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      padding: 10px;
      text-align: center;
    }
    .bus-name { font-size: 11.5px; font-weight: 700; color: #f1f5f9; }
    .bus-cap { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #38bdf8; margin-top: 2px; }

    /* Footer */
    footer {
      position: relative;
      z-index: 10;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 18px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 13.5px;
      color: #94a3b8;
    }
    .footer-left { display: flex; align-items: center; gap: 24px; }
    .footer-highlight { color: #34d399; font-weight: 600; }
    .footer-right { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="bg-grid"></div>
  <div class="glow-cyan"></div>
  <div class="glow-emerald"></div>

  <!-- Header -->
  <header>
    <div class="header-left">
      <div class="eyebrow"><span class="live-dot"></span> Autonomous Multi-Agent Architecture · PS 1.1</div>
      <h1>Vidyut Panchayat (विद्युत् पंचायत)</h1>
      <div class="header-tagline">Decentralized Crisis Power Negotiation, Invariant Governance & Living 3D Digital Twin</div>
    </div>
    <div class="header-badges">
      <div class="badge badge-accent">🛡️ 0 Safety Violations</div>
      <div class="badge badge-cyan">⚡ Zero Central Allocator</div>
      <div class="badge">🤝 2-Phase Hash Consensus</div>
      <div class="badge">🌐 Pure TypeScript Web Worker</div>
    </div>
  </header>

  <!-- 4-Column Architectural Canvas -->
  <div class="grid-container">

    <!-- Column 1: Citizen & Human Governance -->
    <div class="card">
      <div class="card-header">
        <div class="card-title-group">
          <div class="card-icon icon-purple">01</div>
          <div>
            <div class="card-title">Citizen Governance</div>
            <div class="card-sub">HUMAN-IN-THE-LOOP LAYER</div>
          </div>
        </div>
      </div>

      <div class="module-box">
        <div class="module-heading">Plan Approval & Review <span class="mono-pill">18-TICK HORIZON</span></div>
        <div class="flow-step">
          <div>
            <strong>Plain-Language Forecasts</strong>
            <p>Consequences translated from electrical PU into human service exposure and essential outages.</p>
          </div>
        </div>
        <div class="flow-step" style="border-left-color: #a855f7;">
          <div>
            <strong>Rejection with Guidance</strong>
            <p>Operator returns notes (e.g. 'Protect hospital water window'); agents formulate revised offers.</p>
          </div>
        </div>
      </div>

      <div class="module-box">
        <div class="module-heading">Monte Carlo Pre-Simulation <span class="mono-pill">SEEDED NOISE</span></div>
        <p style="font-size: 12px; color: #94a3b8; line-height: 1.5;">
          Executes 10 seeded futures across demand jitter, timing drift, and bid drop rates. Generates <b>P10–P90 risk bounds</b> before approval.
        </p>
      </div>

      <div class="module-box">
        <div class="module-heading">Dynamic Interventions <span class="mono-pill">LIVE CHAOS</span></div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div class="mono-pill" style="padding: 8px; text-align: center; color: #f43f5e;">⚡ Supply Drop</div>
          <div class="mono-pill" style="padding: 8px; text-align: center; color: #fbbf24;">🔌 Feeder Trip</div>
          <div class="mono-pill" style="padding: 8px; text-align: center; color: #38bdf8;">📡 Node Crash</div>
          <div class="mono-pill" style="padding: 8px; text-align: center; color: #a855f7;">🎲 Bid Drop</div>
        </div>
      </div>

      <div class="module-box" style="margin-top: auto; background: rgba(168, 85, 247, 0.06); border-color: rgba(168, 85, 247, 0.2);">
        <div class="module-heading" style="color: #c084fc;">Citizen Principle</div>
        <p style="font-size: 11.5px; color: #cbd5e1; line-height: 1.4;">
          The Citizen may veto or approve a multi-agent plan, but <b>cannot arbitrarily author allocations</b>. Decentralized autonomy is preserved.
        </p>
      </div>
    </div>

    <!-- Column 2: Constitution Invariants Layer -->
    <div class="card">
      <div class="card-header">
        <div class="card-title-group">
          <div class="card-icon icon-emerald">02</div>
          <div>
            <div class="card-title">The Constitution</div>
            <div class="card-sub">STATELESS INVARIANT ENFORCER</div>
          </div>
        </div>
      </div>

      <div class="module-box">
        <div class="module-heading">Hard Invariants (I1–I4) <span class="mono-pill">PURE CHECK</span></div>
        
        <div class="invariant-pill">
          <span class="invariant-code">I1</span>
          <div>
            <strong style="color: #f1f5f9;">Grid Capacity Bounds</strong>
            <p style="color: #94a3b8; font-size: 11px; margin-top: 2px;">Total allocated ≤ Available Supply. Feeder and bus limits strictly bounded. Zero tolerance.</p>
          </div>
        </div>

        <div class="invariant-pill">
          <span class="invariant-code">I2</span>
          <div>
            <strong style="color: #f1f5f9;">Atomic 2-Phase Commit</strong>
            <p style="color: #94a3b8; font-size: 11px; margin-top: 2px;">Every node cryptographically hashes proposed state. Hash mismatch triggers immediate safe fallback.</p>
          </div>
        </div>

        <div class="invariant-pill">
          <span class="invariant-code">I3</span>
          <div>
            <strong style="color: #f1f5f9;">Quantized Non-Negative</strong>
            <p style="color: #94a3b8; font-size: 11px; margin-top: 2px;">Allocations are strictly ≥ 0, bounded by demand, and snapped to exact 0.01 PU increments.</p>
          </div>
        </div>

        <div class="invariant-pill">
          <span class="invariant-code">I4</span>
          <div>
            <strong style="color: #f1f5f9;">Verification Guardrails</strong>
            <p style="color: #94a3b8; font-size: 11px; margin-top: 2px;">Post-execution verification tags state as PASS, DRIFT, or FAIL, with transparent metric escalation.</p>
          </div>
        </div>
      </div>

      <div class="module-box">
        <div class="module-heading">Locational Price Clearing <span class="mono-pill">CONGESTION</span></div>
        <p style="font-size: 11.5px; color: #94a3b8; line-height: 1.5;">
          Stateless shadow prices rise on constrained district buses, signalling upstream flexible loads to concede before critical services are cut.
        </p>
      </div>

      <div class="module-box" style="margin-top: auto; background: rgba(16, 185, 129, 0.06); border-color: rgba(16, 185, 129, 0.2);">
        <div class="module-heading" style="color: #34d399;">Safety Guarantee</div>
        <p style="font-size: 11.5px; color: #cbd5e1; line-height: 1.4;">
          The Constitution <b>never drafts an allocation</b>; it solely rejects invalid states. Every utility executes identical mathematical clearing.
        </p>
      </div>
    </div>

    <!-- Column 3: The 10 Utility Agents & Protocol -->
    <div class="card">
      <div class="card-header">
        <div class="card-title-group">
          <div class="card-icon icon-cyan">03</div>
          <div>
            <div class="card-title">The 10 Utility Agents</div>
            <div class="card-sub">DECENTRALIZED PANCHAYAT</div>
          </div>
        </div>
      </div>

      <div class="module-box">
        <div class="module-heading">Tiered Utility Representation <span class="mono-pill">180 PU DEMAND</span></div>
        <div class="agent-list">
          <div class="agent-item">
            <div class="agent-item-left"><span class="agent-dot tier-1"></span><span class="agent-name">Hospital AI</span></div>
            <div class="agent-specs">Tier 1 · W: 1.00 · Diesel 4h</div>
          </div>
          <div class="agent-item">
            <div class="agent-item-left"><span class="agent-dot tier-1"></span><span class="agent-name">Emergency Services AI</span></div>
            <div class="agent-specs">Tier 1 · W: 0.90 · Batt 2h</div>
          </div>
          <div class="agent-item">
            <div class="agent-item-left"><span class="agent-dot tier-1"></span><span class="agent-name">Water Pumping AI</span></div>
            <div class="agent-specs">Tier 1 · W: 0.85 · No Backup</div>
          </div>
          <div class="agent-item">
            <div class="agent-item-left"><span class="agent-dot tier-1"></span><span class="agent-name">Telecom AI</span></div>
            <div class="agent-specs">Tier 1 · W: 0.80 · Batt 1h</div>
          </div>
          <div class="agent-item">
            <div class="agent-item-left"><span class="agent-dot tier-2"></span><span class="agent-name">Relief Shelter AI</span></div>
            <div class="agent-specs">Tier 2 · W: 0.60 · Surge Load</div>
          </div>
          <div class="agent-item">
            <div class="agent-item-left"><span class="agent-dot tier-2"></span><span class="agent-name">Fuel Logistics AI</span></div>
            <div class="agent-specs">Tier 2 · W: 0.60 · Stockpile</div>
          </div>
          <div class="agent-item">
            <div class="agent-item-left"><span class="agent-dot tier-2"></span><span class="agent-name">Traffic Control AI</span></div>
            <div class="agent-specs">Tier 2 · W: 0.50 · Batt 0.5h</div>
          </div>
          <div class="agent-item">
            <div class="agent-item-left"><span class="agent-dot tier-3"></span><span class="agent-name">Residential Power AI</span></div>
            <div class="agent-specs">Tier 3 · W: 0.50 · Flexible 0.9</div>
          </div>
          <div class="agent-item">
            <div class="agent-item-left"><span class="agent-dot tier-3"></span><span class="agent-name">Commercial / Industrial AI</span></div>
            <div class="agent-specs">Tier 3 · W: 0.20 · Shed First</div>
          </div>
          <div class="agent-item">
            <div class="agent-item-left"><span class="agent-dot tier-3"></span><span class="agent-name">Public Transit AI</span></div>
            <div class="agent-specs">Tier 3 · W: 0.40 · Evacuation</div>
          </div>
        </div>
      </div>

      <div class="module-box">
        <div class="module-heading">Negotiation Flow <span class="mono-pill">MESSAGE BUS</span></div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 4px; font-family: 'JetBrains Mono', monospace; font-size: 11px;">
          <span style="color: #38bdf8;">BID</span> ➔ 
          <span style="color: #fbbf24;">COUNTER</span> ➔ 
          <span style="color: #f43f5e;">CONCEDE</span> ➔ 
          <span style="color: #a855f7;">PREPARE</span> ➔ 
          <span style="color: #34d399;">COMMIT</span>
        </div>
      </div>

      <div class="module-box" style="margin-top: auto; background: rgba(6, 182, 212, 0.06); border-color: rgba(6, 182, 212, 0.2);">
        <div class="module-heading" style="color: #38bdf8;">Fault Resilience</div>
        <p style="font-size: 11.5px; color: #cbd5e1; line-height: 1.4;">
          Private states (true reserves & stress) remain concealed. On node failure, remaining agents apply <b>hold-last-committed</b> without system stall.
        </p>
      </div>
    </div>

    <!-- Column 4: Physical Grid & 3D Digital Twin -->
    <div class="card">
      <div class="card-header">
        <div class="card-title-group">
          <div class="card-icon icon-amber">04</div>
          <div>
            <div class="card-title">3D Digital Twin</div>
            <div class="card-sub">PHYSICAL RUNTIME & WORLD</div>
          </div>
        </div>
      </div>

      <div class="module-box">
        <div class="module-heading">Power Grid Infrastructure <span class="mono-pill">2-LEVEL TREE</span></div>
        <div style="text-align: center; padding: 6px; font-size: 12px; font-weight: 700; color: #34d399; background: rgba(16, 185, 129, 0.1); border-radius: 6px;">
          SUBSTATION (200 PU SUPPLY)
        </div>
        <div class="bus-grid" style="margin-top: 4px;">
          <div class="bus-box">
            <div class="bus-name">Bus East</div>
            <div class="bus-cap">Cap: 90 PU</div>
          </div>
          <div class="bus-box">
            <div class="bus-name">Bus Central</div>
            <div class="bus-cap">Cap: 80 PU</div>
          </div>
          <div class="bus-box">
            <div class="bus-name">Bus West</div>
            <div class="bus-cap">Cap: 100 PU</div>
          </div>
        </div>
      </div>

      <div class="module-box">
        <div class="module-heading">Inter-Service Dependencies <span class="mono-pill">CASCADES</span></div>
        <div style="font-size: 11.5px; color: #94a3b8; line-height: 1.6;">
          • <b>Water Outage</b> ➔ Degrades Hospital (-40%) & Shelter<br>
          • <b>Telecom Drop</b> ➔ Paralyzes Emergency Dispatch (-50%)<br>
          • <b>Traffic Jam</b> ➔ Slows Fire/Ambulance & Fuel Logistics<br>
          • <b>Fuel Loss</b> ➔ Halts Generator Refills after 4h
        </div>
      </div>

      <div class="module-box">
        <div class="module-heading">3D Visualization & Audio <span class="mono-pill">THREE.JS</span></div>
        <div style="font-size: 11.5px; color: #94a3b8; line-height: 1.5;">
          • Real-time elevated power flow lines with load colors<br>
          • Dynamic time-of-day: Daylight, Golden Hour, Cozy Night<br>
          • Preseeded Cyclone landfall with wind-driven rain<br>
          • Spatial Web Audio synthesis & Courtroom Chamber
        </div>
      </div>

      <div class="module-box" style="margin-top: auto; background: rgba(245, 158, 11, 0.06); border-color: rgba(245, 158, 11, 0.2);">
        <div class="module-heading" style="color: #fbbf24;">Benchmark Baselines</div>
        <p style="font-size: 11.5px; color: #cbd5e1; line-height: 1.4;">
          Compared live against <b>Static Priority</b>, <b>Equal Split</b>, and <b>Centralized Optimum</b> across 24h/144-tick disaster scenarios.
        </p>
      </div>
    </div>

  </div>

  <!-- Footer -->
  <footer>
    <div class="footer-left">
      <span>Framework: <strong style="color: #f8fafc;">Vidyut Panchayat v1.0</strong></span>
      <span>Safety Invariants: <span class="footer-highlight">0 Violations</span> (Verified on 200 Seeds)</span>
      <span>Architecture: <strong style="color: #f8fafc;">Decentralized Autonomous Multi-Agent System</strong></span>
    </div>
    <div class="footer-right">
      Build Beyond'26 · Problem Statement 1.1 · Om Rashiya & Krish Ardeshana
    </div>
  </footer>
</body>
</html>`;

  await page.setContent(html);
  await page.waitForTimeout(1000);

  const outDir = path.resolve("docs/assets");
  const outFile = path.join(outDir, "agent-architecture-overview.png");
  await page.screenshot({ path: outFile });
  console.log("Architecture diagram saved to:", outFile);

  // Also save a copy in presentation/
  const presDir = path.resolve("presentation");
  await fs.mkdir(presDir, { recursive: true });
  await page.screenshot({ path: path.join(presDir, "architecture_diagram.png") });
  console.log("Architecture diagram saved to presentation/architecture_diagram.png");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
