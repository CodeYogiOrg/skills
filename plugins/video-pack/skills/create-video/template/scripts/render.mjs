/**
 * Auto-versioned render — never overwrites an earlier render (Harshit's
 * rule): scans out/ for the highest existing -vNN and renders the next one.
 *
 * Usage:
 *   node scripts/render.mjs [--id Video] [--prefix video-N] [--dry]
 *
 * --id      composition id registered in Root.tsx (default "Video")
 * --prefix  output name prefix (default: the composition id)
 * --dry     print the target path without rendering
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";

const args = process.argv.slice(2);
const val = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : dflt;
};
const id = val("--id", "Video");
const prefix = val("--prefix", id);
const dry = args.includes("--dry");

mkdirSync("out", { recursive: true });
const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-v(\\d+)\\.mp4$`);
const versions = readdirSync("out")
  .map((f) => re.exec(f)?.[1])
  .filter(Boolean)
  .map(Number);
const next = versions.length ? Math.max(...versions) + 1 : 1;
const target = `out/${prefix}-v${next}.mp4`;

if (existsSync(target)) {
  console.error(`${target} already exists — refusing to overwrite.`);
  process.exit(1);
}
console.log(`Rendering ${id} → ${target}${dry ? "  (dry run)" : ""}`);
if (!dry) {
  execFileSync("npx", ["remotion", "render", id, target], { stdio: "inherit" });
}
