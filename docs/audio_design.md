# Sounds of Nagar

Audio starts after the first pointer or keyboard interaction because browsers require a user gesture. The speaker icon mutes everything; its adjacent chevron opens a compact overall-volume control. Music, ambience and interface levels are tucked under Fine-tune. Preferences persist locally. Headphones provide the clearest spatial effect.

## Coverage

- City overview: original slow pad and bell composition; distant city sound recedes with zoom.
- Streets: vehicle engines and rolling noise track the actual car and bus instance positions. Occasional restrained dual-tone horns come from nearby vehicles. Pedestrian footsteps follow the animated people.
- Metro: each three-car train has one moving emitter with rumble, rail rhythm and occasional horn.
- Beach: locally bundled ocean recording, human chatter along the boardwalk and cafes, pedestrian footsteps, and a soft observation-wheel motor.
- Every city block: residential/commercial/shelter chatter, garden birds and foliage, fountains where present. Selecting a block briefly brings its sound forward, even before zooming in.
- Utilities: substation electrical hum, water flow, telecom equipment, hospital room tone and monitor, emergency operations, traffic, fuel machinery and transit-station atmosphere. These are illustrative environmental cues, not operational alarms.
- Panchayat: crossfade to a more urgent minor-key pulse and layered, stereo human murmur. Returning to City impact restores spatial city sound; leaving restores normal exploration.
- Cyclone: wind and rain follow the existing disaster state. Transit sound fades when service halts. Pausing city activity fades moving-source sound while preserving the environment and music.
- Interface: delegated pointer/keyboard button clicks, block selection, distinct approval/rejection cues. Rapid input is rate limited.

## Implementation

`src/audio/CityAudio.ts` owns one lazily created Web Audio context, HRTF panners, distance filtering, smooth gain ramps, a compressor, source lifecycle and the mixer. The listener follows the camera's focus with a zoom-dependent height and camera orientation. This deliberately makes an elevated city camera behave like approaching a neighborhood, rather than leaving all street sources inaudible hundreds of units below it.

The mixer updates at 10 Hz independently of the render loop, including while the council pauses city rendering. It ranks nearby sources, targets 18 active emitters, caps retained voices at 32, and lets outgoing sources fade before stopping. Fade tails can briefly exceed the retained voice count. Three-dimensional pan and gain changes are smoothed; recordings and procedural loops blend across their seams. Hidden tabs fade and suspend, returning tabs resume, and hot reload closes the audio context and removes listeners.

`src/audio/soundDesign.ts` contains the original procedural music and foley, facility mappings, settings validation and spatial falloff. Music and foley are synthesized rather than field recordings. Human murmur is an indistinct restaurant recording, not Hindi dialogue or a voiced reading of council messages. Ocean and crowd samples are decoded once and reused at varied offsets. Crowd loads after audio activation; surf loads as the beach becomes audible. Both ship under `public/audio/` and work from the built site without external requests. Failed recordings leave procedural ambience available.

Credits, source links, licenses and modifications are documented in the mixer's **Sound credits** page (`public/audio/credits.html`). The source recordings are “Restaurant ambience” by stephan (public domain) and “Oceanwavescrushing” by Luftrum (CC BY 3.0).

## Validation

- `npm test`: includes actual-scene facility coverage, falloff, settings recovery, and finite, non-silent, unclipped procedural samples.
- `npm run build` and `npm run check:boundaries`.
- With the development server on port 4173: `npx tsx scripts/audio-smoke.ts`. Checks gesture activation, decoded local samples, proximity gain, activity pause, council/impact transitions, accessible mixer controls, mute persistence and mobile layout. Captures screenshots and a report in `experiments/results/audio-*`.

Automated checks verify playback state and audio routing, not subjective listening quality or individual device/headphone reproduction. Spatial sound is an artistic mix, with no geometric wall occlusion or measured acoustic simulation.

## Audibility repair and dedicated train horn

The initial ambience-only building selection was too quiet at overview zoom. Building taps now play normalized, three-second inspection cues outside the ambient voice budget, with short attack/release envelopes and music ducking. Rapid selections fade old cues and invalidate pending selection loads. Nearby trains reserve their ambient voices and use a separately scheduled CC0 locomotive horn; horns wait while a building inspection cue is active. A cue-only meter distinguishes these sounds from background music in browser tests. See `docs/night_and_audio.md` for implementation and validation details.
