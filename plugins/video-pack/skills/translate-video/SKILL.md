---
name: translate-video
description: Use when an existing finished video must ship in another language — extracts the script from the existing project (or transcribes the MP4 when no script file exists), translates it to the target language, gets the creator's line-by-line approval BEFORE spending any API credit, renders one short sample for voice sign-off, then generates the full audio, re-derives every timing for the new narration, and renders the video. Language is added as a composition PROP to the SAME project (`--lang <code>` + `src/lang.tsx`), never as a forked folder. Trigger phrases: "make this video in English", "translate this video", "दूसरी भाषा में बनाओ", "/translate-video <video-folder> --to en".
---

## Step 0 — sync shared learnings (before anything else)

Run this first, every single time this skill is invoked:

```bash
D=~/.claude/office-skills; [ -d "$D/.git" ] || git clone -q --depth 1 -b learnings --single-branch https://github.com/CodeYogiOrg/skills.git "$D"; bash "$D/scripts/sync.sh" translate-video video-pack
```

It pulls the `learnings` branch and prints every learning pushed for this skill
since anyone last ran it. **Obey what it prints.** Where a learning and this file
disagree, the learning wins — it is newer by definition.

If it fails (offline, no repo access), say so in one line and carry on. A sync
problem must never block the work.

To push a learning back so the whole office gets it, see
**Pushing a learning** at the bottom of this file. **Never push one without
showing the exact wording and getting a yes first.**

---

# Translate Video

Take a video that already exists and ship it in another language, without
forking the project.

## The one rule everything else follows

**Language is a prop, not a fork.** The translated video is a second
composition in the SAME project, selected by a `lang` prop, reading that
language's own audio and its own timing data. There is never a
`video-5-english/` folder.

This is settled (Harshit, 2026-10-15, on `video-ai-works`): *"both compositions
run the same scenes, the same robot and the same camera moves, and differ only
in the three things that are actually language-bound — which narration plays,
which word map drives the mouth and the on-screen questions, and what the
labels say. A second copy of the folder would have meant every later fix landing
twice, which is exactly how two versions drift apart."*

`videos/video-ai-works/src/lang.tsx` is the reference implementation. Read it
before writing a new one.

## What is language-bound, and what is not

Only four things change between languages. Everything else is shared.

| Changes per language | Stays shared |
|---|---|
| which narration audio plays | the scenes, the layout, the components |
| the word map that drives lip-sync, karaoke and word anchors | the camera-move *technique* |
| the on-screen label text | brand logos, photos, SFX, music bed choice |
| **every frame number derived from the narration** | the visual design, colours, fonts (except the face) |

**The frame numbers are the trap.** Two narrations are never the same length —
on `video-ai-works`, line 18 runs 7.7s in English against 10.9s in Hindi. Every
scene duration, every `PopIn at=`, every camera cue and every audio mount must
be re-derived from the TARGET language's own word map. Copying the base
language's frames and nudging them produces a video that drifts further out of
sync the longer it runs.

## Workflow — gates before spend

Two hard gates. Nothing paid happens before the creator has approved words, and
nothing full-length happens before they have approved a voice.

```
1. Extract      →  the source script, verbatim
2. Translate    →  target language, mixed-script rules applied
3. ◆ GATE 1     →  creator approves the translation, section by section
4. Sample       →  ~1 section of audio + a rendered clip
5. ◆ GATE 2     →  creator approves the voice and the sample
6. Full audio   →  one request, whole script, with timestamps
7. Re-derive    →  timings, word map, cues — from the NEW audio
8. Wire lang    →  lang.tsx + a second Composition
9. Render       →  only on confirmation
```

---

## Step-by-step

### 1. Extract the source script

Find the source of truth, in this order. **Never transcribe when a script file
exists** — the script has the author's exact wording, the transcript has
whisper's guess at it.

1. **The project's own script** — `scripts/<name>/script.md`,
   `scripts/Video-N-Script.md`, or a `script.md` in the video folder. Use it.
