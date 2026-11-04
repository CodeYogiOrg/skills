/**
 * Synthesizes an UPBEAT background-music bed: ~105 BPM, light four-on-the-floor
 * kick, off-beat hi-hats, plucky bass, bright marimba-style chord arpeggios
 * and a soft pad (C - G - Am - F). Energetic but mixed to sit under the
 * voiceover: peak-normalized to -19 dBFS, fade-in/out baked in.
 *
 * Usage: node scripts/gen-music.mjs [--seconds 73.2] [--out public/audio/music-bed.wav]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 44100;

const args = process.argv.slice(2);
const argVal = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : dflt;
};
const STYLE = argVal("--style", "calm"); // calm | educational | upbeat | playful | inspiring
const BPM =
  STYLE === "playful" ? 122 : STYLE === "educational" ? 96 : STYLE === "inspiring" ? 112 : STYLE === "calm" ? 72 : 105;
const SPB = 60 / BPM; // seconds per beat
const SECONDS = parseFloat(argVal("--seconds", "73.2"));
const OUT = argVal(
  "--out",
  join(process.cwd(), "public", "audio", "music-bed.wav"),
);

const buf = new Float64Array(Math.ceil(SECONDS * SAMPLE_RATE));

const N = {
  C2: 65.41, G2: 98.0, A2: 110.0, F2: 87.31,
  C3: 130.81, E3: 164.81, G3: 196.0, A3: 220.0, B3: 246.94, F3: 174.61, D3: 146.83,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0,
};

// one chord per bar: root (bass), pad triad, arp notes (two octaves, bright)
const UPBEAT_BARS = [
  { bass: N.C2, pad: [N.C3, N.E3, N.G3], arp: [N.C4, N.E4, N.G4, N.C5, N.E5, N.G4] },
  { bass: N.G2, pad: [N.B3 / 2, N.D3, N.G3], arp: [N.G4, N.B4, N.D5, N.G5, N.D5, N.B4] },
  { bass: N.A2, pad: [N.A3 / 2, N.C3, N.E3], arp: [N.A4, N.C5, N.E5, N.A5, N.E5, N.C5] },
  { bass: N.F2, pad: [N.F3, N.A3, N.C4], arp: [N.F4, N.A4, N.C5, N.F5, N.C5, N.A4] },
];
// playful: G - Em - C - D, brighter and forward-leaning
const E2 = 82.41, D2 = 73.42, FS3 = 185.0, FS4 = 369.99;
const PLAYFUL_BARS = [
  { bass: N.G2, pad: [N.G3, N.B3, N.D4], arp: [N.G4, N.B4, N.D5, N.G5] },
  { bass: E2, pad: [N.E3, N.G3, N.B3], arp: [N.E4, N.G4, N.B4, N.E5] },
  { bass: N.C2, pad: [N.C3, N.E3, N.G3], arp: [N.C4, N.E4, N.G4, N.C5] },
  { bass: D2, pad: [N.D3, FS3, N.A3], arp: [N.D4, FS4, N.A4, N.D5] },
];
// educational: C - Am - F - G, optimistic explainer feel; melody notes are
// scale steps around the chord (quarter-note pace, calm and clear)
const EDU_BARS = [
  { bass: N.C2, pad: [N.C3, N.E3, N.G3], arp: [N.E4, N.G4, N.C5, N.G4], melody: [N.E5, N.D5, N.C5, N.G4] },
  { bass: N.A2, pad: [N.A3 / 2, N.C3, N.E3], arp: [N.C4, N.E4, N.A4, N.E4], melody: [N.C5, N.B4, N.A4, N.E4] },
  { bass: N.F2, pad: [N.F3, N.A3, N.C4], arp: [N.A4, N.C5, N.F4, N.C5], melody: [N.A4, N.G4, N.F4, N.A4] },
  { bass: N.G2, pad: [N.G3, N.B3, N.D4], arp: [N.B4, N.D5, N.G4, N.D5], melody: [N.B4, N.C5, N.D5, N.G4] },
];
// inspiring: D - A - Bm - G, anthemic and driving
const D2b = 73.42, A2b = 110.0, B2 = 123.47, G2b = 98.0, FS4b = 369.99, FS5 = 739.99, B4b = 493.88, CS5 = 554.37;
const INSPIRING_BARS = [
  { bass: D2b, pad: [N.D4 / 2 * 1, FS4b / 2, N.A3], arp: [N.D4, FS4b, N.A4, N.D5, FS5, N.A4], melody: [N.D5, FS5, N.A4, N.D5] },
  { bass: A2b, pad: [N.A3, CS5 / 2, N.E4], arp: [N.A4, CS5, N.E5, N.A5, N.E5, CS5], melody: [CS5, N.E5, N.A4, CS5] },
  { bass: B2, pad: [N.B3, N.D4, FS4b], arp: [B4b, N.D5, FS5, B4b * 2, FS5, N.D5], melody: [N.D5, FS5, B4b, N.D5] },
  { bass: G2b, pad: [N.G3, N.B3, N.D4], arp: [N.G4, B4b, N.D5, N.G5, N.D5, B4b], melody: [B4b, N.D5, N.G4, B4b] },
];
// calm: Cmaj7 - Am7 - Fmaj7 - G, soft study-music feel; no drums at all,
// slow pads + one gentle felt-piano note per half bar
const CALM_BARS = [
  { bass: N.C2, pad: [N.C3, N.E3, N.G3, N.B3], melody: [N.E4, N.G4] },
  { bass: N.A2, pad: [N.A3 / 2, N.C3, N.E3, N.G3], melody: [N.C4, N.E4] },
  { bass: N.F2, pad: [N.F3, N.A3, N.C4, N.E4], melody: [N.A4, N.F4] },
  { bass: N.G2, pad: [N.G3, N.B3, N.D4], melody: [N.D4, N.B3] },
];
const BARS =
  STYLE === "calm"
    ? CALM_BARS
    : STYLE === "playful"
    ? PLAYFUL_BARS
    : STYLE === "educational"
      ? EDU_BARS
      : STYLE === "inspiring"
        ? INSPIRING_BARS
        : UPBEAT_BARS;

/** Tone with attack/decay envelope and optional exponential pitch glide. */
function tone(freq, startSec, attack, decay, peak, { waveform = "sine", glideTo, glideTime } = {}) {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const total = Math.floor((attack + decay) * SAMPLE_RATE);
  let phase = 0;
  for (let i = 0; i < total; i++) {
    const idx = start + i;
    if (idx < 0 || idx >= buf.length) continue;
    const t = i / SAMPLE_RATE;
    const f = glideTo
      ? freq * Math.pow(glideTo / freq, Math.min(t / (glideTime ?? attack + decay), 1))
      : freq;
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    const wave =
      waveform === "triangle"
        ? (2 / Math.PI) * Math.asin(Math.sin(phase))
        : Math.sin(phase);
    const env =
      t < attack ? Math.pow(t / attack, 1.4) : Math.pow(1 - (t - attack) / decay, 2.2);
    buf[idx] += wave * env * peak;
  }
}

