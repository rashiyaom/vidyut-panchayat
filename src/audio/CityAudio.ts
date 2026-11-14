import * as THREE from "three";
import { cueNormalization, prioritizeSources, trainGain } from "./audioMix";
import type { DisasterState } from "../world3d/disasterState";
import type { CityEntity } from "../world3d/city";
import { entitySound, makeSound, proximity, readSettings } from "./soundDesign";
import type { MixSettings, Sound, SoundPoint } from "./soundDesign";

type Voice = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  filter: BiquadFilterNode;
  pan: PannerNode;
  lastHeard: number;
  sound: Sound;
};
const storageKey = "nagar-audio-v1";
export class CityAudio {
  settings: MixSettings;
  private context?: AudioContext;
  private master?: GainNode;
  private ambience?: GainNode;
  private music?: GainNode;
  private ui?: GainNode;
  private cityBus?: GainNode;
  private roomBus?: GainNode;
  private calm?: GainNode;
  private debate?: GainNode;
  private voices = new Map<string, Voice>();
  private buffers = new Map<string, AudioBuffer>();
  private loops: AudioBufferSourceNode[] = [];
  private roomVoices: AudioBufferSourceNode[] = [];
  private loads = new Map<string, Promise<void>>();
  private abort = new AbortController();
  private entities: CityEntity[] = [];
  private movers: THREE.InstancedMesh[] = [];
  private half = 112;
  private council = false;
  private moving = true;
  private disposed = false;
  private selected?: { id: string; until: number };
  private nextHorn = 0;
  private trainCooldown = new Map<string, number>();
  private nextTrainHorn = 0;
  private transients = new Map<
    AudioBufferSourceNode,
    {
      gain: GainNode;
      pan: StereoPannerNode | PannerNode;
      kind: string;
      point?: SoundPoint;
    }
  >();
  private selectionSequence = 0;
  private duckUntil = 0;
  private lastCue?: { kind: string; entity?: string; at: number };
  private meter?: AnalyserNode;
  private cueBus?: GainNode;
  private cueMeter?: AnalyserNode;
  private cueMeterData = new Float32Array(256);
  private meterData = new Float32Array(256);
  private response?: DisasterState;
  private loaded = new Set<string>();
  private lastClick = 0;
  private timer: ReturnType<typeof setInterval>;
  private suspension?: ReturnType<typeof setTimeout>;
  private matrix = new THREE.Matrix4();
  private position = new THREE.Vector3();
  private forward = new THREE.Vector3();
  private up = new THREE.Vector3();
  private listenerPosition = new THREE.Vector3();
  private controls: HTMLElement;
  private status = "Ready · sound starts when you explore";
  constructor(
    private camera: THREE.PerspectiveCamera,
    private target: THREE.Vector3,
  ) {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(storageKey);
    } catch {
      /* Private browsing. */
    }
    this.settings = readSettings(saved);
    this.controls = this.mountControls();
    document.addEventListener("pointerdown", this.gesture, { capture: true });
    document.addEventListener("keydown", this.gesture, { capture: true });
    document.addEventListener("click", this.click, { capture: true });
    document.addEventListener("visibilitychange", this.visibility);
    this.timer = setInterval(() => this.update(), 100);
    this.renderControls();
  }
  register(entities: CityEntity[], group: THREE.Group, half: number) {
    this.selectionSequence++;
    this.entities = entities;
    this.half = half;
    this.movers = [];
    group.traverse((o) => {
      if (
        o instanceof THREE.InstancedMesh &&
        ["cars", "buses", "trains", "pedestrians"].includes(o.name)
      )
        this.movers.push(o);
    });
    for (const voice of this.voices.values()) this.stopVoice(voice);
    this.voices.clear();
    this.selected = undefined;
    this.cancelCues();
    this.trainCooldown.clear();
  }
  setCouncil(value: boolean) {
    this.council = value;
    if (value) this.cancelCues();
    this.update();
  }
  setDisaster(value: DisasterState) {
    this.response = value;
  }
  setMoving(value: boolean) {
    this.moving = value;
    if (!value) this.cancelCues("train-horn");
  }
  select(entity?: CityEntity) {
    const sequence = ++this.selectionSequence;
    this.cancelCues("selection");
    this.selected = entity
      ? { id: entity.id, until: performance.now() + 6500 }
      : undefined;
    if (!entity) return;
    void (async () => {
      await this.unlock();
      if (!this.context || this.disposed || this.settings.muted) return;
      const sound = entitySound(entity);
      if (sound === "crowd") await this.loadRecording("crowd");
      if (
        sequence !== this.selectionSequence ||
        !this.context ||
        this.context.state !== "running" ||
        this.settings.muted ||
        this.council ||
        this.disposed
      )
        return;
      // A short inspection cue has its own gain envelope, independent of camera distance and voice culling.
      const buffer = this.buffer(sound),
        projected = entity.position.clone().project(this.camera);
      this.playCue(
        buffer,
        "selection",
        3.2,
        0.85,
        THREE.MathUtils.clamp(projected.x * 0.55, -0.65, 0.65),
      );
      this.lastCue = {
        kind: sound,
        entity: entity.id,
        at: this.context.currentTime,
      };
      this.update();
    })();
  }
  private cancelCues(kind?: string) {
    if (!this.context) return;
    for (const [source, cue] of this.transients) {
      if (kind && cue.kind !== kind) continue;
      this.smooth(cue.gain.gain, 0, 0.03);
      source.stop(this.context.currentTime + 0.18);
    }
  }
  private playCue(
    buffer: AudioBuffer,
    kind: string,
    duration: number,
    level: number,
    stereo: number,
    point?: SoundPoint,
  ) {
    const ctx = this.context!,
      now = ctx.currentTime;
    const source = ctx.createBufferSource(),
      gain = ctx.createGain();
    source.buffer = buffer;
    const pan = point ? ctx.createPanner() : ctx.createStereoPanner();
    if (pan instanceof PannerNode && point) {
      pan.panningModel = "HRTF";
      pan.rolloffFactor = 0;
      pan.positionX.value = point.x;
      pan.positionY.value = point.y;
      pan.positionZ.value = point.z;
    } else if (pan instanceof StereoPannerNode) pan.pan.value = stereo;
    const peak = level * cueNormalization(buffer);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.12);
    gain.gain.setValueAtTime(peak, now + Math.max(0.15, duration - 0.7));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(gain).connect(pan).connect(this.cueBus!);
    source.start(
      0,
      kind === "selection" && buffer.duration > 10 ? 6 : 0,
      duration,
    );
    this.transients.set(source, { gain, pan, kind, point });
    this.duckUntil = now + duration;
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      pan.disconnect();
      this.transients.delete(source);
    };
  }
  private gesture = (event: Event) => {
    if (
      !event.isTrusted ||
      (event instanceof KeyboardEvent &&
        (event.repeat ||
          ["Shift", "Control", "Alt", "Meta"].includes(event.key)))
    )
      return;
    void this.unlock();
  };
  private click = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest(
      "button, summary, a, select, input[type=checkbox]",
    );
    if (!button || button.matches(":disabled") || button.closest("[inert]"))
      return;
    const action = button.getAttribute("data-action");
    this.playClick(
      action === "approve"
        ? "approve"
        : action === "reject"
          ? "reject"
          : "click",
    );
  };
  private visibility = () => {
    if (document.hidden) {
      this.cancelCues();
      this.fadeAndSuspend();
    } else if (!this.settings.muted && this.context) void this.unlock();
  };
  private async unlock() {
    if (this.disposed || this.settings.muted || document.hidden) return;
    clearTimeout(this.suspension);
    try {
      if (!this.context) this.init();
      await this.context!.resume();
      if (this.disposed) return;
      this.status = "Spatial sound on · headphones recommended";
      this.applySettings();
      this.renderControls();
    } catch {
      this.status = "Audio paused · tap Sound to retry";
      this.renderControls();
    }
  }
  private init() {
    const ctx = (this.context = new AudioContext());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 10;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.008;
    limiter.release.value = 0.3;
    this.meter = ctx.createAnalyser();
    this.meter.fftSize = 256;
    this.master.connect(limiter).connect(this.meter).connect(ctx.destination);
    const bus = (parent: AudioNode) => {
      const gain = ctx.createGain();
      gain.connect(parent);
      return gain;
    };
    this.ambience = bus(this.master);
    this.music = bus(this.master);
    this.ui = bus(this.master);
    this.cityBus = bus(this.ambience);
    this.cueBus = ctx.createGain();
    this.cueMeter = ctx.createAnalyser();
    this.cueMeter.fftSize = 256;
    this.cueBus.connect(this.cueMeter).connect(this.cityBus);
    this.roomBus = bus(this.ambience);
    this.roomBus.gain.value = 0;
    this.calm = bus(this.music);
    this.debate = bus(this.music);
    this.debate.gain.value = 0;
    this.loop(this.buffer("music"), this.calm, 0.55);
    this.loop(this.buffer("debate"), this.debate, 0.5);
    this.applySettings();
    void this.loadRecording("crowd");
    void this.loadRecording("train-horn");
  }
  private buffer(sound: Sound | "music" | "debate") {
    if (!this.buffers.has(sound))
      this.buffers.set(sound, makeSound(this.context!, sound));
    return this.buffers.get(sound)!;
  }
  private loop(
    buffer: AudioBuffer,
    destination: AudioNode,
    level: number,
    offset = 0,
    pan = 0,
  ) {
    const ctx = this.context!,
      source = ctx.createBufferSource(),
      gain = ctx.createGain(),
      stereo = ctx.createStereoPanner();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0.08;
    gain.gain.value = level;
    stereo.pan.value = pan;
    source.connect(gain).connect(stereo).connect(destination);
    source.start(0, offset % buffer.duration);
    this.loops.push(source);
    return source;
  }
  private loadRecording(sound: "crowd" | "surf" | "train-horn"): Promise<void> {
    if (this.loads.has(sound)) return this.loads.get(sound)!;
    const request = (async () => {
      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}audio/${sound}.mp3`,
          { signal: this.abort.signal },
        );
        if (!response.ok) throw new Error(String(response.status));
        const buffer = await this.context!.decodeAudioData(
          await response.arrayBuffer(),
        );
        if (this.disposed) return;
        // Overlap the tail into the opening, then loop from after that overlap.
        const overlap =
            sound === "train-horn" ? 0 : Math.min(1.5, buffer.duration / 4),
          n = Math.floor(overlap * buffer.sampleRate);
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
          const data = buffer.getChannelData(channel);
          for (let i = 0; i < n; i++) {
            const w = (1 - Math.cos((i / n) * Math.PI)) / 2;
            data[data.length - n + i] =
              data[data.length - n + i] * (1 - w) + data[i] * w;
          }
        }
        this.buffers.set(sound, buffer);
        this.loaded.add(sound);
        // Existing voices fade out; new voices pick up the recording on the next pass.
        for (const [id, voice] of this.voices)
          if (voice.sound === sound) {
            this.stopVoice(voice);
            this.voices.delete(id);
          }
        if (sound === "crowd") {
          this.roomVoices = [
            this.loop(buffer, this.roomBus!, 0.6, 8, -0.4),
            this.loop(buffer, this.roomBus!, 0.36, 21, 0.45),
          ];
          for (const source of this.roomVoices) source.loopStart = overlap;
        }
      } catch {
        if (!this.disposed) {
          this.status = "Sound on · a recorded ambience could not load";
          this.renderControls();
        }
      }
    })();
    this.loads.set(sound, request);
    return request;
  }
  private smooth(param: AudioParam, value: number, seconds = 0.7) {
    const now = this.context!.currentTime;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(value, now, seconds);
  }
  private applySettings() {
    if (!this.context) return;
    this.smooth(
      this.master!.gain,
      this.settings.muted || document.hidden ? 0 : this.settings.master,
      0.12,
    );
    this.smooth(this.music!.gain, this.settings.music);
    this.smooth(this.ambience!.gain, this.settings.ambience);
    this.smooth(this.ui!.gain, this.settings.ui, 0.1);
  }
  private fadeAndSuspend() {
    if (!this.context) return;
    this.smooth(this.master!.gain, 0, 0.06);
    clearTimeout(this.suspension);
    this.suspension = setTimeout(() => {
      if (this.settings.muted || document.hidden)
        void this.context?.suspend().catch(() => {});
    }, 400);
  }
  setSettings(next: Partial<MixSettings>) {
    this.settings = readSettings(JSON.stringify({ ...this.settings, ...next }));
    try {
      localStorage.setItem(storageKey, JSON.stringify(this.settings));
    } catch {
      /* Optional persistence. */
    }
    this.applySettings();
    if (this.settings.muted) {
      this.cancelCues();
      this.fadeAndSuspend();
    } else void this.unlock();
    this.renderControls();
  }
  private stopVoice(voice: Voice) {
    const now = this.context!.currentTime;
    this.smooth(voice.gain.gain, 0, 0.15);
    voice.source.stop(now + 0.9);
    voice.source.onended = () => {
      voice.source.disconnect();
      voice.filter.disconnect();
      voice.gain.disconnect();
      voice.pan.disconnect();
    };
  }
  private createVoice(point: SoundPoint): Voice {
    const ctx = this.context!,
      source = ctx.createBufferSource(),
      gain = ctx.createGain(),
      filter = ctx.createBiquadFilter(),
      pan = ctx.createPanner();
    source.buffer = this.buffer(point.sound);
    source.loop = true;
    source.loopStart = 0.08;
    if (this.loads.has(point.sound) && source.buffer.duration > 10)
      source.loopStart = 1.5;
    source.playbackRate.value = 0.96 + Math.random() * 0.08;
    filter.type = "lowpass";
    filter.frequency.value = 1800;
    gain.gain.value = 0;
    pan.panningModel = "HRTF";
    pan.distanceModel = "inverse";
    pan.refDistance = 20;
    pan.rolloffFactor = 0; // Explicit, zoom-aware gain below.
    pan.positionX.value = point.x;
    pan.positionY.value = point.y;
    pan.positionZ.value = point.z;
    source.connect(filter).connect(gain).connect(pan).connect(this.cityBus!);
    source.start(0, Math.random() * source.buffer.duration);
    return {
      source,
      gain,
      filter,
      pan,
      lastHeard: ctx.currentTime,
      sound: point.sound,
    };
  }
  private points(): SoundPoint[] {
    const points: SoundPoint[] = this.entities.map((e) => ({
      id: e.id,
      sound: entitySound(e),
      x: e.position.x,
      y: 1.5,
      z: e.position.z,
      level: 0.32,
    }));
    for (const entity of this.entities) {
      if (entity.category !== "Public park") continue;
      const [, row, col] = entity.id.split("-");
      if (entity.id === "block-3-3" || (Number(row) + Number(col)) % 3 !== 0)
        points.push({
          id: `${entity.id}-fountain`,
          sound: "water",
          x: entity.position.x,
          y: 1,
          z: entity.position.z,
          level: 0.24,
        });
    }
    points.push({
      id: "observation-wheel",
      sound: "fuel",
      x: this.half + 68,
      y: 12,
      z: 0,
      level: 0.18,
      moving: true,
    });
    for (const z of [-26, 28])
      points.push({
        id: `beach-cafe-${z}`,
        sound: "crowd",
        x: this.half + 65,
        y: 1,
        z,
        level: 0.3,
      });
    for (const z of [-0.55, 0, 0.55]) {
      points.push({
        id: `surf-${z}`,
        sound: "surf",
        x: this.half + 83,
        y: 0,
        z: this.half * z,
        level: 0.55,
      });
      points.push({
        id: `beach-${z}`,
        sound: "crowd",
        x: this.half + 54,
        y: 1,
        z: this.half * z,
        level: 0.38,
      });
    }
    points.push({
      id: "wind",
      sound: "wind",
      x: this.target.x,
      y: 8,
      z: this.target.z,
      level: 0.12 + (this.response?.rain ?? 0) * 0.6,
    });
    if (this.response?.rain)
      points.push({
        id: "rain",
        sound: "water",
        x: this.target.x,
        y: 6,
        z: this.target.z,
        level: this.response.rain * 0.5,
      });
    for (const mesh of this.movers) {
      const sound: Sound =
        mesh.name === "cars"
          ? "car"
          : mesh.name === "buses"
            ? "bus"
            : mesh.name === "trains"
              ? "train"
              : "steps";
      for (let i = 0; i < mesh.count; i += sound === "train" ? 3 : 1) {
        mesh.getMatrixAt(i, this.matrix);
        this.position.setFromMatrixPosition(this.matrix);
        points.push({
          id: `${mesh.name}-${i}`,
          sound,
          x: this.position.x,
          y: this.position.y,
          z: this.position.z,
          level: sound === "train" ? 0.8 : sound === "steps" ? 0.2 : 0.3,
          moving: true,
        });
      }
    }
    return points;
  }
  private update() {
    const ctx = this.context;
    if (
      !ctx ||
      ctx.state !== "running" ||
      this.disposed ||
      document.hidden ||
      this.settings.muted
    )
      return;
    this.smooth(this.cityBus!.gain, this.council ? 0 : 1, 1.1);
    this.smooth(this.roomBus!.gain, this.council ? 1 : 0, 1.1);
    this.smooth(
      this.calm!.gain,
      this.council ? 0 : ctx.currentTime < this.duckUntil ? 0.3 : 1,
      0.3,
    );
    this.smooth(this.debate!.gain, this.council ? 1 : 0, 1.5);
    const distance = this.camera.position.distanceTo(this.target);
    this.listenerPosition.copy(this.target);
    this.listenerPosition.y = Math.max(6, distance * 0.17);
    this.camera.getWorldDirection(this.forward);
    this.up.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const listener = ctx.listener;
    if (listener.positionX) {
      for (const [param, value] of [
        [listener.positionX, this.listenerPosition.x],
        [listener.positionY, this.listenerPosition.y],
        [listener.positionZ, this.listenerPosition.z],
        [listener.forwardX, this.forward.x],
        [listener.forwardY, this.forward.y],
        [listener.forwardZ, this.forward.z],
        [listener.upX, this.up.x],
        [listener.upY, this.up.y],
        [listener.upZ, this.up.z],
      ] as [AudioParam, number][])
        this.smooth(param, value, 0.08);
    } else {
      listener.setPosition(...this.listenerPosition.toArray());
      listener.setOrientation(...this.forward.toArray(), ...this.up.toArray());
    }
    const zoom = proximity(distance, 450);
    const candidates = this.council
      ? []
      : prioritizeSources(
          this.points().map((point) => {
            const d = this.listenerPosition.distanceTo(
              new THREE.Vector3(point.x, point.y, point.z),
            );
            const emphasis =
              this.selected?.id === point.id &&
              this.selected.until > performance.now();
            const motion =
              point.sound === "train"
                ? (this.response?.trainSpeed ?? 1)
                : point.sound === "bus"
                  ? (this.response?.busSpeed ?? 1)
                  : point.sound === "car"
                    ? (this.response?.carSpeed ?? 1)
                    : 1;
            const gain =
              point.sound === "train"
                ? trainGain(d, distance) * 0.95 * motion * Number(this.moving)
                : motion *
                  point.level *
                  (emphasis ? Math.max(0.45, proximity(d)) : proximity(d)) *
                  (emphasis ? Math.max(0.5, zoom) : zoom) *
                  (point.moving && !this.moving ? 0 : 1);
            return { point, gain };
          }),
          this.selected?.id,
        );
    const active = new Set(candidates.map((c) => c.point.id));
    for (const [id, voice] of this.voices)
      if (!active.has(id)) {
        this.smooth(voice.gain.gain, 0);
        if (ctx.currentTime - voice.lastHeard > 2.5) {
          this.stopVoice(voice);
          this.voices.delete(id);
        }
      }
    for (const { point, gain } of candidates) {
      if (point.sound === "surf") void this.loadRecording("surf");
      let voice = this.voices.get(point.id);
      if (!voice) {
        if (this.voices.size >= 32) {
          const retired = [...this.voices].find(([id]) => !active.has(id));
          if (!retired) continue;
          this.stopVoice(retired[1]);
          this.voices.delete(retired[0]);
        }
        voice = this.createVoice(point);
        this.voices.set(point.id, voice);
      }
      voice.lastHeard = ctx.currentTime;
      this.smooth(voice.gain.gain, gain, 0.65);
      this.smooth(voice.filter.frequency, 1000 + 7000 * zoom, 0.8);
      this.smooth(voice.pan.positionX, point.x, 0.1);
      this.smooth(voice.pan.positionY, point.y, 0.1);
      this.smooth(voice.pan.positionZ, point.z, 0.1);
    }
    for (const cue of this.transients.values()) {
      if (!cue.point || !(cue.pan instanceof PannerNode)) continue;
      const moving = candidates.find(
        (c) => c.point.id === cue.point!.id,
      )?.point;
      if (moving) {
        this.smooth(cue.pan.positionX, moving.x, 0.1);
        this.smooth(cue.pan.positionZ, moving.z, 0.1);
      }
    }
    if (
      !this.council &&
      this.moving &&
      ctx.currentTime >= this.nextTrainHorn &&
      ![...this.transients.values()].some((c) => c.kind === "selection")
    ) {
      const train = candidates.find(
        (c) =>
          c.point.sound === "train" &&
          c.gain > 0.1 &&
          ctx.currentTime >= (this.trainCooldown.get(c.point.id) ?? 0),
      );
      if (train) {
        const recorded = this.buffers.get("train-horn");
        if (recorded)
          this.playCue(
            recorded,
            "train-horn",
            Math.min(3.6, recorded.duration),
            Math.max(0.45, train.gain),
            0,
            train.point,
          );
        else this.horn(train.point, Math.max(0.6, train.gain));
        this.lastCue = {
          kind: "train-horn",
          entity: train.point.id,
          at: ctx.currentTime,
        };
        this.trainCooldown.set(train.point.id, ctx.currentTime + 25);
        this.nextTrainHorn = ctx.currentTime + 12;
      }
    }
    if (!this.council && this.moving && ctx.currentTime > this.nextHorn) {
      const nearby = candidates.filter(
        (c) => ["car", "bus"].includes(c.point.sound) && c.gain > 0.05,
      );
      if (nearby.length) {
        const { point, gain } =
          nearby[Math.floor(Math.random() * nearby.length)];
        this.horn(point, gain);
      }
      this.nextHorn = ctx.currentTime + 7 + Math.random() * 11;
    }
  }
  private horn(point: SoundPoint, level: number) {
    const ctx = this.context!,
      pan = ctx.createPanner(),
      gain = ctx.createGain(),
      now = ctx.currentTime;
    pan.panningModel = "HRTF";
    pan.rolloffFactor = 0;
    pan.positionX.value = point.x;
    pan.positionY.value = point.y;
    pan.positionZ.value = point.z;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level * 0.22, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    gain.connect(pan).connect(this.cityBus!);
    const base =
      point.sound === "bus" ? 196 : point.sound === "train" ? 246.94 : 392;
    [base, base * 1.25].forEach((f, i) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = "triangle";
      oscillator.frequency.value = f;
      oscillator.connect(gain);
      oscillator.start();
      oscillator.stop(now + 0.7);
      oscillator.onended = () => {
        oscillator.disconnect();
        if (i === 1) {
          gain.disconnect();
          pan.disconnect();
        }
      };
    });
  }
  private playClick(kind: "click" | "select" | "approve" | "reject") {
    const ctx = this.context;
    if (
      !ctx ||
      ctx.state !== "running" ||
      this.settings.muted ||
      performance.now() - this.lastClick < 65
    )
      return;
    this.lastClick = performance.now();
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain(),
      now = ctx.currentTime;
    oscillator.frequency.setValueAtTime(
      kind === "approve"
        ? 660
        : kind === "reject"
          ? 240
          : kind === "select"
            ? 520
            : 820,
      now,
    );
    oscillator.frequency.exponentialRampToValueAtTime(
      kind === "approve" ? 880 : kind === "reject" ? 180 : 430,
      now + 0.09,
    );
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    oscillator.connect(gain).connect(this.ui!);
    oscillator.start();
    oscillator.stop(now + 0.15);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  private mountControls() {
    const root = document.createElement("aside");
    root.className = "audio-controls";
    root.setAttribute("aria-label", "Sound controls");
    const speaker =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z"/><path class="audio-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path class="audio-muted-mark" d="m16 9 5 6m0-6-5 6"/></svg>';
    const slider = (
      key: "master" | "music" | "ambience" | "ui",
      label: string,
    ) =>
      `<label for="audio-${key}">${label}<output id="audio-${key}-value"></output></label><input id="audio-${key}" type="range" min="0" max="100" step="1" data-audio-level="${key}">`;
    root.innerHTML = `<button id="audio-toggle" aria-pressed="false" title="Mute sound">${speaker}<span class="sr-only">Sound</span></button><button id="audio-settings" aria-label="Open sound mixer" aria-expanded="false" aria-controls="audio-panel" title="Volume settings"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 10 4-4 4 4"/></svg></button><section id="audio-panel" hidden><div class="audio-heading"><strong>Sound</strong><button id="audio-close" aria-label="Close sound mixer">×</button></div><p id="audio-status" role="status" class="sr-only"></p>${slider("master", "Volume")}<details id="audio-fine-tune"><summary>Fine-tune</summary>${slider("music", "Music")}${slider("ambience", "City ambience")}${slider("ui", "Interface")}<a href="${import.meta.env.BASE_URL}audio/credits.html" target="_blank" rel="noopener">Sound credits ↗</a></details></section>`;
    document.body.append(root);
    root
      .querySelector("#audio-toggle")!
      .addEventListener("click", () =>
        this.setSettings({ muted: !this.settings.muted }),
      );
    const panel = root.querySelector<HTMLElement>("#audio-panel")!,
      button = root.querySelector("#audio-settings")!;
    const show = (open: boolean) => {
      panel.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
    };
    button.addEventListener("click", () => show(Boolean(panel.hidden)));
    root.querySelector("#audio-close")!.addEventListener("click", () => {
      show(false);
      (button as HTMLElement).focus();
    });
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        show(false);
        (button as HTMLElement).focus();
      }
    });
    root.querySelectorAll<HTMLInputElement>("input").forEach((input) =>
      input.addEventListener("input", () =>
        this.setSettings({
          [input.dataset.audioLevel!]: Number(input.value) / 100,
        }),
      ),
    );
    return root;
  }
  private renderControls() {
    const button =
      this.controls.querySelector<HTMLButtonElement>("#audio-toggle")!;
    this.controls.dataset.muted = String(this.settings.muted);
    button.title = this.settings.muted ? "Enable sound" : "Mute sound";
    button.setAttribute("aria-pressed", String(!this.settings.muted));
    button.setAttribute(
      "aria-label",
      this.settings.muted ? "Enable sound" : "Mute sound",
    );
    button.querySelector("span")!.textContent = this.settings.muted
      ? "Muted"
      : "Sound";
    this.controls.querySelector("#audio-status")!.textContent = this.settings
      .muted
      ? "Sound is muted"
      : this.status;
    for (const key of ["master", "music", "ambience", "ui"] as const) {
      this.controls.querySelector<HTMLInputElement>(`#audio-${key}`)!.value =
        String(Math.round(this.settings[key] * 100));
      this.controls.querySelector(`#audio-${key}-value`)!.textContent =
        `${Math.round(this.settings[key] * 100)}%`;
    }
  }
  diagnostics() {
    if (this.meter) this.meter.getFloatTimeDomainData(this.meterData);
    if (this.cueMeter) this.cueMeter.getFloatTimeDomainData(this.cueMeterData);
    return {
      cueRms: Math.sqrt(
        this.cueMeterData.reduce((sum, v) => sum + v * v, 0) /
          this.cueMeterData.length,
      ),
      outputRms: Math.sqrt(
        this.meterData.reduce((sum, v) => sum + v * v, 0) /
          this.meterData.length,
      ),
      lastCue: this.lastCue,
      activeCues: [...this.transients.values()].map((c) => c.kind),
      state: this.context?.state ?? "locked",
      settings: { ...this.settings },
      council: this.council,
      voices: this.voices.size,
      recordings: [...this.loaded],
      sources: [...this.voices.entries()].map(([id, v]) => ({
        id,
        sound: v.sound,
        gain: v.gain.gain.value,
        x: v.pan.positionX.value,
        z: v.pan.positionZ.value,
      })),
    };
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.timer);
    clearTimeout(this.suspension);
    this.abort.abort();
    document.removeEventListener("pointerdown", this.gesture, true);
    document.removeEventListener("keydown", this.gesture, true);
    document.removeEventListener("click", this.click, true);
    document.removeEventListener("visibilitychange", this.visibility);
    this.controls.remove();
    void this.context?.close().catch(() => {});
    this.voices.clear();
    this.buffers.clear();
  }
}
