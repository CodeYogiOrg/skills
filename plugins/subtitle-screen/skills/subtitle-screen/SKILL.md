---
name: subtitle-screen
description: Use when the user has an audio file (voiceover, dialog recording, or audio inside a video) and wants a karaoke-subtitle screen — each sentence appears whole in grey, then every letter deepens to the main blue perfectly synced with the spoken words. Works standalone (audio → its own Remotion video) or as a scene inside an existing videos/video-N project. Trigger phrases: "subtitle screen", "/subtitle-screen <audio>", "karaoke subtitles from this audio", "subtitles synced with audio".
---

## Step 0 — sync shared learnings (before anything else)

Run this first, every single time this skill is invoked:

```bash
D=~/.claude/office-skills; [ -d "$D/.git" ] || git clone -q --depth 1 -b learnings --single-branch https://github.com/CodeYogiOrg/skills.git "$D"; bash "$D/scripts/sync.sh" subtitle-screen subtitle-screen
```

It pulls the `skills` repo and prints every learning pushed for this skill
since anyone last ran it. **Obey what it prints.** Where a learning and this file
disagree, the learning wins — it is newer by definition.

If it fails (offline, no repo access), say so in one line and carry on. A sync
problem must never block the work.

To push a learning back so the whole office gets it:
`bash ~/.claude/office-skills/scripts/learn.sh subtitle-screen "the rule"`

---

# Subtitle Screen

