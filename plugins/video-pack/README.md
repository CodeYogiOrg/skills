# video-pack

Three skills in one install — the whole path from a script to a finished video,
and from a finished video to the same video in another language.

**Install**

```bash
claude plugin marketplace add CodeYogiOrg/skills   # once per machine
claude plugin install video-pack@codeyogi
```

Restart Claude Code once, then `claude plugin list` to confirm.

**What's inside**

| Skill | Invoke with | What it does |
|---|---|---|
| `create-video` | `/create-video <script.md>` | Script → Remotion video, one dialog line at a time. Asks whether there's a character, whether it lip-syncs, where the voice comes from. |
| `elevenlabs-audio` | `/elevenlabs-audio <script>` | Whole script → per-line mp3s + stitched sections, one section, or a single re-take. |
| `translate-video` | `/translate-video <video-folder> --to en` | An existing video in another language: extract the script, translate it, creator approves, sample for voice sign-off, full audio, re-derived timings, render. |

**Needs** — Node 20+, and your own key for the voice:

```bash
export ELEVENLABS_API_KEY=...
```

No plugin ships a key. Each skill's folder has a `.env.example` naming the
variable and nothing else.

**Who can install it** — CodeYogi only. The repo is private to the
`CodeYogiOrg` org, so `marketplace add` fails for anyone outside it.

**Learnings** — each skill pulls `learnings/<skill>.md` from the repo's
`learnings` branch before it does anything, so an office rule reaches you
without a reinstall. A skill proposes a learning and **asks before pushing it**,
because it becomes a rule on everyone's machine.

See the [repo README](../../README.md) for how the catalog fits together.
