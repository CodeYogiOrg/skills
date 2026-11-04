/**
 * Norms lint — catches violations of the settled video rules BEFORE a
 * multi-minute render, not after. Run alongside `npx tsc --noEmit`.
 *
 * ERRORS (exit 1):
 *   - <PaperBackground> inside a scene file (belongs ONCE in Video.tsx)
 *   - TransitionSeries / @remotion/transitions anywhere (crossfade is banned)
 *   - Root.tsx hardcoding durationInFrames / not importing TOTAL_DURATION
 *   - portrait swap: width={1920} or height={1080} in Root.tsx
 *   - subtitle data file whose LAST word ends with a comma (Harshit's rule)
 *   - cuelume play() inside src/ (renders silent — must be pre-rendered WAVs)
 *
 * WARNINGS:
 *   - scene file with JSX content not wrapped in <SceneInOut>
 *   - literal <PopIn at={N}> with no <Sfx ... at={N}> at the same frame in
 *     that file (every visible action needs its sound)
 *
 * Usage: node scripts/lint-norms.mjs   (from the project root)
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const errors = [];
const warnings = [];
const read = (p) => readFileSync(p, "utf8");

// --- scenes ----------------------------------------------------------------
const sceneDir = "src/scenes";
for (const f of existsSync(sceneDir) ? readdirSync(sceneDir) : []) {
  if (!f.endsWith(".tsx")) continue;
  const p = join(sceneDir, f);
  const src = read(p);

  if (/<PaperBackground/.test(src)) {
    errors.push(`${p}: <PaperBackground> inside a scene — it lives ONCE in Video.tsx.`);
  }
  const hasJsx = /return\s*\(/.test(src) || /=>\s*\(/.test(src);
  if (hasJsx && !/SceneInOut/.test(src)) {
    warnings.push(`${p}: scene content not wrapped in <SceneInOut> — content will not swap cleanly at cuts.`);
  }

  // literal-frame PopIn ↔ Sfx pairing (expressions are skipped)
  const pops = [...src.matchAll(/<PopIn\s+at=\{(\d+)\}/g)].map((m) => m[1]);
  const sfx = new Set([...src.matchAll(/<Sfx[^>]*\bat=\{(\d+)\}/g)].map((m) => m[1]));
  for (const at of pops) {
    if (!sfx.has(at)) {
      warnings.push(`${p}: <PopIn at={${at}}> has no <Sfx at={${at}}> — every pop needs its sound at the exact frame.`);
    }
  }
}

// --- global bans -----------------------------------------------------------
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
for (const p of existsSync("src") ? walk("src") : []) {
  if (!/\.(tsx?|jsx?)$/.test(p)) continue;
  const src = read(p);
  if (/TransitionSeries|@remotion\/transitions/.test(src)) {
    errors.push(`${p}: crossfade transitions are banned — use <SceneInOut> + hard cuts.`);
  }
  if (/\bcuelume\b/.test(src) && /\.play\(/.test(src)) {
    errors.push(`${p}: cuelume play() in a composition renders SILENT — pre-render WAVs via gen-sfx.mjs.`);
  }
}

// --- Root.tsx --------------------------------------------------------------
if (existsSync("src/Root.tsx")) {
  const root = read("src/Root.tsx");
  if (/durationInFrames=\{\d+\}/.test(root) || !/TOTAL_DURATION/.test(root)) {
    errors.push("src/Root.tsx: durationInFrames must be the imported TOTAL_DURATION, never a hardcoded number.");
  }
  if (/width=\{1920\}|height=\{1080\}/.test(root)) {
    errors.push("src/Root.tsx: portrait swap — the format is width={1080} height={1920} (9:16 vertical).");
  }
}

// --- subtitle data files ---------------------------------------------------
const dataDir = "src/data";
for (const f of existsSync(dataDir) ? readdirSync(dataDir) : []) {
  if (!f.endsWith(".ts")) continue;
  const p = join(dataDir, f);
  const words = [...read(p).matchAll(/word:\s*"([^"]+)"/g)].map((m) => m[1]);
  const lastWord = words[words.length - 1];
  if (lastWord?.endsWith(",")) {
    errors.push(`${p}: subtitle text ends with a comma ("${lastWord}") — end with । or no punctuation (Harshit's rule).`);
  }
}

// --- report ----------------------------------------------------------------
for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length ? 1 : 0);