/** High-passed noise burst — hi-hat / shaker. */
function hat(startSec, decay, peak) {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const total = Math.floor(decay * SAMPLE_RATE);
  let prevX = 0, prevY = 0;
  const a = 0.86; // one-pole highpass
  for (let i = 0; i < total; i++) {
    const idx = start + i;
    if (idx < 0 || idx >= buf.length) continue;
    const x = 2 * Math.random() - 1;
    const y = a * (prevY + x - prevX);
    prevX = x; prevY = y;
    const env = Math.pow(1 - i / total, 3);
    buf[idx] += y * env * peak;
  }
}

/** Soft kick — sine drop 150→52 Hz. */
const kick = (t) =>
  tone(150, t, 0.004, 0.16, 0.16, { glideTo: 52, glideTime: 0.1 });

/** Clap — two quick mid-band noise bursts. */
function clap(t, peak) {
  const burst = (start) => {
    const s = Math.floor(start * SAMPLE_RATE);
    const total = Math.floor(0.09 * SAMPLE_RATE);
    let prevX = 0, prevY = 0;
    const a = 0.6; // softer highpass than the hat — mid "clap" body
    for (let i = 0; i < total; i++) {
      const idx = s + i;
      if (idx < 0 || idx >= buf.length) continue;
      const x = 2 * Math.random() - 1;
      const y = a * (prevY + x - prevX);
      prevX = x; prevY = y;
      buf[idx] += y * Math.pow(1 - i / total, 2.5) * peak;
    }
  };
  burst(t);
  burst(t + 0.016);
}

