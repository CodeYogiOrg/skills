# learnings/

One file per skill, plus `_shared.md` for rules that apply to all of them.

Every skill reads its own file (and `_shared.md`) **before it does anything**, pulled
fresh from this repo on each run. That is the whole point: a rule you settle today
reaches your colleague's next run without them reinstalling or restarting anything.

Add one with `scripts/learn.sh <skill> "the rule"` — don't hand-edit unless you're
fixing wording. Newest entries go last.

**What belongs here:** a norm you settled, a default that changed, a mistake you
don't want repeated, a tool that's now banned.

**What doesn't:** anything one-off, anything about a single video, anything secret.
If it's really a change to how the skill *works*, edit the SKILL.md and bump the
plugin version instead.