2. **No script file, only an MP4** — transcribe it:

```bash
node ../scripts/transcribe.mjs out/<Video>.mp4 --var SRC_WORDS --out /tmp/src-words.ts
```

   Then reconstruct the script in the standard format below and **show it to the
   creator as a reconstruction, not as their script.** Whisper mis-hears brand
   names and drops punctuation; the creator must fix it before it is translated.

The standard format, which both `create-video` and `elevenlabs-audio` parse:

```
## Section N
<!-- visual cue as an HTML comment, optional -->
**Teacher:** dialog text
**Gulla:** dialog text
```

Keep the section numbering and the line breaks identical to the source. The
translated script must have **the same number of sections and the same number of
lines, in the same order** — the whole pipeline aligns the two by index.

### 2. Translate

Ask the target language if it was not given. Then translate line by line, and
obey the script-style rules of the target language:

- **Into Hindi** — mixed Devanagari: Hindi words in Devanagari, English/brand/tech
  words left in Roman (`software`, `phone`, `WhatsApp`, `battery`). Romanized
  Hinglish gives worse TTS pronunciation. No trailing comma — a line ends in a
  purnaviram (।).
- **Into English** — plain English. Drop a subtitle that only repeats the title;
  on `video-ai-works` the Hindi title card carries its English line as a
  subtitle, and in English that would say the same thing twice.
- **Any language** — keep brand names, UI strings and product words exactly as
  they appear on screen. A Lovable button really does read `Use code`, in every
  language.

**Translate the meaning, not the words.** These scripts are teaching scripts
built on analogies. An analogy that lands in Hindi because it is about an
auto-wala may land nowhere in English. When an analogy does not travel, say so
at Gate 1 and propose a replacement rather than translating it literally.

**Keep the delivery tags.** `[curious]`, `[warm]`, `[excited]` are v3 delivery
tags, not spoken words. They carry across unchanged.

Write it to `scripts/<name>/script-<code>.md` (e.g. `script-en.md`), beside the
original. Never overwrite the source script.

### 3. ◆ GATE 1 — the creator verifies the translation

**Nothing is generated until this passes.** Audio costs money and a translation
error found after the audio exists means re-billing the whole script.

Present it **section by section, source line above translated line**, and ask
per section — not per line (too slow for a 40-line script) and not for the whole
script at once (too coarse to correct). For each section:

```
## Section 3

Teacher (hi):  अब देखो, यह website कैसे बनती है।
Teacher (en):  Now watch how this website gets built.

Gulla (hi):    [curious] अच्छा, तो code likhna padega?
Gulla (en):    [curious] So we'll have to write code?
```

Then one `AskUserQuestion`: approve this section / fix a line (free text) /
flag an analogy that does not travel.

Carry the creator's corrections into `script-<code>.md` immediately, and show
the corrected section back. **A correction to wording is also a learning if the
creator states it as a rule** ("never translate Gulla's `अच्छा` as `okay`") — see
Pushing a learning.

Record who approved and when, as a comment at the top of `script-<code>.md`.
That file is now the source of truth for this language.

### 4. Sample — one section, audio and picture

Generate **one section only** — pick the one with the most dialog, not the
opening, because the opening is usually short and atypical. Use the
`elevenlabs-audio` skill:

```bash
node .../elevenlabs-audio/scripts/gen-dialog-audio.mjs \
  --script scripts/<name>/script-<code>.md --sections 3 --estimate   # cost first
node .../elevenlabs-audio/scripts/gen-dialog-audio.mjs \
  --script scripts/<name>/script-<code>.md --sections 3 --out audios-<code>
```

Then render just those scenes so the creator sees picture and voice together —
a voice that is fine in isolation can still be wrong over the visuals.

**Voices: the same character, speaking another language.** `eleven_multilingual_v2`
carries the voices in `voices.json` across languages, so Teacher stays Teacher
and Gulla stays Gulla. Do NOT cast a new voice per language — a listener who
recognises the voice is the point (settled for `elevenlabs-audio`, 2026-10-16).
Only propose a new voice if the creator says the existing one does not work in
the target language, and then it is their pick, not yours.