// playful style: bright pentatonic riff per bar (indices into chord.arp,
// null = rest) played as 8th notes — catchy, bouncy, lots of air
const RIFF = [0, null, 1, 2, null, 3, 2, 1];

const totalBeats = Math.floor(SECONDS / SPB);
for (let beat = 0; beat < totalBeats; beat++) {
  const t = beat * SPB;
  const bar = Math.floor(beat / 4);
  const beatInBar = beat % 4;
  const chord = BARS[bar % BARS.length];

  if (STYLE === "calm") {
    // no percussion whatsoever — nothing for the ear to latch onto

    // warm sustained pad, one slow swell per bar (soft attack, long release)
    if (beatInBar === 0) {
      for (const f of chord.pad) {
        tone(f, t, 1.6, 4 * SPB, 0.028);
        tone(f / 2, t, 1.8, 4 * SPB, 0.014); // sub-octave warmth
      }
      // deep soft root under the pad
      tone(chord.bass * 2, t, 0.8, 4 * SPB, 0.03);
    }

    // sparse felt-piano: one gentle note per half bar, nothing busy
    if (beatInBar === 0 || beatInBar === 2) {
      const m = chord.melody[beatInBar === 0 ? 0 : 1];
      tone(m, t, 0.03, 2.2, 0.045, { waveform: "triangle" });
      tone(m, t, 0.03, 2.2, 0.02); // sine layer rounds the attack
    }
  } else if (STYLE === "inspiring") {
    // drums: kick 1 & 3, clap on 2 & 4, driving 8th hats
    if (beatInBar === 0 || beatInBar === 2) kick(t);
    if (beatInBar === 1 || beatInBar === 3) clap(t, 0.08);
    hat(t + SPB / 2, 0.05, 0.08);
    hat(t, 0.04, 0.045);

    // driving 8th-note bass — the engine of the track
    tone(chord.bass, t, 0.005, 0.2, 0.13, { waveform: "triangle" });
    tone(chord.bass, t + SPB / 2, 0.005, 0.18, 0.11, { waveform: "triangle" });

    // piano-style octave stab on each beat + moving arp on the off-beat
    const m = chord.melody[beatInBar];
    tone(m, t, 0.006, 0.5, 0.06, { waveform: "triangle" });
    tone(m / 2, t, 0.006, 0.5, 0.045, { waveform: "triangle" });
    const a = chord.arp[(beat * 2 + 1) % chord.arp.length];
    tone(a, t + SPB / 2, 0.005, 0.3, 0.045, { waveform: "triangle" });

    // swelling pad each bar — the anthemic lift
    if (beatInBar === 0) {
      for (const f of chord.pad) {
        tone(f, t, 0.6, 4 * SPB, 0.03);
        tone(f * 2, t, 0.8, 4 * SPB, 0.012);
      }
    }
  } else if (STYLE === "educational") {
    // percussion: whisper-light — shaker 8ths, tiny tick on 2 & 4, no kick
    hat(t + SPB / 2, 0.06, 0.045);
    if (beatInBar === 1 || beatInBar === 3) hat(t, 0.035, 0.03);

    // felt-piano bass: one warm root per half bar
    if (beatInBar === 0 || beatInBar === 2) {
      tone(chord.bass * 2, t, 0.012, 0.9, 0.09, { waveform: "triangle" });
    }

    // felt-piano melody: one clear note per beat — calm quarter-note pace
    const m = chord.melody[beatInBar];
    tone(m, t, 0.012, 0.85, 0.075, { waveform: "triangle" });
    tone(m, t, 0.012, 0.85, 0.03); // sine layer rounds off the pluck

    // gentle arpeggio fill on the off-beats, quieter than the melody
    const a = chord.arp[beatInBar];
    tone(a, t + SPB / 2, 0.008, 0.5, 0.035, { waveform: "triangle" });

    // warm pad each bar + a soft bell every second bar
    if (beatInBar === 0) {
      for (const f of chord.pad) tone(f, t, 0.5, 4 * SPB, 0.025);
      if (bar % 2 === 0) tone(chord.melody[0] * 2, t, 0.003, 1.4, 0.022);
    }
  } else if (STYLE === "playful") {
    // drums: kick on 1 & 3, clap on 2 & 4, light 8th hats
    if (beatInBar === 0 || beatInBar === 2) kick(t);
    if (beatInBar === 1 || beatInBar === 3) clap(t, 0.09);
    hat(t + SPB / 2, 0.05, 0.07);

    // bouncy octave bass: root on the beat, octave up on the off-beat
    tone(chord.bass, t, 0.006, 0.2, 0.13, { waveform: "triangle" });
    tone(chord.bass * 2, t + SPB / 2, 0.006, 0.16, 0.1, { waveform: "triangle" });

    // pizzicato riff: very short plucks with rests — playful, not busy
    for (const half of [0, 1]) {
      const slot = (beatInBar * 2 + half) % RIFF.length;
      const deg = RIFF[slot];
      if (deg === null) continue;
      const f = chord.arp[deg % chord.arp.length];
      tone(f, t + half * (SPB / 2), 0.003, 0.14, 0.085, { waveform: "triangle" });
    }

    // glockenspiel sparkle on each bar start (two octaves up, long ring)
    if (beatInBar === 0) {
      tone(chord.arp[0] * 2, t, 0.002, 1.1, 0.035);
      for (const f of chord.pad) tone(f, t, 0.3, 4 * SPB, 0.02);
    }
  } else {
    // drums: light four-on-the-floor + off-beat hats
    kick(t);
    hat(t + SPB / 2, 0.07, 0.1);
    if (beatInBar === 1 || beatInBar === 3) hat(t, 0.05, 0.05); // ghost hat on 2 & 4

    // plucky bass: root 8ths with an octave push on beat 4
    tone(chord.bass, t, 0.006, 0.22, 0.13, { waveform: "triangle" });
    tone(beatInBar === 3 ? chord.bass * 2 : chord.bass, t + SPB / 2, 0.006, 0.18, 0.09, { waveform: "triangle" });

    // bright marimba arp: two 8th notes per beat cycling the chord
    const a1 = chord.arp[(beat * 2) % chord.arp.length];
    const a2 = chord.arp[(beat * 2 + 1) % chord.arp.length];
    tone(a1, t, 0.004, 0.3, 0.07, { waveform: "triangle" });
    tone(a2, t + SPB / 2, 0.004, 0.3, 0.055, { waveform: "triangle" });

    // soft pad swell once per bar
    if (beatInBar === 0) {
      for (const f of chord.pad) {
        tone(f, t, 0.4, 4 * SPB, 0.028);
        tone(f, t, 0.4, 4 * SPB, 0.024, { glideTo: f * 1.005, glideTime: 4 * SPB });
      }
    }
  }
}

