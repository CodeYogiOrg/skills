/**
 * Renders cuelume's synthesized UI sounds to WAV files in public/sfx/,
 * so Remotion can mount them as <Audio> (Remotion cannot capture live
 * Web Audio synthesis during render).
 *
 * Faithfully reimplements cuelume's audio graph offline: tone layers
 * (sine/triangle, exponential envelopes, glide, detune), noise layers
 * (white noise through an RBJ biquad), and the shimmer feedback delay.
 *
 * Usage: node scripts/gen-sfx.mjs
 */
import { RECIPES } from "../node_modules/cuelume/dist/sounds/recipes.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 44100;
const SOURCE_STOP_PADDING = 0.05;
const INAUDIBLE_GAIN = 0.001;

/**
 * Custom recipes in cuelume's own schema — smoother, action-matched sounds
 * (cuelume's built-ins are dry UI clicks; these are rounder and softer).
 */
const CUSTOM = {
  /** Soft bubble pop — an icon/logo appearing. Rounded, no click. */
  pop: {
    masterGain: 0.5,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 380, glideTo: 850, glideTime: 0.055, attack: 0.012, decay: 0.14, peak: 0.09 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 1600, filterQ: 1.1, attack: 0.004, decay: 0.045, peak: 0.03 },
    ],
    shimmer: { delay: 0.08, feedback: 0.18, wet: 0.1, lowpass: 2800 },
  },
  /** Airy whoosh — a device frame / card / panel gliding in. */
  whoosh: {
    masterGain: 0.5,
    layers: [
      { kind: "noise", filterType: "lowpass", filterFrequency: 900, filterQ: 0.6, attack: 0.1, decay: 0.22, peak: 0.07 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 1900, filterQ: 0.8, offset: 0.05, attack: 0.09, decay: 0.2, peak: 0.05 },
      { kind: "tone", waveform: "sine", frequency: 240, glideTo: 420, glideTime: 0.25, attack: 0.09, decay: 0.24, peak: 0.02 },
    ],
  },
  /** Warm musical boops — one object at a time, ascending do-mi-sol-do. */
  boop1: boop(523.25),
  boop2: boop(659.25),
  boop3: boop(783.99),
  boop4: boop(1046.5),
  /** Gentle riser — leads into a grid/collage reveal. */
  riser: {
    masterGain: 0.45,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 320, glideTo: 1100, glideTime: 0.38, attack: 0.16, decay: 0.28, peak: 0.05 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 2600, filterQ: 0.9, offset: 0.1, attack: 0.2, decay: 0.24, peak: 0.035 },
    ],
    shimmer: { delay: 0.1, feedback: 0.25, wet: 0.14, lowpass: 3600 },
  },
};

function boop(freq) {
  return {
    masterGain: 0.5,
    layers: [
      { kind: "tone", waveform: "triangle", frequency: freq * 1.04, glideTo: freq, glideTime: 0.06, attack: 0.015, decay: 0.26, peak: 0.08 },
      { kind: "tone", waveform: "sine", frequency: freq / 2, attack: 0.015, decay: 0.3, peak: 0.04 },
    ],
    shimmer: { delay: 0.09, feedback: 0.2, wet: 0.12, lowpass: 3000 },
  };
}

// Sounds actually rendered (cuelume built-ins + custom).
const WANTED = [
  "chime",
  "tick",
  "page",
  "ready",
  "press",
  "droplet",
  "sparkle",
  "bloom",
  "pop",
  "whoosh",
  "boop1",
  "boop2",
  "boop3",
  "boop4",
  "riser",
];

const expRamp = (from, to, t, dur) =>
  from * Math.pow(to / from, Math.min(Math.max(t / dur, 0), 1));

/** Envelope identical to cuelume's: 0.0001 -> peak over attack, -> 0.0001 over decay. */
function envelope(t, { attack, decay, peak }) {
  if (t < 0) return 0;
  if (t < attack) return expRamp(0.0001, peak, t, attack);
  if (t < attack + decay) return expRamp(peak, 0.0001, t - attack, decay);
  return 0;
}

function renderTone(out, layer) {
  const start = (layer.offset ?? 0) * SAMPLE_RATE;
  const dur = layer.attack + layer.decay + SOURCE_STOP_PADDING;
  const n = Math.floor(dur * SAMPLE_RATE);
  const detuneRatio = layer.detune ? Math.pow(2, layer.detune / 1200) : 1;
  const f0 = layer.frequency * detuneRatio;
  const f1 = (layer.glideTo ?? layer.frequency) * detuneRatio;
  const glideTime = layer.glideTime ?? layer.attack + layer.decay;

  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const f =
      layer.glideTo !== undefined
        ? expRamp(f0, f1, t, glideTime)
        : f0;
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    const wave =
      layer.waveform === "triangle"
        ? (2 / Math.PI) * Math.asin(Math.sin(phase))
        : Math.sin(phase);
    const idx = Math.floor(start) + i;
    if (idx < out.length) out[idx] += wave * envelope(t, layer);
  }
}