Take an audio file → transcribe it with word-level timestamps → render a karaoke screen (Harshit's style, 2026-07-16): each SENTENCE appears whole and at once in grey the moment its audio begins, then every letter deepens to the main blue in sync with the voice. When a page carries a second sentence, it stays hidden until its own audio starts, then pops in whole below the first (which is fully colored by then) and colors in the same way. Pages are sentence-aware; the screen clears between pages.


## First-occurrence tech-term highlight (Harshit's rule, 2026-07-22)

Tech/new-vocabulary words (code, coder, coding, software, AI, vibe coding, …) fill **RED** instead of the normal blue on their **FIRST occurrence in the video's subtitles** — the viewer's eye goes to the new term. Every LATER occurrence of the same word fills the normal blue. Track first occurrences across the ENTIRE video (all subtitle stretches in order), not per line. Implement as a per-word `color` override on the word entries in the data file; the karaoke fill timing is unchanged.

## When to use

- User gives an audio file (mp3/wav/m4a) or a video to extract audio from, and wants on-screen karaoke subtitles synced to it
- A scene in a videos/video-N project should show the voiceover as a karaoke subtitle screen

**Do NOT use when:**
- User wants static captions per scene → `Caption` component in create-video
- User wants subtitles burned as an .srt track → use ffmpeg directly

## How the sync works

The transcript gives every word a real `start`/`end` time in seconds. The `SubtitleScreen` component colors each word's letters one after another inside that exact window — a word finishes deepening to the main blue at the same instant the voice finishes saying it. The color fill never lags or leads the audio.

**Smoothness rules (all are in the component — don't undo them):**
- The whole sentence is visible from its first word in `lightColor` (default `#8F8F8F`, grey); letters DEEPEN to `color` (default `#14306E`, main blue) over ~0.18s each, overlapping — never a hard color pop. `charFade` prop tunes it.
- A later sentence on the same page stays hidden (space reserved, no reflow) until its own audio begins, then fades in whole over ~0.15s below the previous sentence. Text must never reflow, shift, or jump between lines — a sentence appearing must NOT move the sentences already on screen.
- Text is big (72px default) and horizontally centered on screen.
- **Font is finalized: Hind Bold 700** (`@remotion/google-fonts/Hind`, subsets devanagari+latin) — chosen by the user for clarity with mixed Hindi + Hinglish. Don't swap it without asking. Projects using the component need `npm i @remotion/google-fonts`.

## Step-by-step

### 1. Get the audio

**If the user didn't name an audio file, ALWAYS ask which one to use** — list the candidates found in the project (`find . -iname "*.mp3" -o -iname "*.wav" -o -iname "*.m4a" -o -iname "*.mp4"`) as options. If they already told you, use that without re-asking.

Accept mp3/wav/m4a directly. If given a video, extract:

```bash
ffmpeg -y -i input.mp4 -vn -ac 1 -ar 16000 audio.wav
```

Get its duration (needed for composition length):

```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 audio.wav
```

### 2. Transcribe with word-level timestamps

`mlx_whisper` is installed but NOT on PATH — use the full path:

```bash
~/Library/Python/3.9/bin/mlx_whisper audio.wav \
  --model mlx-community/whisper-large-v3-turbo \
  --word-timestamps True \
  --output-format json --output-dir <scratch-dir> \
  --language hi
```

Output JSON: `segments[].words[]` of `{word, start, end}` (seconds; `word` has a leading space — trim it). For non-Hindi audio change `--language`, or drop it for auto-detect.

### 3. Ask the user: where does the on-screen TEXT come from?

**ALWAYS ask this — never assume.** One AskUserQuestion with options:

- **Matching script file** (recommended when one exists, name it — e.g. `scripts/Video-1-Script.md`) — on-screen words written exactly as the dialog is written there. The scripts use romanized Hinglish with English brand names as-is ("Bachho, is course mein hum software banana seekhenge!", "WhatsApp", "google.com").
- **Whisper transcript as-is** — whatever the model heard (usually Devanagari)
- **Mixed** — Hindi in Devanagari, English/brands in Roman (fix Whisper's वाट्साप → WhatsApp)
- **User provides the text** — they paste/point to the exact text

Whichever is chosen, Whisper remains ground truth for TIMING only.

### 4. Correct the transcript (text only — NEVER touch timestamps)

Whisper mis-hears words (e.g. "अलग-अप्स" for "alag apps"). If the audio matches a script file (`scripts/Video-N-Script.md`), align each word's TEXT against the script — the script is ground truth for spelling, Whisper is ground truth for timing. Apply the chosen text style from step 3 in the same pass. Keep `start`/`end` values untouched. Word count may differ slightly from the script (fillers, restarts) — keep Whisper's word list as the skeleton and only fix spellings/script.

**Ending punctuation (Harshit's rule, 2026-07-16): the subtitle text NEVER ends with a comma.** Sentence-final ending → close with purnaviram (।). Mid-sentence cut (e.g. the text fades out on a bridge word) → strip the trailing comma, no punctuation. Mid-text commas are fine.

Show the corrected transcript to the user for a quick OK before generating files.

### 5. Generate the data file and copy assets

Copy audio into the project: `public/audio/<name>.wav` (or .mp3).

Write `src/data/subtitle-<name>.ts`:

```ts
import type { SubtitleWord } from "../components/SubtitleScreen";

export const SUBTITLE_WORDS: SubtitleWord[] = [
  { word: "बच्चों,", start: 0.0, end: 0.52 },
  { word: "इस", start: 0.52, end: 0.78 },
  // ... one entry per word, trimmed text, seconds rounded to 3 decimals
];
```

Copy `<this-skill-dir>/template/SubtitleScreen.tsx` into `src/components/` (don't overwrite if the user edited it).

### 6a. As a scene in an existing videos/video-N (only if the user asks for it)

Scene duration = `Math.ceil((lastWord.end + 0.8) * fps)`. The scene follows the create-video pattern (SceneInOut wrapper, background lives in Video.tsx):

```tsx
import React from "react";
import { SceneInOut } from "../components/SceneInOut";
import { SubtitleScreen } from "../components/SubtitleScreen";
import { SUBTITLE_WORDS } from "../data/subtitle-intro";

export const SceneNN: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => (
  <SceneInOut durationInFrames={durationInFrames}>
    <SubtitleScreen words={SUBTITLE_WORDS} audioFile="audio/intro.wav" />
  </SceneInOut>
);
```

If the audio file is the full video's voiceover and this scene starts mid-file, pass `audioOffsetSec={<seconds>}` — word times stay as transcribed; the component aligns both.

**Other visuals in the scene follow the same clock.** Anything keyed to a spoken word (a logo when "WhatsApp" is said, a device when "computer" is said) mounts in a `<Sequence from={Math.round(word.start * fps)}>` using the same transcript. Non-keyed visuals adjust before the first word / after the last word — see "Audio-driven timing" in the `create-video` skill.

### 6b. Standalone project (DEFAULT — the user wants subtitle videos separate)

Scaffold (`npx create-video@latest --yes --blank --no-tailwind subtitle-<name>`; the blank template has no `tsc` — run `npm i -D typescript`). Install the subtitle font: `npm i @remotion/google-fonts`. Copy `PaperBackground.tsx` from the `create-video` SKILL's template (`~/.claude/skills/create-video/template/`, not the `create-video@latest` CLI above) plus `SubtitleScreen.tsx`, copy the audio to `public/audio/`, register one composition:

```tsx
const END_HOLD_SEC = 2; // finished text stays on screen after the voice ends
export const DURATION_IN_FRAMES = Math.ceil((AUDIO_DURATION_SEC + END_HOLD_SEC) * FPS);

const Main: React.FC = () => (
  <AbsoluteFill>
    <PaperBackground />
    <SubtitleScreen words={SUBTITLE_WORDS} audioFile="audio/<name>.mp3" />
  </AbsoluteFill>
);
// 30fps, 1080×1920
```

Two invariants of the output video:
- **The audio is IN the video** — always pass `audioFile` so the voiceover renders into the MP4.
- **The final text stays on screen** — the component never clears the last page, and `END_HOLD_SEC` (~2s) keeps it visible after the voice ends. Never let the video cut off the moment the last word types.

Working example to crib from: `tools/subtitle-video/`.

### 7. Verify before handing over

```bash
npx tsc --noEmit
```

Then render 2–3 stills at frames that land MID-WORD (pick a word from the data, frame = round(((start+end)/2) * fps)) and **Read the PNGs** to confirm: the color fill is mid-word (letters part grey, part main blue), no broken half-glyphs, page layout correct.

```bash
npx remotion still src/index.ts <CompId> /tmp/still.png --frame=<n>
```

Then studio/render as usual (`npx remotion studio --no-open`, `npx remotion render`).

## Component reference

`<SubtitleScreen>` props:

| Prop | Default | Meaning |
|---|---|---|
| `words` | required | `{word, start, end}[]` — seconds from audio start |
| `audioFile` | none | path under `public/`, mounts `<Audio>` in-sync |
| `audioOffsetSec` | `0` | seconds into the audio where this scene begins |
| `maxCharsPerPage` | `140` | accumulated chars before the screen clears |
| `fontSize` | `72` | text size (Hind Bold 700, center-aligned — don't change either) |
| `charFade` | `0.18` | seconds each letter takes to deepen light→main blue — smoothness knob |
| `color` | `#14306E` | sung/filled text color — finalized main blue |
| `lightColor` | `#8F8F8F` | unsung text color — the whole sentence shows in this first |

Pagination is automatic and sentence-whole: sentences (split at `। . ? !`) are grouped onto a page until ~140 chars, so a page is typically 1–2 full sentences. Each page appears when its first word starts; a page's later sentence appears when ITS first word starts.

## Common mistakes

- **Running `mlx_whisper` bare.** It's not on PATH → `~/Library/Python/3.9/bin/mlx_whisper`. (`whisper-cli` from homebrew exists as a fallback but outputs a different JSON shape.)
- **"Fixing" timestamps during transcript correction.** Only word TEXT gets corrected; `start`/`end` are ground truth from the audio.
- **Slicing words by code units.** Devanagari matras break mid-glyph. The component already splits by grapheme (`Intl.Segmenter`) — don't replace it with `substring`.
- **Forgetting the leading space in Whisper's `word` field.** Trim when generating the data file (the component also trims defensively).
- **Composition shorter than the audio.** duration = `ceil((audioDurationSec + END_HOLD_SEC) * fps)`, never the script's estimated length.
- **Ending the video the moment the color fill finishes.** The finished text must hold on screen ~2s (`END_HOLD_SEC`) before the video ends.
- **Skipping the mid-word still check.** A sync bug looks fine in a static "all text shown" frame; only a mid-word still (part grey, part main blue) proves the color fill tracks the voice.
- **Adding a blinking cursor.** The user explicitly wants none.
- **Hard color pops or layout reflow.** Letters must deepen gradually (`charFade`), and a page's later sentences must have their space reserved up front so nothing jumps when they appear. If the fill looks jittery, someone broke one of these.
- **Letter-by-letter typing (old style).** Superseded 2026-07-16: text never types in — the full sentence is on screen in grey from its first spoken word; only the COLOR moves with the audio.
- **Assuming the text source.** Always ask (script file / transcript as-is / mixed / user-provided), even when a matching script obviously exists.
