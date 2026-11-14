# Spatial Audio Engine & 3D Lighting Design

This document details the procedural spatial audio system and the dynamic multi-mode lighting pipeline that bring the 3D digital twin of Nagar to life.

---

## 1. Spatial Web Audio Architecture

Audio execution begins on the first pointer or keyboard gesture, strictly adhering to browser autoplay policies.

### 1.1 Core Components (`src/audio/CityAudio.ts`)
- **Web Audio Context**: Single lazy context running a master dynamics compressor, master gain, and categorized bus nodes (ambience, music, spatial foley, UI cues).
- **Camera-Follow Listener**: The audio listener tracks the 3D camera's focus position with a zoom-dependent virtual height. This allows an elevated overview to maintain neighborhood-level acoustic balance rather than stranding street emitters hundreds of units below.
- **Mixer Update Loop**: Operates at 10 Hz independently of the Three.js rendering frame loop:
  - Dynamically sorts and prioritizes visible audio sources.
  - Targets 18 active emitters; hard caps active voices at 32.
  - Automatically fades retiring voices to eliminate click artifacts.
  - Smooths 3D panner position and gain ramps.

### 1.2 Acoustic Soundscapes
- **City Overview**: Procedural synthesized pads, gentle bell intervals, and distant city murmur.
- **Vehicle Emitters**: Physical engine and road noise tracking animated car, bus, and train positions.
- **Dedicated Metro Locomotive Horn**: A bundled CC0 Prime PM-920 locomotive air horn recording with spatial attenuation, with procedural fallback.
- **Coastal Promenade**: CC0 ocean surf recordings blended with gentle crowd murmur and observation wheel motors.
- **Facility Foley**:
  - Substation: 50 Hz/60 Hz electromagnetic transformer hum.
  - Hospital: Medical telemetry pulses and sterile room tone.
  - Water/Pumping: Hydraulic flow and valve cycling.
  - Telecom: Digital high-frequency transmission hum.
- **Panchayat Chamber**: Transitions to an urgent minor-key pulse layered with council chamber murmur.

---

## 2. Dynamic 3D Lighting & Time-of-Day Cycles

Nagar supports three distinct real-time lighting modes toggled via the interface or API (`window.vidyutCity.setLightingMode(mode)`):

### 2.1 Lighting Modes
1. **Daylight (`day`)**:
   - Directional sun light (`#fff0d2`, intensity 2.6) casting $4096 \times 4096$ PCF soft shadows.
   - Sky hemisphere light (`#dcecf0` / `#b8a885`) with ACESFilmic tone mapping.
   - Sharp, vibrant architectural contrasts.
2. **Cozy Night (`night`)**:
   - Directional moonlight with cool deep shadows and twinkling stars.
   - Instanced light pools providing street, promenade, and park lamp coverage without multiple costly shadow maps.
   - Procedural window pane emission across building facades (warm gold and cool cyan variations).
   - Moving vehicle headlight pools projected onto asphalt surfaces.
   - Dimmed facility emissions when grid power is rationed or lost.
3. **Golden Hour (`golden`)**:
   - Low-angle warm directional lighting with lengthened amber shadows and warm coastal reflections.

---

## 3. Weather Dynamics & Disaster Interactivity

- **One-Click Toggle**: Switch seamlessly between **Sunny Day** and **Raining / Cyclone Disruption**.
- **Visual Feedback**: Real-time particle rain, cloud overcast fog adjustments, and slick asphalt shader responses.
- **Mobility Impact**: Street traffic slows, emergency hazard blinkers activate, and transit lines stop upon power disruption.

---

## 4. Diagnostics & Testing API

The global `window.vidyutCity` object exposes diagnostic telemetry:
- `vidyutCity.getAudio()`: Reports master RMS, cue RMS, active panners, and sound card diagnostics.
- `vidyutCity.getLighting()`: Reports active mode, fade transition status, and light counts.
- `vidyutCity.getWeather()`: Returns `"sunny"` or `"raining"`.
- `vidyutCity.setLightingMode("day" | "golden" | "night")`
- `vidyutCity.setWeather("sunny" | "raining")`
