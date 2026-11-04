# create-video

Script to Remotion video, built interactively one dialog line at a time. Asks first whether there is a character, whether it lip-syncs and where the voice comes from — nothing is assumed.

**Install**

```bash
claude plugin marketplace add CodeYogiOrg/office-skills   # once per machine
claude plugin install create-video@codeyogi
```

**Invoke** — `/create-video <script.md>  ·  "make a video from this script"`

**What it's for** — Any narration or dialog script you want as a rendered MP4.

**Needs** — Node 20+. Optional add-ons: elevenlabs-audio (voice), hedra-gulla-video (lip-sync).

**Learnings** — the skill syncs `learnings/create-video.md` from the repo before it
does anything, so office rules reach you without a reinstall. Push one with:

```bash
bash ~/.claude/office-skills/scripts/learn.sh create-video "the rule"
```

See the [repo README](../../README.md) for how the whole catalog fits together.
