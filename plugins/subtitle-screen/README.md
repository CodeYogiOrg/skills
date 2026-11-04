# subtitle-screen

Karaoke subtitle screen from an audio file: each sentence appears whole in grey, then every letter deepens to blue in sync with the voice.

**Install**

```bash
claude plugin marketplace add CodeYogiOrg/office-skills   # once per machine
claude plugin install subtitle-screen@codeyogi
```

**Invoke** — `/subtitle-screen <audio>  ·  "karaoke subtitles from this audio"`

**What it's for** — Standalone, or as a scene inside an existing video project.

**Needs** — An audio file. Transcription runs locally.

**Learnings** — the skill syncs `learnings/subtitle-screen.md` from the repo before it
does anything, so office rules reach you without a reinstall. Push one with:

```bash
bash ~/.claude/office-skills/scripts/learn.sh subtitle-screen "the rule"
```

See the [repo README](../../README.md) for how the whole catalog fits together.
