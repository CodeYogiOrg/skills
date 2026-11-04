---
name: elevenlabs-audio
description: Use when the user wants voiceover/dialog audio generated with ElevenLabs — a whole AI Builder Course script (Teacher/Gulla lines → per-line mp3s + stitched section files), one section of it, a re-take of a single flubbed line, or a one-off TTS of arbitrary text. Trigger phrases: "generate the audio", "make the voiceover", "TTS this script/line", "/elevenlabs-audio <script>". Invoked BY ai-builder-video (its preset provider), or by the generic create-video only when that video's profile named elevenlabs. Needs the user's own ELEVENLABS_API_KEY in the environment.
---

## Step 0 — sync shared learnings (before anything else)

Run this first, every single time this skill is invoked:

```bash
D=~/.claude/office-skills; [ -d "$D/.git" ] || git clone -q --depth 1 -b learnings --single-branch https://github.com/CodeYogiOrg/skills.git "$D"; bash "$D/scripts/sync.sh" elevenlabs-audio elevenlabs-audio
```

It pulls the `office-skills` repo and prints every learning pushed for this skill
since anyone last ran it. **Obey what it prints.** Where a learning and this file
disagree, the learning wins — it is newer by definition.

If it fails (offline, no repo access), say so in one line and carry on. A sync
problem must never block the work.

To push a learning back so the whole office gets it:
`bash ~/.claude/office-skills/scripts/learn.sh elevenlabs-audio "the rule"`

---

> **One provider among several, never a default.** `ai-builder-video` uses this as its preset provider.
> The generic `create-video` calls it only when step 0's profile named `elevenlabs`. It holds no key:
> export `ELEVENLABS_API_KEY` in your own shell and the script reads it from there.
> The skill directory has a `.env.example` naming the variable and nothing else —
> if a real `.env` ever appears in here, it is a mistake, delete it.


# ElevenLabs Audio

Generate the course's dialog audio from a script file with ONE command. Voices are fixed characters (picked by Harshit in ElevenLabs, stored in `voices.json`); the API key lives in the project `.env` — never in this skill, never committed.

## Config (already set up — don't re-ask)

- `voices.json` (this skill dir): `teacher` = Ranbir (`SGbOfpm28edC83pZ9iGb`), `gulla` = Adik M (`Y921BUrS17GL37pctIb8`), plus the locked `model`. Change voices ONLY when Harshit says so.
- `ELEVENLABS_API_KEY`: the script checks the env var, then walks up from cwd looking for a `.env`, then falls back to the `.env` in this skill's own folder — so the skill works from any repo without a local key.
- Account is **pay-as-you-go with a monthly character budget** — see Cost rules below.

## Whole-video audio: ONE-FLOW dialogue mode is the standard (Harshit's rule, 2026-07-22)

Generate a full script's audio as **ONE ElevenLabs v3 text-to-dialogue call** (`--dialogue`): all lines from both characters go in one request, so the voices react to each other and the delivery flows like a real conversation — no per-line stitch feel. Output: `audios/dialogue-full.mp3`. Then split it into `section-N.mp3` files at the speaker-turn silence midpoints (whisper-word boundaries; record the cut points in `audios/sections.json`) and cut the Gulla sections out as `gulla-audio/sN-gulla.mp3` takes — same take in section audio and clips, as always.

Caveats: dialogue mode has NO per-line cache — every run bills the full character count (estimate + confirm first). A flubbed line therefore means regenerating the WHOLE dialogue (same flow) or accepting a per-line patch that may sound slightly out of flow — ask Harshit which. Per-line mode remains for single-line retakes and one-offs.

## Commands

Everything is `scripts/gen-dialog-audio.mjs` (run from anywhere inside the project):

```bash
# whole script as ONE flowing v3 dialogue (STANDARD for full videos) → audios/dialogue-full.mp3
node .claude/skills/elevenlabs-audio/scripts/gen-dialog-audio.mjs \
  --script scripts/<name>/script.md --dialogue        # --estimate works here too

# whole script per-line (cache-friendly; retakes/one-offs) → audios/lines/*.mp3 + audios/section-N.mp3 + line-timings.json
node .claude/skills/elevenlabs-audio/scripts/gen-dialog-audio.mjs \
  --script scripts/<name>/script.md            # out defaults to <script-dir>/audios

# cost preview — NO API calls, prints sections/lines/characters
... --script <file> --estimate

# only some sections · re-take everything · different pause between lines
... --sections 2,4    · --force    · --pause 0.8

# one-off text (standalone use)
... --text "नमस्ते बच्चों!" --speaker teacher --out hello.mp3
```

## Script text: Devanagari + v3 delivery tags (Harshit's rule, 2026-07-20)