### 5. ◆ GATE 2 — the creator approves the voice

Hand over the sample clip and ask: approve / re-take with notes / change the
voice. **Do not generate the full audio before this.** A rejected voice after a
full run has already billed the whole script.

### 6. Full audio — one request, whole script

One generation is one performance, so the accent cannot wander between lines
(settled for `elevenlabs-audio`, 2026-10-15). `--estimate` first, always, and
report the character count against the remaining budget before spending it.

```bash
node .../elevenlabs-audio/scripts/gen-dialog-audio.mjs \
  --script scripts/<name>/script-<code>.md --out audios-<code> --estimate
# then, on confirmation:
node .../elevenlabs-audio/scripts/gen-dialog-audio.mjs \
  --script scripts/<name>/script-<code>.md --out audios-<code>
```

Cut it back into per-line files **with `/with-timestamps`, never with silence
detection** — the model silently drops some `<break>` tags and every cut after
the first miss is off by a whole line.

Per-language artefacts, so regenerating one language never touches the other:

```
audios-<code>/                 generated audio for this language
public/audio/<code>/lines/     what the composition plays
src/data/*-<code>.ts           timeline, word times, lip-sync for this language
```

The base language keeps its unsuffixed paths. A new language is purely additive.

If a term comes out mispronounced, fix it in a **pronunciation map applied to
the TTS text only** (`audios-<code>/pronunciation.json`) — never by editing the
approved script. One word in, one word out: word-level timing is recovered by
laying the script's words across the audio, so changing the word count desyncs
every caption and cue on that line.

### 7. Re-derive every timing from the new audio

**This is the step that is tempting to skip and must never be skipped.** Run the
project's own build scripts with the language flag — the convention is
`--lang <code>`, parsed as:

```js
const LANG = process.argv.includes('--lang')
  ? process.argv[process.argv.indexOf('--lang') + 1] : '<base>';
```

```bash
node scripts/build-timeline.mjs   --lang <code>   # scene durations, total frames
node scripts/build-wordtimes.mjs  --lang <code>   # word map for karaoke + anchors
node scripts/build-lipsync.mjs    --lang <code>   # mouth envelope, if a character speaks
node scripts/build-music-bed.mjs  --lang <code>   # music bed re-cut to the new length
```

If the project has no such scripts (it was built before this pattern), generate
them from the base-language equivalents — same logic, language-suffixed output
paths — and say that you added them.

**Camera and visual cues must be re-read off the new word map.** They are pinned
to spoken words, and the two narrations do not run at the same speed. Re-derive
each one and keep the comment that names its anchor word:

```ts
cues: {
  threeEmojis: [16, 115],  // "three emojis" @42-55 · "effect" @129
}
```

