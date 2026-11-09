/**
 * Sound, synthesised rather than downloaded.
 *
 * The game had no audio at all — `public/` holds only icons. Shipping real .ogg
 * files would add megabytes and licences for a project that runs from a static
 * folder, so every cue here is built from oscillators and noise at runtime:
 * a signal drone for hordes, a noise burst with a falling filter for gunshots,
 * filtered noise for rain, square blips for UI.
 *
 * Three rules keep it bearable: nothing loops louder than a background bed, every
 * cue is short, and the whole thing is off until the player turns it on.
 */
type Cue = 'raid' | 'gunshot' | 'rain' | 'alert' | 'build' | 'death';

const KEY = 'holdout:sound';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let rainNode: { stop: () => void } | null = null;
let enabled = (() => {
  try {
    return globalThis.localStorage?.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();

export const soundEnabled = () => enabled;

const ensure = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
};

/** White noise buffer, reused by every noise-based cue. */
const noise = (c: AudioContext, seconds: number): AudioBuffer => {
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * seconds)), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
};

const env = (c: AudioContext, peak: number, attack: number, decay: number): GainNode => {
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
};

/** A short tone: used for UI blips and the build chime. */
const tone = (c: AudioContext, freq: number, dur: number, type: OscillatorType, peak = 0.25, slideTo?: number) => {
  const osc = c.createOscillator();
  const g = env(c, peak, 0.005, dur);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  osc.connect(g).connect(master!);
  osc.start();
  osc.stop(c.currentTime + dur + 0.05);
};

const burst = (c: AudioContext, dur: number, from: number, to: number, peak: number) => {
  const src = c.createBufferSource();
  src.buffer = noise(c, dur + 0.05);
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(from, c.currentTime);
  filter.frequency.exponentialRampToValueAtTime(Math.max(80, to), c.currentTime + dur);
  const g = env(c, peak, 0.004, dur);
  src.connect(filter).connect(g).connect(master!);
  src.start();
  src.stop(c.currentTime + dur + 0.05);
};

export function play(cue: Cue): void {
  if (!enabled) return;
  const c = ensure();
  if (!c || !master) return;
  switch (cue) {
    case 'gunshot':
      burst(c, 0.25, 2600, 200, 0.5);
      tone(c, 120, 0.14, 'triangle', 0.3, 60);
      break;
    case 'raid':
      // Low rising drone: something is coming.
      tone(c, 70, 1.6, 'sawtooth', 0.16, 130);
      burst(c, 1.2, 400, 120, 0.12);
      break;
    case 'alert':
      tone(c, 660, 0.09, 'square', 0.14);
      setTimeout(() => playTone(c, 880, 0.09), 110);
      break;
    case 'build':
      tone(c, 520, 0.1, 'triangle', 0.16);
      setTimeout(() => playTone(c, 780, 0.14), 90);
      break;
    case 'death':
      tone(c, 220, 0.5, 'sine', 0.18, 110);
      break;
    case 'rain':
      startRain(c);
      break;
  }
}

const playTone = (c: AudioContext, f: number, d: number) => tone(c, f, d, 'square', 0.12);

/** Rain is the only loop: filtered noise, faded in so it never clicks. */
function startRain(c: AudioContext): void {
  if (rainNode) return;
  const src = c.createBufferSource();
  src.buffer = noise(c, 2);
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1400;
  filter.Q.value = 0.6;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.linearRampToValueAtTime(0.06, c.currentTime + 1.5);
  src.connect(filter).connect(g).connect(master!);
  src.start();
  rainNode = {
    stop: () => {
      g.gain.linearRampToValueAtTime(0.0001, c.currentTime + 1.2);
      setTimeout(() => {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      }, 1300);
    },
  };
}

export function stopRain(): void {
  rainNode?.stop();
  rainNode = null;
}

export function toggleSound(): boolean {
  enabled = !enabled;
  try {
    globalThis.localStorage?.setItem(KEY, enabled ? '1' : '0');
  } catch {
    /* private mode */
  }
  if (!enabled) stopRain();
  else play('alert');
  return enabled;
}