/** RBJ cookbook biquad. WebAudio quirk: lowpass/highpass Q is in dB. */
function biquadCoeffs(type, freq, q) {
  const w0 = (2 * Math.PI * freq) / SAMPLE_RATE;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  let Q = q;
  if (type === "lowpass" || type === "highpass") Q = Math.pow(10, q / 20);
  const alpha = sin / (2 * Q);
  let b0, b1, b2, a0, a1, a2;
  if (type === "lowpass") {
    b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2;
  } else if (type === "highpass") {
    b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2;
  } else {
    // bandpass, constant 0 dB peak gain
    b0 = alpha; b1 = 0; b2 = -alpha;
  }
  a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

function makeBiquad(type, freq, q) {
  const [b0, b1, b2, a1, a2] = biquadCoeffs(type, freq, q);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

function renderNoise(out, layer) {
  const start = (layer.offset ?? 0) * SAMPLE_RATE;
  const dur = layer.attack + layer.decay + SOURCE_STOP_PADDING;
  const n = Math.floor(dur * SAMPLE_RATE);
  const filter = makeBiquad(
    layer.filterType,
    layer.filterFrequency,
    layer.filterQ ?? 1,
  );
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const noise = filter(2 * Math.random() - 1);
    const idx = Math.floor(start) + i;
    if (idx < out.length) out[idx] += noise * envelope(t, layer);
  }
}

const sourceEnd = (recipe) =>
  Math.max(
    ...recipe.layers.map(
      (l) => (l.offset ?? 0) + l.attack + l.decay + SOURCE_STOP_PADDING,
    ),
  );

function shimmerTail(shimmer) {
  if (!shimmer || shimmer.feedback <= 0) return 0;
  if (shimmer.feedback >= 1) return shimmer.delay;
  return (
    shimmer.delay *
    (1 + Math.ceil(Math.log(INAUDIBLE_GAIN) / Math.log(shimmer.feedback)))
  );
}

/** Shimmer: feedback delay with a lowpass in the loop, mixed in at `wet`. */
function applyShimmer(dry, shimmer) {
  const out = new Float64Array(dry.length);
  const delaySamples = Math.max(1, Math.round(shimmer.delay * SAMPLE_RATE));
  const delayLine = new Float64Array(delaySamples);
  const lp = makeBiquad("lowpass", shimmer.lowpass, 1);
  let w = 0;
  for (let i = 0; i < dry.length; i++) {
    const delayed = delayLine[w];
    const filtered = lp(delayed);
    delayLine[w] = dry[i] + filtered * shimmer.feedback;
    w = (w + 1) % delaySamples;
    out[i] = dry[i] + filtered * shimmer.wet;
  }
  return out;
}

function renderRecipe(recipe) {
  const total = sourceEnd(recipe) + shimmerTail(recipe.shimmer) + 0.05;
  let buf = new Float64Array(Math.ceil(total * SAMPLE_RATE));
  for (const layer of recipe.layers) {
    if (layer.kind === "tone") renderTone(buf, layer);
    else renderNoise(buf, layer);
  }
  if (recipe.shimmer) buf = applyShimmer(buf, recipe.shimmer);
  for (let i = 0; i < buf.length; i++) buf[i] *= recipe.masterGain;
  // cuelume tunes for subtle UI feedback (~-30 dBFS peaks) — too quiet
  // next to voiceover. Normalize peaks to -12 dBFS; final level is set
  // per-mount via the <Sfx volume> prop.
  const peak = buf.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
  if (peak > 0) {
    const target = 0.25;
    for (let i = 0; i < buf.length; i++) buf[i] *= target / peak;
  }
  return buf;
}

function toWav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

const outDir = join(process.cwd(), "public", "sfx");
mkdirSync(outDir, { recursive: true });
for (const name of WANTED) {
  const recipe = RECIPES[name] ?? CUSTOM[name];
  if (!recipe) {
    console.error(`unknown recipe: ${name}`);
    continue;
  }
  const samples = renderRecipe(recipe);
  writeFileSync(join(outDir, `${name}.wav`), toWav(samples));
  console.log(`sfx/${name}.wav  (${(samples.length / SAMPLE_RATE).toFixed(2)}s)`);
}
