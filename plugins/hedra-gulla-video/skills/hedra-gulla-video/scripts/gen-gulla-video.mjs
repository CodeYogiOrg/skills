/**
 * Gulla talking-head videos via the Hedra API (Character 3).
 *
 * Feeds the FIXED green-screen Gulla image (gulla-green.png in this skill)
 * plus a Gulla line's audio (the elevenlabs-audio take) to Hedra, downloads
 * the talking video — green background intact — so the existing
 * prep-gulla.mjs chroma-key → WebM → mount pipeline runs on it UNCHANGED.
 *
 * Usage:
 *   node gen-gulla-video.mjs --audio <video-folder>/gulla-audio/s2-l01-gulla.mp3 \
 *     [--out <same-dir-as-audio>/../gulla/<n>.mp4] [--resolution 720p] \
 *     [--prompt "..."] [--estimate]
 *   node gen-gulla-video.mjs --audio-dir <video-folder>/gulla-audio   # every take, in order
 *
 * --estimate prints the credit cost (7 credits/sec at 720p, ×1.25 @1080p,
 * ×0.5 @540p) and exits without generating.
 *
 * Key: HEDRA_API_KEY from env or nearest .env upward from cwd.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.hedra.com/web-app/public";
const MODEL_ID = "d1dd37a3-e39a-4854-a298-6510289f9cf2"; // Hedra Character 3
const CREDITS_PER_SEC = { "540p": 3.5, "720p": 7, "1080p": 8.75 };

const args = process.argv.slice(2);
const val = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : dflt;
};
const RESOLUTION = val("--resolution", "720p");
// --image: character image override. Default = green screen (keyed downstream).
// Video 3 experiment (Harshit, 2026-07-21): a Gulla composited on the flat
// paper color (#D9C5A3) generates clips that mount full-bleed with NO keying —
// the scene re-adds PaperBackground's noise/vignette overlays on top.
const IMAGE = resolve(val("--image", join(SKILL_DIR, "gulla-green.png")));
const PAD = parseFloat(val("--pad", "0.8")); // idle-motion silence added to each end
// Hedra animates idle body motion during silence, so padding the audio makes
// Gulla keep moving (never frozen). Override each end independently — e.g. a
// long --pad-end for a scene where Gulla holds on screen while a reply plays.
const PAD_START = parseFloat(val("--pad-start", String(PAD)));
const PAD_END = parseFloat(val("--pad-end", String(PAD)));
const PROMPT = val(
  "--prompt",
  "Cartoon boy character speaking directly to camera, natural friendly talking, subtle head and hand movement, body stays in place, plain solid green background stays perfectly still and uniform",
);

const findKey = () => {
  // Keys are the USER's, never the skill's. Env var only: no .env is read from
  // the skill directory or walked up from cwd, so a key can never travel with
  // a copied/packaged skill. If it is unset we stop with the exact fix.
  const k = process.env.HEDRA_API_KEY;
  if (k && k.trim()) return k.trim();
  console.error(
    [
      "",
      "  HEDRA_API_KEY is not set.",
      "",
      "  This skill never ships or stores a key. Set your own Hedra key:",
      "",
      "    export HEDRA_API_KEY='<your-key>'",
      "",
      "  To keep it across sessions, add that line to your shell profile",
      "  (~/.zshrc on macOS), then open a new terminal.",
      "",
    ].join("\n"),
  );
  process.exit(1);
};
const KEY = findKey();

const api = async (method, path, body, isForm = false) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "X-API-Key": KEY,
      ...(isForm ? {} : body ? { "Content-Type": "application/json" } : {}),
    },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    console.error(`${method} ${path} → ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  return res.json();
};

const durationOf = (file) =>
  parseFloat(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
      { encoding: "utf8" },
    ),
  );

const uploadAsset = async (file, type) => {
  const asset = await api("POST", "/assets", { name: basename(file), type });
  const form = new FormData();
  form.append("file", new Blob([readFileSync(file)]), basename(file));
  await api("POST", `/assets/${asset.id}/upload`, form, true);
  return asset.id;
};

// --- collect jobs ----------------------------------------------------------
const audios = [];
if (val("--audio")) audios.push(val("--audio"));
if (val("--audio-dir")) {
  const d = val("--audio-dir");
  for (const f of readdirSync(d).sort()) {
    if (f.endsWith(".mp3") || f.endsWith(".wav")) audios.push(join(d, f));
  }
}
if (!audios.length) {
  console.error("Need --audio <file> or --audio-dir <dir>.");
  process.exit(1);
}

const totalSec = audios.reduce((s, a) => s + durationOf(a) + PAD_START + PAD_END, 0);
const credits = Math.ceil(totalSec * CREDITS_PER_SEC[RESOLUTION]);
const balance = await api("GET", "/billing/credits");
console.log(
  `${audios.length} clip(s), ${totalSec.toFixed(1)}s audio → ~${credits} credits at ${RESOLUTION} (balance: ${balance.remaining}).`,
);
if (args.includes("--estimate")) process.exit(0);
if (credits > balance.remaining) {
  console.error("Not enough Hedra credits.");
  process.exit(1);
}

// --- generate --------------------------------------------------------------
console.log("Uploading Gulla character image...");
const imageId = await uploadAsset(IMAGE, "image");

for (const [i, audio] of audios.entries()) {
  const outDefault = join(dirname(dirname(resolve(audio))), "gulla", `${i + 1}.mp4`);
  const out = audios.length === 1 ? val("--out", outDefault) : outDefault;
  mkdirSync(dirname(out), { recursive: true });

  console.log(`[${i + 1}/${audios.length}] ${basename(audio)} (${durationOf(audio).toFixed(1)}s + ${PAD_START}s/${PAD_END}s idle pad)`);
  // Pad silence on both ends so Hedra animates real idle motion for the
  // entrance/exit (prep-gulla trims to speech, so the mounted span still
  // matches the section audio take exactly — padding is outside it). A long
  // --pad-end gives Gulla motion to hold on while a reply plays over him.
  const padded = join(dirname(resolve(audio)), `.padded-${basename(audio)}.wav`);
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", audio,
    "-af", `adelay=${PAD_START * 1000}:all=1,apad=pad_dur=${PAD_END}`, padded]);
  const audioId = await uploadAsset(padded, "audio");
  rmSync(padded);
  const gen = await api("POST", "/generations", {
    type: "video",
    ai_model_id: MODEL_ID,
    start_keyframe_id: imageId,
    audio_id: audioId,
    generated_video_inputs: {
      text_prompt: PROMPT,
      resolution: RESOLUTION,
      aspect_ratio: "9:16",
    },
  });

  let status, url;
  for (let tries = 0; tries < 120; tries++) {
    await new Promise((r) => setTimeout(r, 10000));
    const s = await api("GET", `/generations/${gen.id}/status`);
    status = s.status;
    url = s.url ?? s.asset?.url;
    process.stdout.write(`  ${status}          \r`);
    if (status === "complete" || status === "error") break;
  }
  if (status !== "complete" || !url) {
    console.error(`\nGeneration failed (status: ${status}).`);
    process.exit(1);
  }
  const mp4 = await fetch(url);
  writeFileSync(out, Buffer.from(await mp4.arrayBuffer()));
  console.log(`\n  saved ${out} (${durationOf(out).toFixed(1)}s)`);
}

console.log(`\nDone. Next: chroma-key + mount numbers per clip →
  node scripts/prep-gulla.mjs <clip> --out public/gulla/gulla-NN.webm`);
