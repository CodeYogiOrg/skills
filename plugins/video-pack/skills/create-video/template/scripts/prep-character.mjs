/**
 * Character green-screen clip → keyed WebM + paste-ready mount numbers.
 *
 * Implements the settled 5d rules in one command:
 *   - speech boundaries via silencedetect (noise=-35dB, d=0.12)
 *   - startFrom = speech-start − 0.15s (Character enters speaking)
 *   - after the last word Character gets EXACTLY 1s total (idle + 10f fade
 *     inside it) → endAt = speech-end + 1.0s, scene duration = the span
 *   - chroma key ONCE to transparent VP9 WebM, audio kept (libopus).
 *     The WebM is a KEPT asset: if the output already exists it is REUSED
 *     (--force to re-key, e.g. after the user replaces the source clip).
 *   - extracts a mid-clip keyed frame to out/ for visual verification.
 *
 * Usage:
 *   node scripts/prep-character.mjs <clip.mp4> --out public/character/character-01.webm \
 *     [--color 0x00FF00] [--similarity 0.15] [--blend 0.05] [--force]
 *
 * If the clip ends before speech-end +1.0s the script says so — freeze the
 * last frame (<Freeze>) for the remainder, per the skill.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname } from "node:path";

const FPS = 30;
const args = process.argv.slice(2);
const clip = args.find((a) => !a.startsWith("--"));
const val = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : dflt;
};
if (!clip) {
  console.error("Usage: node scripts/prep-character.mjs <clip> --out public/character/character-NN.webm [--color 0x00FF00] [--force]");
  process.exit(1);
}
const out = val("--out", `public/character/${basename(clip).replace(/\.[^.]+$/, "")}.webm`);
const color = val("--color", "0x00FF00");
// similarity 0.22 + blend 0.12 keys out the green EDGE FRINGE too, so no green
// line remains on the character boundary. Raising these further washes out the
// whole character (blend eats the blues) — do NOT go higher for spill.
const similarity = val("--similarity", "0.22");
const blend = val("--blend", "0.12");
// Green ON the character (fingertips during gestures) is baked-in SPILL, not
// background — chromakey can't remove it. ffmpeg despill (type=green) fixes it
// WITHOUT tinting whites pink (verified on cap/shirt, 2026-07-21; the earlier
// pink-tint problem came from a different despill approach). 0 disables.
const despill = parseFloat(val("--despill", "0.7"));
const force = args.includes("--force");
// --hold <s>: freeze the last frame for <s> extra seconds so Character can stay on
// screen while a reply plays over his idle (reverse address-bridge). Applied to
// the SOURCE before chromakey (tpad on an already-keyed VP9 drops alpha), all
// in ONE filter chain so the frozen tail keys the same as the rest.
const hold = parseFloat(val("--hold", "0"));

// --- speech boundaries -----------------------------------------------------
const probe = execFileSync(
  "ffprobe",
  ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", clip],
  { encoding: "utf8" },
);
const clipDur = parseFloat(probe);

// silencedetect reports on STDERR — capture it explicitly
const detRes = spawnSync(
  "ffmpeg",
  ["-hide_banner", "-i", clip, "-af", "silencedetect=noise=-35dB:d=0.12", "-f", "null", "-"],
  { encoding: "utf8" },
);
const det = detRes.stderr ?? "";

const run = (re, s) => [...s.matchAll(re)].map((m) => parseFloat(m[1]));
const silStarts = run(/silence_start: ([\d.]+)/g, det);
const silEnds = run(/silence_end: ([\d.]+)/g, det);

// Speech = complement of silence. If the clip opens with silence, speech
// starts at that silence's end; else at 0. Trailing silence: ffmpeg emits a
// silence_end at EOF, so a last interval reaching ~clip end means speech
// ended at that interval's START.
const intervals = silStarts.map((s, i) => [s, silEnds[i] ?? clipDur]);
const speechStart = intervals.length && intervals[0][0] <= 0.05 ? intervals[0][1] : 0;
const last = intervals[intervals.length - 1];
const speechEnd = last && last[1] >= clipDur - 0.1 ? last[0] : clipDur;

// --- mount math (skill 5d) -------------------------------------------------
const startFromSec = Math.max(speechStart - 0.15, 0);
const endAtSecIdeal = speechEnd + 1.0;
const truncated = endAtSecIdeal > clipDur;
const endAtSec = Math.min(endAtSecIdeal, clipDur);
const startFrom = Math.round(startFromSec * FPS);
const durationFrames = Math.round((endAtSecIdeal - startFromSec) * FPS);
const endAt = Math.round(endAtSec * FPS);
const fadeStart = durationFrames - 10;

// --- chroma key (kept asset) -----------------------------------------------
mkdirSync(dirname(out), { recursive: true });
if (existsSync(out) && !force) {
  console.log(`KEPT ASSET: ${out} already exists — reusing (pass --force to re-key).`);
} else {
  console.log(`Keying ${clip} → ${out}${hold > 0 ? ` (+${hold}s frozen tail)` : ""} ...`);
  const vf = (hold > 0 ? `tpad=stop_mode=clone:stop_duration=${hold},` : "") +
    `chromakey=${color}:${similarity}:${blend}` +
    (despill > 0 ? `,despill=type=green:mix=${despill}` : "");
  execFileSync(
    "ffmpeg",
    ["-y", "-hide_banner", "-loglevel", "error", "-i", clip,
      "-vf", vf,
      "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "2M",
      "-auto-alt-ref", "0", "-c:a", "libopus", out],
    { stdio: "inherit" },
  );
}

// mid-clip keyed frame for visual verification (transparent PNG)
mkdirSync("out", { recursive: true });
const still = `out/${basename(out).replace(/\.webm$/, "")}-verify.png`;
// -c:v libvpx-vp9 BEFORE -i: ffmpeg's native VP9 decoder drops the alpha
// channel — without it the verify still shows the green background again.
execFileSync(
  "ffmpeg",
  ["-y", "-hide_banner", "-loglevel", "error", "-c:v", "libvpx-vp9",
    "-ss", ((speechStart + speechEnd) / 2).toFixed(2), "-i", out,
    "-frames:v", "1", still],
  { stdio: "inherit" },
);

// --- report ----------------------------------------------------------------
const r2 = (n) => Math.round(n * 100) / 100;
console.log(`
Clip: ${clip}  (${r2(clipDur)}s)
Speech (silencedetect -35dB/0.12): ${r2(speechStart)}s → ${r2(speechEnd)}s

Paste-ready mount (30fps):
  <OffthreadVideo transparent src={staticFile("${out.replace(/^public\//, "")}")}
    startFrom={${startFrom}}   // ${r2(startFromSec)}s = speech-start − 0.15
    endAt={${endAt}}      // ${r2(endAtSec)}s${truncated ? " (CLIP END — see note)" : " = speech-end + 1.0s"}
  />
  scene duration: ${durationFrames} frames  (speech-end-in-scene + 30)
  SceneInOut exit fade starts f${fadeStart} — after the last word, inside the 1s tail
${truncated ? `\n  NOTE: clip ends ${r2(endAtSecIdeal - clipDur)}s before the 1s tail completes —\n  use <Freeze> on the last frame for the remainder.` : ""}
VERIFY: Read ${still} — no background box, clean edges.
`);