The arithmetic that produced them stays the same (on `video-ai-works`:
`zoomAt` = the naming word minus the camera's 26-frame travel, so it ARRIVES on
the word; `swapAt` = the result word minus 14, the second ring's delay). Re-run
the arithmetic against the new frames; never scale the old numbers.

### 8. Wire the language into the project

Add the language to `src/lang.tsx` — or create it, modelled on
`videos/video-ai-works/src/lang.tsx`:

```tsx
export type Lang = "hi" | "en";              // add the new code

const STRINGS: Record<Lang, Strings> = {
  hi: { font: HINDI, /* labels */ },
  en: { font: DISPLAY, /* labels */ },       // DISPLAY: Latin reads better in the display face
};

export const LANGS: Record<Lang, LangData> = {
  en: {
    lang: "en",
    timeline: TIMELINE_EN,
    totalFrames: TOTAL_FRAMES_EN,
    words: WORDS_EN,
    envelope: ENVELOPE_EN,
    peak: PEAK_EN,
    audioDir: "audio/en/lines",
    musicBed: "audio/music-bed-en.mp3",
    s: STRINGS.en,
  },
};

const LangCtx = createContext<LangData>(LANGS.<base>);
export const LangProvider: React.FC<{ lang: Lang; children: React.ReactNode }> =
  ({ lang, children }) => <LangCtx.Provider value={LANGS[lang]}>{children}</LangCtx.Provider>;
export const useLang = (): LangData => useContext(LangCtx);
export const useS = (): Strings => useContext(LangCtx).s;   // labels-only shorthand
```

`Video.tsx` takes `lang` as a prop and wraps everything in the provider, so
every hook below sees the chosen language:

```tsx
export const Video: React.FC<{ lang?: Lang }> = ({ lang = "<base>" }) => (
  <LangProvider lang={lang}>{/* … */}</LangProvider>
);
```

`Root.tsx` registers **one composition per language, each with its own
`durationInFrames`** — the narrations are not the same length:

```tsx
<Composition id="Video5"   component={Video} defaultProps={{ lang: "hi" as const }}
  durationInFrames={LANGS.hi.totalFrames} fps={FPS} width={1080} height={1920} />
<Composition id="Video5EN" component={Video} defaultProps={{ lang: "en" as const }}
  durationInFrames={LANGS.en.totalFrames} fps={FPS} width={1080} height={1920} />
```

Naming: base composition keeps its id, the translation appends the uppercased
code (`Video5` → `Video5EN`).

Then replace every hardcoded label in the components with `useS()`, and every
hardcoded narration path or frame with `useLang()`. **Type-check before
rendering** — a missing key in `STRINGS` is a compile error, which is exactly
why `Strings` is a type and not a loose object.

### 9. Render, only when the creator confirms

Render the new composition. Check the existing MP4 dates first and never
overwrite a render:

```bash
node scripts/render.mjs --composition Video5EN --out out/Video5-EN.mp4
```

Then hand it over and ask for a watch-through. The failure this catches is
timing drift in the back half, which no amount of type-checking finds.

---

## Common mistakes

- **Forking the folder.** `video-5-english/` is the one thing this skill exists
  to prevent. Every later fix would have to land twice.
- **Reusing the base language's frame numbers.** They are wrong by construction.
  Re-derive from the new word map.
- **Generating the full audio before Gate 1.** A wording fix after the audio
  exists re-bills the whole script.
- **Casting a new voice per language.** Same character, same voice, another
  language. `eleven_multilingual_v2` handles it.
- **Transcribing when a script file exists.** The script has the author's words;
  the transcript has whisper's guess.
- **Translating an analogy literally.** If it does not travel, replace it — and
  get that approved at Gate 1.
- **Editing the approved script to fix a pronunciation.** Use the pronunciation
  map, which applies to the TTS text only.
- **Cutting per-line audio by silence detection.** Use `/with-timestamps`.
- **Overwriting the base language's data files.** Every artefact is suffixed.

## Pushing a learning — only after the creator confirms

When the creator states a norm while this skill is running ("Gulla's questions
always stay questions in English, never statements"), it should reach everyone's
next run. It does not go in silently.

**Show the exact line you intend to push and ask for a yes.** It becomes a rule
for the whole office on every machine, so the creator approves the wording, not
just the idea:

> I'd push this learning to `translate-video`, which every teammate's next run
> will obey:
> *"Gulla's questions stay questions in the target language — a question
> translated into a statement loses the beat the Teacher answers."*
> Push it?

On a yes:

```bash
bash ~/.claude/office-skills/scripts/learn.sh translate-video "the rule"
```

It lands on the unprotected `learnings` branch, so it is live for everyone's
next run — no reinstall, no restart. A rule that changes how the skill *works*
(not just what it must obey) is a SKILL.md edit and a version bump on `main`,
which is PR-protected: open a PR, don't try to push it.

## Reference implementation

`videos/video-ai-works/` in the AI Builder Course repo is the project this
pattern was settled on — `src/lang.tsx`, `src/Root.tsx` (two compositions),
`scripts/*.mjs --lang en`, `src/data/*-en.ts`. Read it before writing a new one.
