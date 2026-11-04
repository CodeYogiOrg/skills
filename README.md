# CodeYogi office skills

Shared Claude Code skills for the office — the video pipeline, the course script
writer, and whatever we add next. **One marketplace, one plugin per skill: you
install only what you need.**

Skills also pull shared *learnings* from this repo before they run, so a rule
anyone pushes reaches everybody's next run without a reinstall. See
[How learnings work](#how-learnings-work).

---

## Install

Add the marketplace once per machine:

```bash
claude plugin marketplace add CodeYogiOrg/skills
```

Then install the video pack — three skills, one command, and the place to start:

```bash
claude plugin install video-pack@codeyogi
```

That gives you `create-video` (script → video), `elevenlabs-audio` (voiceover)
and `translate-video` (an existing video in another language). Or take single
skills instead — nothing else is downloaded:

```bash
claude plugin install subtitle-screen@codeyogi
```

Or run `/plugin` inside Claude Code and tick them off a list.

Restart Claude Code once after installing. Check with `claude plugin list`.

**Who can install.** This repo is private to the `CodeYogiOrg` org, and that is
what keeps these skills internal — `marketplace add` fails for anyone outside
it. Org members already hold a paid seat, so giving the whole team read access
costs nothing; adding a non-member costs a seat. A failure reading
"repository not found" means missing read access, not a wrong URL — run
`gh auth login` with the account that is in the org.

---

## The catalog

| Plugin | What it does | Invoke with |
|---|---|---|
| **video-pack** | **Start here.** All three video skills in one install: create-video + elevenlabs-audio + translate-video. | one install, three skills |
| **translate-video** | An existing video in another language. Extracts the script, translates it, creator approves line by line, sample for voice sign-off, then full audio and render. Language is a composition prop, never a forked folder. | `/translate-video <folder> --to en` |
| **create-video** | Script → Remotion video, built one dialog line at a time. Nothing assumed: it asks whether there's a character, whether it lip-syncs, where the voice comes from. | `/create-video <script.md>` |
| **ai-builder-video** | The course pipeline. Same engine, presets baked in — Teacher/Gulla, ElevenLabs, Hedra, v27 standards. | `/ai-builder-video Video-N-Script.md` |
| **elevenlabs-audio** | Voiceover: whole script → per-line mp3s + stitched sections, one section, or a single re-take. | `/elevenlabs-audio <script>` |
| **hedra-gulla-video** | Green-screen talking-character clips from line audio, ready for chroma key. | `"make Gulla's video"` |
| **subtitle-screen** | Karaoke subtitles from an audio file — sentence appears grey, letters deepen to blue in sync. | `/subtitle-screen <audio>` |
| **vids** | One course script → paste-ready Google Vids prompts, segments under 8 seconds. | `/vids` |
| **plan-next-level** | Writes a course script. Outline for approval first, then full Hinglish dialogue. | `/plan_next_level` |
| **language** | Converts a file or selection to another language. | `/language` |

Each plugin has its own README with the detail: `plugins/<name>/README.md`.

### Which do I actually need?

- **Anything to do with video** → `video-pack`. One install, and you have the
  script→video skill, the voiceover skill and the translation skill.
- **Making a video from a script, any script** → `create-video`. Add
  `elevenlabs-audio` if you want it to speak, `hedra-gulla-video` if a character
  needs to lip-sync. Skip both if you're recording the voice yourself.
- **Working on the AI Builder Course** → `ai-builder-video` + `plan-next-level`.
  The presets save you every decision `create-video` would ask about.
- **Just subtitling something** → `subtitle-screen` alone. It's the smallest one.

### Keys

`elevenlabs-audio` and `hedra-gulla-video` call paid APIs. **No plugin ships a
key.** Export your own:

```bash
export ELEVENLABS_API_KEY=...
export HEDRA_API_KEY=...
```

Each ships a `.env.example` naming the variable and nothing else.

### Working directory

`ai-builder-video`, `vids` and `plan-next-level` read course files
(`roadmap.md`, `PROJECT-BRIEF.md`, `scripts/Video-*-Script.md`) by relative path,
so run them with the AI Builder Course repo as your working directory. The other
five work anywhere.

---

## How learnings work

Two problems had to be solved together.

**One:** a plugin is **copied into a version-pinned cache** when you install it
(`~/.claude/plugins/cache/codeyogi/<plugin>/<version>/`). It does not run from a
git clone, so a `git pull` can never reach the skill you're running.

**Two:** `main` is PR-protected by the `protect-main` ruleset. A rule you settle
at 4pm cannot wait on a core-dev review to reach the person who needs it at 5pm.

So two things travel on two branches, on two clocks:

```
branch `learnings`   learnings/, scripts/    unprotected    git pull every run   →  live, no restart
branch `main`        plugins/, catalog       PR + review    claude plugin update →  next session
```

A rule is cheap and reversible, so it propagates instantly. Skill code is
neither, so it keeps its review. The runtime scripts live on `learnings`
on purpose — that way a fix to the sync mechanism itself also reaches everyone
without a PR.

Before a skill does anything, its **Step 0** runs:

```bash
D=~/.claude/office-skills; [ -d "$D/.git" ] || git clone -q --depth 1 -b learnings --single-branch https://github.com/CodeYogiOrg/skills.git "$D"; bash "$D/scripts/sync.sh" <skill> <plugin>
```

which, in order:

1. shallow-clones or fast-forwards the `learnings` branch into
   `~/.claude/office-skills` (an orphan branch holding only `learnings/` and
   `scripts/`, so the clone is kilobytes, not the 7 MB of `main`);
2. prints `learnings/_shared.md` and `learnings/<skill>.md` into the skill's
   context — **these override the SKILL.md where they disagree**, being newer;
3. refreshes the catalog from `main`, compares it against your installed plugin
   version and, if you're behind, runs `claude plugin update` for you and tells
   you to restart.

It never blocks. Offline, unauthed, no git — it prints what it has, says so, and
exits 0. A sync problem must not stop the work.

Opt out per run: `OFFICE_SKILLS_OFFLINE=1` (no network),
`OFFICE_SKILLS_NO_AUTOUPDATE=1` (learnings only, don't touch plugins).

### A learning is pushed only after the person confirms

A learning becomes a rule on **every** teammate's next run, so a skill never
pushes one silently. When you state a norm mid-run, the skill shows you the
exact line it intends to push and asks. You approve the wording, not just the
idea — you are writing for the whole office, and a rule phrased loosely gets
applied in ways you did not mean.

Skill *code* is the slower clock and a different gate: `main` is PR-protected,
so a change to how a skill works is a PR plus a version bump, and it reaches
people on their next `claude plugin update` and restart.

### Push a learning

```bash
bash ~/.claude/office-skills/scripts/learn.sh create-video "Never crossfade two scenes — seamless content swap only."
bash ~/.claude/office-skills/scripts/learn.sh _shared     "A rule for every skill."
```

It commits to `learnings/<skill>.md` on the `learnings` branch and pushes — no
PR, because that branch isn't protected. The next person to run that skill reads
it. That's the whole loop.

**Belongs in a learning:** a norm you settled, a default that changed, a mistake
you don't want repeated, a tool now banned.
**Doesn't:** anything one-off, anything about a single video, anything secret.
If it changes how the skill *works*, edit the SKILL.md and ship a version — see
below.

---

## Add a new skill to the catalog

Three steps. Nothing changes for anyone already installed.

```bash
mkdir -p plugins/my-skill/{.claude-plugin,skills/my-skill}
cp -R ~/.claude/skills/my-skill/. plugins/my-skill/skills/my-skill/
```

1. **`plugins/my-skill/.claude-plugin/plugin.json`** — `name`, `version`,
   `description`, `author`. Copy a neighbour's.
2. **Step 0 in the SKILL.md** — paste the sync block from any existing skill,
   swapping in your skill and plugin names. Without it the skill won't read
   learnings.
3. **One entry in `.claude-plugin/marketplace.json`** —
   `{"name": "my-skill", "version": "1.0.0", "source": "./plugins/my-skill", "description": "…"}`.

Then validate and push:

```bash
claude plugin validate .                 # catches a malformed manifest
git add -A && git commit -m "add my-skill" && git push
```

It appears in everyone's `/plugin` list after `claude plugin marketplace update codeyogi`.
Already-installed plugins are untouched.

**Before you add one, check it's portable:** no absolute `/Users/<you>/…` paths,
no committed `.env`, no key in the SKILL.md. Those three break it for everyone
but you.

### Ship a change to an existing skill

Bump `version` in **both** `plugins/<name>/.claude-plugin/plugin.json` and that
plugin's entry in `marketplace.json` — they must agree or `claude plugin validate`
fails. Push. Everyone's next sync notices the gap and updates that one plugin.

---

## Layout

```
office-skills/
├── .claude-plugin/marketplace.json   the catalog — one entry per plugin
├── README.md                         this file
└── plugins/<name>/
    ├── .claude-plugin/plugin.json    manifest
    ├── README.md                     how to use this one
    └── skills/<skill>/SKILL.md       the skill itself
```

and on branch `learnings` (orphan, kilobytes):

```
learnings/
├── _shared.md                        rules for all skills
├── <skill>.md                        rules for one skill
└── README.md                         what belongs in a learning
scripts/
├── sync.sh                           Step 0: pull learnings, check versions
└── learn.sh                          push a learning
```

`sync.sh` is not copied into each plugin — every skill runs the one on the
`learnings` branch, so one fix reaches everybody.

### Branch cheat sheet

| | `main` | `learnings` |
|---|---|---|
| holds | plugins, catalog, README | learnings, runtime scripts |
| protected | yes — PR + core-dev review | no |
| how it reaches you | `claude plugin update` + restart | every skill run, instantly |
| change it with | a pull request | `scripts/learn.sh` |
