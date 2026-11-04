/**
 * ElevenLabs dialog audio for AI Builder Course scripts.
 *
 * Script mode: parses a script (## Section N headings, **Teacher:** /
 * **Gulla:** dialog lines, HTML-comment cues stripped), makes ONE TTS call
 * per dialog line → audios/lines/sN-lMM-<speaker>.mp3, then stitches each
 * section into audios/section-N.mp3 with a natural pause between lines and
 * writes audios/line-timings.json (exact line boundaries — no silence
 * hunting needed). Gulla line clips are also copied to <out>/../gulla-audio/
 * so the green-screen videos are made from the IDENTICAL take.
 *
 * Line calls are CACHED by content hash (text+voice+model+settings) in
 * audios/lines/manifest.json — re-runs only hit the API for changed lines;
 * stitching is always redone (cheap, local).
 *
 * One-off mode: --text "..." --speaker teacher --out file.mp3
 *
 * Usage:
 *   node gen-dialog-audio.mjs --script scripts/test-script/script.md \
 *     [--out <script-dir>/audios] [--sections 1,3,5] [--pause 0.6] \
 *     [--model eleven_v3] [--force] [--estimate]
 *   node gen-dialog-audio.mjs --text "नमस्ते!" --speaker gulla --out hi.mp3
 *
 * --estimate prints the character count + affected lines and EXITS without
 * calling the API (use it to confirm cost with the user first).
 *
 * API key: ELEVENLABS_API_KEY env var, or the nearest .env found upward
 * from cwd. Voices/model: voices.json next to this script's parent dir.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const val = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : dflt;
};
const has = (flag) => args.includes(flag);

// --- config ----------------------------------------------------------------
const findKey = () => {
  // Keys are the USER's, never the skill's. Env var only: no .env is read from
  // the skill directory or walked up from cwd, so a key can never travel with
  // a copied/packaged skill. If it is unset we stop with the exact fix.
  const k = process.env.ELEVENLABS_API_KEY;
  if (k && k.trim()) return k.trim();
  console.error(
    [
      "",
      "  ELEVENLABS_API_KEY is not set.",
      "",
      "  This skill never ships or stores a key. Set your own ElevenLabs key:",
      "",
      "    export ELEVENLABS_API_KEY='<your-key>'",
      "",
      "  To keep it across sessions, add that line to your shell profile",
      "  (~/.zshrc on macOS), then open a new terminal.",
      "",
    ].join("\n"),
  );
  process.exit(1);
};
const VOICES = JSON.parse(readFileSync(join(SKILL_DIR, "voices.json"), "utf8"));
const MODEL = val("--model", VOICES.model);
const PAUSE = parseFloat(val("--pause", "0.6"));
const FORCE = has("--force");
const ESTIMATE = has("--estimate");

const hashOf = (text, voiceId) =>
  createHash("sha256")
    .update(JSON.stringify({ text, voiceId, MODEL, settings: VOICES.characters }))
    .digest("hex")
    .slice(0, 16);

// --- TTS call --------------------------------------------------------------
const tts = async (text, speaker, outFile) => {
  const ch = VOICES.characters[speaker];
  if (!ch) {
    console.error(`Unknown speaker "${speaker}" — voices.json has: ${Object.keys(VOICES.characters).join(", ")}`);
    process.exit(1);
  }
  const key = findKey();
  const body = { text, model_id: MODEL };
  if (ch.settings) body.voice_settings = ch.settings;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ch.voice_id}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (res.ok) {
      writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
      return;
    }
    const errText = await res.text();
    if (res.status === 429 || res.status >= 500) {
      console.log(`  retry ${attempt}/3 (${res.status})...`);
      await new Promise((r) => setTimeout(r, attempt * 2000));
      continue;
    }
    console.error(`TTS failed (${res.status}): ${errText}`);
    process.exit(1);
  }
  console.error("TTS failed after 3 retries.");
  process.exit(1);
};

const durationOf = (file) =>
  parseFloat(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
      { encoding: "utf8" },
    ),
  );

// --- one-off mode ----------------------------------------------------------
if (val("--text")) {
  const out = val("--out", "tts-out.mp3");
  const speaker = val("--speaker", "teacher");
  const text = val("--text");
  if (ESTIMATE) {
    console.log(`${text.length} characters → 1 call (${speaker}, ${MODEL}).`);
    process.exit(0);
  }
  await tts(text, speaker, out);
  console.log(`Wrote ${out} (${durationOf(out).toFixed(2)}s, ${speaker}, ${MODEL})`);
  process.exit(0);
}

// --- script mode -----------------------------------------------------------
const scriptPath = val("--script");
if (!scriptPath) {
  console.error("Need --script <file> or --text <text>. See header for usage.");
  process.exit(1);
}
const outDir = val("--out", join(dirname(resolve(scriptPath)), "audios"));
const linesDir = join(outDir, "lines");
const gullaDir = join(dirname(outDir), "gulla-audio");
const onlySections = val("--sections")
  ? val("--sections").split(",").map(Number)
  : null;

// Parse: sections by `## ...N`, dialogs by `**Speaker:** text` (possibly
// multi-paragraph until the next dialog/heading). HTML comments stripped.
const raw = readFileSync(scriptPath, "utf8").replace(/<!--[\s\S]*?-->/g, "");
const sections = [];
let cur = null;
for (const line of raw.split("\n")) {
  // Any #/##/### heading starts a section; its number comes from a digit in
  // the heading ("# 3", "## Section 3") or sequentially when it has none
  // ("## HARDWARE AUR SOFTWARE" → next number).
  const h = line.match(/^#{1,3}\s+(.*)$/);
  if (h) {
    const num = h[1].match(/(\d+)/);
    cur = { n: num ? Number(num[1]) : sections.length + 1, lines: [] };
    sections.push(cur);
    continue;
  }
  const d = line.match(/^\*\*(Teacher|Gulla)[:：]?\*\*[:：]?\s*(.*)$/i);
  if (d && cur) {
    cur.lines.push({ speaker: d[1].toLowerCase(), text: d[2].trim() });
    continue;
  }
  // continuation paragraph of the previous dialog line
  if (cur && cur.lines.length && line.trim() && !line.startsWith("#")) {
    cur.lines[cur.lines.length - 1].text += " " + line.trim();
  }
}
const wanted = sections.filter(
  (s) => s.lines.length && (!onlySections || onlySections.includes(s.n)),
);
if (!wanted.length) {
  console.error("No dialog lines found — check the script format (## Section N, **Teacher:** ...).");
  process.exit(1);
}

// --- dialogue mode: ONE v3 text-to-dialogue call, all lines, both voices ---
// (Harshit's rule, 2026-07-22: whole-video audio is generated as one flowing
// conversation — the voices react to each other, no per-line stitch feel.)
// Output: <out>/dialogue-full.mp3 — split into section files afterwards
// (whisper-aligned cuts, done in the video pipeline, file never re-encoded
// beyond the cuts). No per-line cache: a dialogue run always bills all chars.
if (has("--dialogue")) {
  const all = wanted.flatMap((s) => s.lines);
  const chars = all.reduce((n, l) => n + l.text.length, 0);
  console.log(`dialogue mode: ${wanted.length} section(s), ${all.length} line(s), ~${chars} characters in ONE ${MODEL} call.`);
  if (ESTIMATE) process.exit(0);
  const inputs = all.map((l) => {
    const ch = VOICES.characters[l.speaker];
    if (!ch) { console.error(`Unknown speaker "${l.speaker}"`); process.exit(1); }
    return { text: l.text, voice_id: ch.voice_id };
  });
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "dialogue-full.mp3");
  const key = findKey();
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(
      "https://api.elevenlabs.io/v1/text-to-dialogue?output_format=mp3_44100_128",
      {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs, model_id: MODEL }),
      },
    );
    if (res.ok) {
      writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
      console.log(`Wrote ${outFile} (${durationOf(outFile).toFixed(2)}s, ${all.length} lines, one flow).`);
      process.exit(0);
    }
    const errText = await res.text();
    if (res.status === 429 || res.status >= 500) {
      console.log(`  retry ${attempt}/3 (${res.status})...`);
      await new Promise((r) => setTimeout(r, attempt * 2000));
      continue;
    }
    console.error(`text-to-dialogue failed (${res.status}): ${errText}`);
    process.exit(1);
  }
  console.error("text-to-dialogue failed after 3 retries.");
  process.exit(1);
}

// cache manifest
mkdirSync(linesDir, { recursive: true });
const manifestPath = join(linesDir, "manifest.json");
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : {};

// estimate pass
let chars = 0, calls = 0;
for (const s of wanted) {
  s.lines.forEach((l, i) => {
    l.file = join(linesDir, `s${s.n}-l${String(i + 1).padStart(2, "0")}-${l.speaker}.mp3`);
    l.cached = !FORCE && existsSync(l.file) &&
      manifest[basename(l.file)] === hashOf(l.text, VOICES.characters[l.speaker]?.voice_id);
    if (!l.cached) { chars += l.text.length; calls++; }
  });
}
console.log(`${wanted.length} section(s), ${wanted.reduce((n, s) => n + s.lines.length, 0)} line(s) — ${calls} API call(s), ~${chars} characters (${MODEL}).`);
if (ESTIMATE) process.exit(0);

// generate
for (const s of wanted) {
  for (const l of s.lines) {
    if (l.cached) { console.log(`  cached  ${basename(l.file)}`); continue; }
    console.log(`  tts     ${basename(l.file)}  [${l.speaker}] ${l.text.slice(0, 60)}...`);
    await tts(l.text, l.speaker, l.file);
    manifest[basename(l.file)] = hashOf(l.text, VOICES.characters[l.speaker].voice_id);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
}

// stitch sections + timings
mkdirSync(gullaDir, { recursive: true });
const timings = [];
for (const s of wanted) {
  const sectionFile = join(outDir, `section-${s.n}.mp3`);
  const inputs = s.lines.flatMap((l) => ["-i", l.file]);
  let graph = "", concatIns = "", t = 0;
  const lineTimings = [];
  s.lines.forEach((l, i) => {
    const dur = durationOf(l.file);
    lineTimings.push({
      line: i + 1, speaker: l.speaker, file: basename(l.file),
      text: l.text, start: Math.round(t * 100) / 100,
      end: Math.round((t + dur) * 100) / 100,
    });
    concatIns += `[${i}:a]`;
    if (i < s.lines.length - 1) {
      graph += `aevalsrc=0:d=${PAUSE}:s=44100[sil${i}];`;
      concatIns += `[sil${i}]`;
      t += dur + PAUSE;
    } else t += dur;
  });
  const nIn = s.lines.length * 2 - 1;
  graph += `${concatIns}concat=n=${nIn}:v=0:a=1[out]`;
  execFileSync(
    "ffmpeg",
    ["-y", "-hide_banner", "-loglevel", "error", ...inputs,
      "-filter_complex", graph, "-map", "[out]", "-ar", "44100", "-b:a", "128k", sectionFile],
    { stdio: "inherit" },
  );
  timings.push({ section: s.n, file: basename(sectionFile), duration: Math.round(t * 100) / 100, pause: PAUSE, lines: lineTimings });
  console.log(`  stitched ${basename(sectionFile)} (${t.toFixed(2)}s, ${s.lines.length} lines)`);
  for (const l of s.lines.filter((x) => x.speaker === "gulla")) {
    copyFileSync(l.file, join(gullaDir, basename(l.file)));
  }
}
writeFileSync(join(outDir, "line-timings.json"), JSON.stringify(timings, null, 2));
console.log(`\nWrote ${join(outDir, "line-timings.json")}. Gulla takes copied to ${gullaDir} — make the green-screen clips from THESE files so clip audio = section audio.`);