Before generating, the dialog must be authored in the **mixed Devanagari style**: Hindi words in Devanagari, English/brand/tech words in Roman (`software`, `phone`, `WhatsApp`, `battery`). Romanized Hinglish ("samajh aa gaya") gives worse pronunciation — convert it to Devanagari first ("समझ आ गया"). Add **ElevenLabs v3 inline delivery tags** at the start of a line (or mid-line) to control emotion — `[curious]`, `[warm]`, `[excited]`, `[thoughtful]`, etc. v3 interprets them as delivery, not spoken words (verified — they don't leak into the audio or the transcript). Match the character: Gulla curious/excited, Teacher warm/clear.

## A wandering accent is a per-line-request problem (Harshit's rule, 2026-10-15)

*"The audio throughout is fucked up — I need a consistent Indian English.
Currently multiple accents are happening throughout."* When the voice drifts
across a video, do NOT start auditioning replacement voices. A generative TTS
re-interprets the speaker on every fresh request, so N per-line requests give
N slightly different readings of the same clone; over a two-minute video that
reads as the accent wandering. `stability: 1.0` damps it and cannot remove
it, and eleven_v3 refuses `previous_text`/`next_text`, so there is no
continuity to hand it.

Generate the whole script in **ONE request** on `eleven_multilingual_v2`. One
generation is one performance, so the accent cannot shift between lines.

**Cut it back into per-line files with `/with-timestamps`, never with silence
detection.** The timestamps endpoint returns a start and end time for every
CHARACTER; walk the script through that alignment and the line boundaries are
exact by construction. Silence detection on `<break>` tags looks equivalent
and is not: the model silently drops some breaks (18 of 20 in the AI-works
English take), and every cut after the first miss is off by a whole line —
a four-word sentence came out 5.3 seconds long. The same alignment walk also
gives real per-word times, which beat any RMS-envelope estimate for driving
lip-sync, karaoke and word-anchored camera cues.

Keep the per-line path for retakes of a single flubbed line, and remember a
one-take regeneration re-bills the whole script.

## Mispronounced terms: Devanagari in the TTS text, Roman everywhere else (Harshit's rule, 2026-10-15)

The rule above — English/brand/tech words stay Roman — is about the SCRIPT. It
does not survive contact with a term the model reads wrong. *"There are
pronunciation corrections like calculate/calculating etc — these terms, use
their Hindi written Devanagari for audio creation."* Roman English inside a
Devanagari sentence triggers an English reflex, which is where slurring and
wrong word endings come from; spelling the term the way a Hindi speaker says
it forces the right sounds (`calculate` → `कैलकुलेट`, `workspace` → `वर्कस्पेस`).

Do it as a **pronunciation map applied to the TTS text only** — e.g.
`audios/pronunciation.json`, read by the generator — never by editing the
script. The script, the subtitles and the on-screen words keep the Roman
spelling, because on-screen wording follows the voice and a UI button really
does read `Use code`. Two hard constraints:

- **One word in, one word out.** Word-level timing is recovered by laying the
  SCRIPT's words across the audio; change the word count and every caption and
  camera cue on that line desyncs.
- **Log the leftovers.** After mapping, scan the spoken text for any Roman
  token still standing and print it, so the next term that needs fixing is
  named instead of discovered in a listen-back.

Reach for this before reaching for a new voice. A character voice does slur
more than a conversational one, but if the complaint names specific words, it
is the spelling, not the casting.

## Workflow

1. **Estimate first, generate after the user confirms.** Run `--estimate`, report `N calls, ~X characters` against the remaining budget (`GET /v1/user/subscription`). Skip the confirmation only for tiny runs (<300 chars) the user just asked for.
2. Generate. Lines are cached by content hash (`lines/manifest.json`) — re-running after a script edit only re-bills the CHANGED lines. Never `--force` unless the user wants fresh takes of everything.
3. **Listen-verify**: play (or hand the user) each new line file — TTS occasionally mispronounces a word or rushes a sentence. A flubbed line = edit nothing, just tweak that line's text in the script (or add a comma/purnaviram for pacing) and re-run — only that line regenerates.
4. Outputs, per the v27 pipeline:
   - `audios/section-N.mp3` — stitched section audio (lines + 0.6s pauses), drop-in replacement for recorded sections; the video pipeline (transcribe → anchors) treats it EXACTLY like a recording.
   - `audios/line-timings.json` — exact start/end of every line inside its section. **Use this for line boundaries in video planning — no silence-midpoint hunting.** (Whisper is still needed for WORD-level anchors.)
   - `gulla-audio/s*-gulla.mp3` — Gulla's takes, copied out for Harshit to make the green-screen clips from, so clip audio and section audio are the IDENTICAL take (his rule, 2026-07-20: one audio, used in both places). The clip pipeline (create-video step 5d) is unchanged.

## Script format it parses

`## Section N` headings; `**Teacher:** …` / `**Gulla:** …` dialog lines (continuation paragraphs attach to the previous line); `<!-- visual cues -->` stripped. Same format the create-video skill reads.

## Cost rules

- ALWAYS `--estimate` before a run that isn't tiny; tell the user the character count and remaining monthly budget before spending it.
- The cache means iterating on a script is cheap — never regenerate a whole section to fix one line.
- Model is locked in `voices.json` after Harshit's A/B listen test (`tools/tts-samples/` comparison, 2026-07-20). Don't switch models per-run; `--model` exists for future A/B tests he asks for.

## Common mistakes

- **Generating without an estimate/confirmation.** Whole scripts are thousands of characters against a small monthly budget.
- **Skipping the listen-verify.** A mispronounced brand name discovered after the video is built means redoing transcription + anchors for that section.
- **Fixing a flubbed line by regenerating the section.** The cache is per-line — change that line's text (or `--force` after deleting just that file's manifest entry) and re-run.
- **Editing the stitched section-N.mp3.** Never — regenerate from lines. Files are otherwise never edited (v27 rule); alignment is done in Remotion mounts.
- **Making green-screen Gulla clips from a different take.** Clips must be made from `gulla-audio/` files — same take as the section audio, or lips and section sound won't match.
- **Putting the API key anywhere except `.env`.** Not in voices.json, not in scripts, not in chat logs committed to git.
