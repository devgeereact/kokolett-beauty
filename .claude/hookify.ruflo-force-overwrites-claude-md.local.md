---
name: block-ruflo-init-force
enabled: true
event: bash
action: block
pattern: (?:^|[;&|]\s*|\bsudo\s+)(?:ruflo|claude-flow)\s+init\b[^|;&]*--force
---

**Blocked: `ruflo init --force` overwrites `CLAUDE.md` wholesale.**

It does not merge. On 2026-08-09 it deleted every line of this project's
context and replaced it with its own harness boilerplate: the women's-hair-only
scope, the rule that booking writes go through `book_appointment()`, money in
integer pence, time UTC in storage and `Europe/London` on screen, the document
index, and the live coordinates. All gone in one command.

It was recoverable only because the tool happens to leave `CLAUDE.md.pre-ruflo`
beside the file.

**If you still need to run it:**

1. Commit `CLAUDE.md` first, so `git show HEAD:CLAUDE.md` is a real fallback.
2. Run it.
3. Restore the project half from `CLAUDE.md.pre-ruflo` and append the generated
   ruflo section *below* it, rather than accepting the replacement.
4. Check the result actually contains the project context before moving on:

```bash
grep -c "Kokolett Beauty UK\|book_appointment()\|Women's hair only" CLAUDE.md
```

`ruflo init` without `--force` is safe: it detects an existing install and
declines.

The pattern is anchored to command position (string start, or after `;`, `&&`
or a pipe). Without that anchor it fired on any text that merely *mentioned*
the command, which blocked a commit whose message explained this very rule.
