# elevenlabs-audio

ElevenLabs voiceover: a whole script into per-line mp3s plus stitched sections, one section, or a single re-take of a flubbed line.

**Install**

```bash
claude plugin marketplace add CodeYogiOrg/office-skills   # once per machine
claude plugin install elevenlabs-audio@codeyogi
```

**Invoke** — `/elevenlabs-audio <script>  ·  "generate the voiceover"`

**What it's for** — Standalone TTS, or as the voice provider for create-video.

**Needs** — Your own ELEVENLABS_API_KEY exported in your shell. The plugin ships no key.

**Learnings** — the skill syncs `learnings/elevenlabs-audio.md` from the repo before it
does anything, so office rules reach you without a reinstall. Push one with:

```bash
bash ~/.claude/office-skills/scripts/learn.sh elevenlabs-audio "the rule"
```

See the [repo README](../../README.md) for how the whole catalog fits together.
