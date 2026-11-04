# Learnings — all skills

Rules every skill obeys. Newest last. Added with `scripts/learn.sh`.

## 2026-10-16 — Harshit

When someone states a norm or correction while a skill is running, encode it the
same turn — push it with `scripts/learn.sh` so it survives past this session.
A rule stated once and not written down gets re-litigated next week.

## 2026-10-16 — Harshit

API keys are exported environment variables in your own shell. Never a `.env`
committed inside a skill, never a key pasted into a SKILL.md. Each skill ships
a `.env.example` naming the variable it needs and nothing more.
