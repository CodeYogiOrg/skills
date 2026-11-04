# language

Converts text in a file or a selection to another language, asking which language first.

**Install**

```bash
claude plugin marketplace add CodeYogiOrg/office-skills   # once per machine
claude plugin install language@codeyogi
```

**Invoke** — `/language`

**What it's for** — Quick translation of a script, caption set or doc.

**Needs** — Nothing.

**Learnings** — the skill syncs `learnings/language.md` from the repo before it
does anything, so office rules reach you without a reinstall. Push one with:

```bash
bash ~/.claude/office-skills/scripts/learn.sh language "the rule"
```

See the [repo README](../../README.md) for how the whole catalog fits together.