// fades: 0.8s in (get going quickly), 2.5s out
const fadeIn = 0.8 * SAMPLE_RATE;
const fadeOut = 2.5 * SAMPLE_RATE;
for (let i = 0; i < fadeIn && i < buf.length; i++) buf[i] *= i / fadeIn;
for (let i = 0; i < fadeOut && i < buf.length; i++) {
  buf[buf.length - 1 - i] *= i / fadeOut;
}

// peak-normalize: calm sits lower (-23 dBFS) so it never competes with the
// voice; other styles are energetic beds at -19 dBFS
const NORM_DB = STYLE === "calm" ? -23 : -19;
const peak = buf.reduce((m, s) => Math.max(m, Math.abs(s)), 0);
const target = Math.pow(10, NORM_DB / 20);
if (peak > 0) for (let i = 0; i < buf.length; i++) buf[i] *= target / peak;

const n = buf.length;
const wav = Buffer.alloc(44 + n * 2);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + n * 2, 4);
wav.write("WAVE", 8);
wav.write("fmt ", 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(SAMPLE_RATE, 24);
wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) {
  const s = Math.max(-1, Math.min(1, buf[i]));
  wav.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, wav);
console.log(`${OUT}  (${SECONDS}s, ${BPM} BPM, ${STYLE}, peak ${NORM_DB} dBFS)`);
