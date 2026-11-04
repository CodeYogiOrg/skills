---
name: hedra-gulla-video
description: Use when Gulla's talking green-screen videos need to be created from his line audio — after the elevenlabs-audio skill generates gulla-audio/ takes, or when the user says "make Gulla's video", "generate Gulla speaking", "hedra". Produces green-background talking-Gulla mp4s that feed the existing prep-gulla chroma-key pipeline unchanged. Invoked BY ai-builder-video (its preset route), or by the generic create-video only when that video's profile chose API lip-sync and named Hedra; user-supplied clips always win over generation. Needs the user's own HEDRA_API_KEY in the environment.
---

## Step 0 — sync shared learnings (before anything else)

Run this first, every single time this skill is invoked:

```bash
D=~/.claude/office-skills; [ -d "$D/.git" ] || git clone -q --depth 1 -b learnings --single-branch https://github.com/CodeYogiOrg/skills.git "$D"; bash "$D/scripts/sync.sh" hedra-gulla-video hedra-gulla-video
```

It pulls the `office-skills` repo and prints every learning pushed for this skill
since anyone last ran it. **Obey what it prints.** Where a learning and this file
disagree, the learning wins — it is newer by definition.

If it fails (offline, no repo access), say so in one line and carry on. A sync
problem must never block the work.

To push a learning back so the whole office gets it:
`bash ~/.claude/office-skills/scripts/learn.sh hedra-gulla-video "the rule"`

---

> **One lip-sync route among four, never a default.** `ai-builder-video` uses this as its preset
> generation route. The generic `create-video` calls it only when step 0's profile
> set `character.lipSync` to `api` AND the user named Hedra. The other routes are supplied clips (which always win), the local
> mouth-flap rig, and no lip-sync at all. It holds no key: export `HEDRA_API_KEY`
> in your own shell. The green-screen character image in this folder is the AI
> Builder Course preset's asset — any other project supplies its own.


# Hedra Gulla Video

Turn a Gulla line's audio into a talking-Gulla video with the Hedra API (Character 3). The character image is FIXED: `gulla-green.png` in this skill dir — full-body Gulla on pure green. Hedra animates it speaking the audio and returns an mp4 **with the green background intact**, so the v27 downstream pipeline (`prep-gulla.mjs` chroma-key → transparent WebM → mount numbers → step 5d) runs on it completely unchanged.

**The audio chain matters:** always generate from the `gulla-audio/` takes written by the `elevenlabs-audio` skill — the SAME take that's stitched into the section audio. One take, used in both places (Harshit's rule, 2026-07-20).

## Config

- `HEDRA_API_KEY`: env var, then nearest `.env` up from cwd, then the `.env` in this skill's own folder — so the skill works from any repo without a local key.
- Character image: `gulla-green.png` here — replace ONLY when Harshit supplies new character art (then re-generate, don't mix old and new Gulla in one video).
- Model: Hedra Character 3 (`d1dd37a3-e39a-4854-a298-6510289f9cf2`), 9:16, default 720p.
- **Credits: 7/second at 720p** (×0.5 @540p, ×1.25 @1080p) from a monthly pool — a 4s line ≈ 27 credits.

## Commands

```bash
# one line                                          # every take in the folder, in order → gulla/1.mp4, 2.mp4, ...
node .claude/skills/hedra-gulla-video/scripts/gen-gulla-video.mjs \
  --audio <video-folder>/gulla-audio/s2-l01-gulla.mp3        --audio-dir <video-folder>/gulla-audio

# cost preview (no generation) · resolution override
... --estimate            · --resolution 1080p
```

Output lands in `<video-folder>/gulla/N.mp4` — the exact place the video pipeline expects user-recorded clips, in sequence order.

**Idle padding is automatic:** the script adds 0.8s of silence to each end of the audio before upload (`--pad` to change) so Hedra animates real idle motion for Gulla's entrance and the 1s exit tail — no `<Freeze>` fallback needed. `prep-gulla.mjs` trims back to speech−0.15s, so the mounted span still matches the section-audio take exactly; the pad seconds are billed (~6 extra credits/clip at 720p) but buy natural motion.

## Alternate path — Harshit generates on OpenArt himself (2026-07-30)

Harshit now often makes the clips MANUALLY on OpenArt's Lip-Sync tool (Hedra
model, "Fast") in his browser — browser automation can't drive his logged-in
session (see [[browser-mcp-remote-only]]), so the split is:

- **Claude prepares padded per-take audio and hands it over.** From the
  `gulla-audio/` takes, pad each with **0.4s lead + 2.0s trailing silence**
  (`ffmpeg -af "adelay=400:all=1,apad=pad_dur=2.0"`) into a
  `for-generation/gulla-N.mp3` folder, open it, give him the OpenArt Lip-Sync
  URL. The generous 2s tail is the fix for clips ending before their scene's
  1s idle tail (earlier takes had ~0 tail → truncated clips needing a frozen
  fallback; with 2s pad the generated clip carries its own idle tail).
- **He drops the resulting mp4s into `scripts/video-N/gulla-openart/`**
  (name them `gulla-01-new.mp4 … gulla-04-new.mp4`, G1→G4 order). Detect by
  matching each clip's duration to its padded-audio duration.
- **Background is beige, and we KEEP it — do NOT remove it.** OpenArt/Hedra-
  Fast output comes on a beige gradient (~#c1b094→#b8a78a) that already
  matches the paper (#D9C5A3, within ~15 RGB). So the raw 9:16 mp4 plays
  FULL-FRAME (objectFit cover, exact fit) and its own beige fills the Gulla
  scene — Gulla keeps his natural shadow, and the paper↔clip fade is beige-
  over-beige = seamless. GullaClip mounts the RAW mp4 (`public/gulla/
  gulla-0N.mp4`, no `transparent`). Both chroma-key (`prep-gulla.mjs`) and
  AI matting (`videos/scripts/matte-gulla.py`, rembg) were tried and rejected
  here — keying fails on the gradient+skin hue, matting gives a floating
  cut-out. Only remove the background if a future clip's bg does NOT match
  the paper. Mount numbers still come from silencedetect on the padded take
  (the matte script prints them; keep the numbers, discard its webm).

## Workflow (Hedra-API path)

1. **`--estimate` first** — report credits against the balance (the script prints both) and confirm with the user before a multi-clip run.
2. Generate (each clip takes a few minutes — poll is built in).
3. **View-verify EVERY clip before keying**: extract a mid-clip frame and Read it — check Gulla still looks on-model, lips move, background stayed uniform green, no warped hands/face. A bad generation = re-run that one clip (Hedra output varies run to run), don't key garbage.
4. Hand each good clip to `prep-gulla.mjs` (create-video step 5d) exactly as if the user had recorded it.

## Common mistakes

- **Generating from audio that isn't the gulla-audio/ take.** Clip audio must be the identical take stitched into the section — otherwise lips and section sound drift.
- **Skipping the view-verify.** AI video occasionally warps the character or moves the background; keying and mounting a bad clip wastes a render cycle.
- **Estimating after generating.** Credits are a small monthly pool; preview cost first, confirm bulk runs with the user.
- **Regenerating clips that were fine.** Hedra output is non-deterministic — a good clip is a KEPT asset like its WebM; re-run only failed clips.
- **Changing the character image casually.** Same Gulla image for every clip in a video, or he visibly changes between scenes.
