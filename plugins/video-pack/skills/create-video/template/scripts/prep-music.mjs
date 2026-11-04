/**
 * Royalty-free track → ready music bed, one command. Implements the settled
 * rules exactly (same output as the manual chain — no quality change):
 *   1. LEVEL dynamics: dynaudnorm=f=250:g=11:m=12:p=0.9, mono 44.1kHz
 *   2. if the track is shorter than the video: SEAMLESS loop — repeats
 *      joined with acrossfade=d=2 (never butt-joined), atrim to length
 *   3. gain so mean volume = −30 dB (voice stays ~12+ dB above)
 *   4. NO fade-in/fade-out — the bed starts and ends at full level
 *   5. verify continuity: quietest ebur128 momentary (M) must stay within
 *      ~7 dB of the mean M — otherwise pick a more sustained track
 *
 * Usage:
 *   node scripts/prep-music.mjs <track.(mp3|wav)> --seconds 73.2 \
 *     [--out public/audio/music-bed.wav]
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const args = process.argv.slice(2);
const track = args.find((a) => !a.startsWith("--"));
const val = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : dflt;
};
if (!track || !val("--seconds")) {
  console.error("Usage: node scripts/prep-music.mjs <track> --seconds <len> [--out public/audio/music-bed.wav]");
  process.exit(1);
}
const seconds = parseFloat(val("--seconds"));
const out = val("--out", "public/audio/music-bed.wav");
const CROSS = 2; // acrossfade seconds per loop join

const scratch = join(tmpdir(), `prep-music-${process.pid}`);
mkdirSync(scratch, { recursive: true });
mkdirSync(dirname(out), { recursive: true });
const ff = (a) =>
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...a], { stdio: "inherit" });
const ffStderr = (a) =>
  spawnSync("ffmpeg", ["-hide_banner", ...a], { encoding: "utf8" }).stderr ?? "";

// 1. level dynamics (full track — dynaudnorm needs lookahead context)
const leveled = join(scratch, "leveled.wav");
ff(["-i", track, "-af", "dynaudnorm=f=250:g=11:m=12:p=0.9", "-ar", "44100", "-ac", "1", leveled]);

const dur = parseFloat(
  execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", leveled],
    { encoding: "utf8" },
  ),
);

// 2. seamless loop if needed, then trim to exact length
const sized = join(scratch, "sized.wav");
if (dur >= seconds) {
  ff(["-i", leveled, "-t", String(seconds), sized]);
} else {
  // n copies joined with acrossfade: effective length = n*dur − (n−1)*CROSS
  let n = 2;
  while (n * dur - (n - 1) * CROSS < seconds) n++;
  const inputs = Array.from({ length: n }, () => ["-i", leveled]).flat();
  let graph = "";
  let prev = "[0]";
  for (let i = 1; i < n; i++) {
    const label = i === n - 1 ? "[joined]" : `[a${i}]`;
    graph += `${prev}[${i}]acrossfade=d=${CROSS}${label};`;
    prev = label;
  }
  graph += `[joined]atrim=0:${seconds}[outa]`;
  ff([...inputs, "-filter_complex", graph, "-map", "[outa]", sized]);
  console.log(`Looped ${n}× with acrossfade=d=${CROSS} (track ${dur.toFixed(1)}s → ${seconds}s).`);
}

// 3. gain to mean −30 dB
const volOut = ffStderr(["-i", sized, "-af", "volumedetect", "-f", "null", "-"]);
const mean = parseFloat(volOut.match(/mean_volume: (-?[\d.]+) dB/)?.[1] ?? "NaN");
if (Number.isNaN(mean)) {
  console.error("volumedetect failed"); process.exit(1);
}
const gain = -30 - mean;
ff(["-i", sized, "-af", `volume=${gain.toFixed(2)}dB`, out]);

// 4. verify continuity with ebur128 momentary loudness (skip first/last 1s)
const ebur = ffStderr(["-i", out, "-af", "ebur128", "-f", "null", "-"]);
const mVals = [...ebur.matchAll(/t:\s*([\d.]+)\s+.*?M:\s*(-?[\d.]+)/g)]
  .map((m) => ({ t: parseFloat(m[1]), M: parseFloat(m[2]) }))
  .filter((x) => x.t > 1 && x.t < seconds - 1 && x.M > -70);
const meanM = mVals.reduce((s, x) => s + x.M, 0) / mVals.length;
const minM = Math.min(...mVals.map((x) => x.M));
const dip = meanM - minM;

rmSync(scratch, { recursive: true, force: true });

console.log(`
Wrote ${out}  (${seconds}s, mono 44.1kHz)
  source mean after leveling: ${mean.toFixed(1)} dB → gain ${gain >= 0 ? "+" : ""}${gain.toFixed(1)} dB → mean −30 dB
  continuity: mean M ${meanM.toFixed(1)} LUFS, quietest M ${minM.toFixed(1)} LUFS (dip ${dip.toFixed(1)} dB)
  ${dip <= 7 ? "PASS — continuous, no silent valleys." : "WARN — dips more than 7 dB below mean: pick a more sustained track or strengthen dynaudnorm."}
Remember: no fades on the bed; ducking happens in Video.tsx (SPEECH_WINDOWS).${/floating.?cities/i.test(basename(track)) ? '\nCC-BY credit: "Music: Floating Cities — Kevin MacLeod, incompetech.com"' : ""}`);
