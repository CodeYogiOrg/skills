# hedra-gulla-video

Green-screen talking-character clips from line audio via Hedra, ready for a chroma-key pipeline.

**Install**

```bash
claude plugin marketplace add CodeYogiOrg/skills   # once per machine
claude plugin install hedra-gulla-video@codeyogi
```

**Invoke** — `"make Gulla's video"  ·  "generate the character speaking"`

**What it's for** — Lip-sync for a character. One route among four — supplied recordings always win over generation.

**Needs** — Your own HEDRA_API_KEY exported in your shell. The plugin ships no key.

**Learnings** — the skill syncs `learnings/hedra-gulla-video.md` from the repo before it
does anything, so office rules reach you without a reinstall. Push one with:

```bash
bash ~/.claude/office-skills/scripts/learn.sh hedra-gulla-video "the rule"
```

See the [repo README](../../README.md) for how the whole catalog fits together.
