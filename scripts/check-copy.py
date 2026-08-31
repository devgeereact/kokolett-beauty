#!/usr/bin/env python3
"""Fail the build when an em or en dash reaches copy a person reads.

Em dashes are the most reliable tell that a machine wrote a sentence, and this
salon's voice is a person talking to a customer (docs/RULES.md §9.7, §9.9).
They were swept out by hand twice before, and they came back both times, once
into the live database: `0020_subject_lines_without_em_dashes.sql` exists only
because `0018` reached production with em dashes in its subject lines.

The hookify rule at `.claude/hookify.em-dash-in-copy.local.md` warns while an
agent is editing. It is advisory, it only runs inside Claude Code, and it is
easy to walk past. This is the gate.

What is checked: strings and markup that render to a screen or an inbox. What is
not: code comments, CSS comments, docs, and test names. A comment is not copy,
and flagging one trains people to ignore the check.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Directories and files whose strings reach a person.
TARGETS = [
    "src",
    "supabase/migrations",
    "supabase/functions/_shared",
    "public/offline.html",
    "index.html",
    "vite.config.ts",
    "package.json",
]

SUFFIXES = {".ts", ".tsx", ".sql", ".html", ".json", ".css"}

SKIP_PARTS = {"node_modules", "dist", ".git", "coverage"}

# Tests describe behaviour to a developer, not copy to a customer.
SKIP_NAME_RE = re.compile(r"\.(test|spec)\.[jt]sx?$")

# Applied migrations are immutable. Editing one that has already run against
# production changes history without changing the database, and the checksum
# drift is worse than the dash. `0065` swept the live copy that mattered
# (`email_templates`); everything before it is a historical record. New
# migrations from here on are checked.
MIGRATION_FLOOR = 65
MIGRATION_RE = re.compile(r"^(\d{4})_")

DASHES = re.compile(r"[\u2014\u2013]")

# `format.ts` returns a bare em dash as the empty-cell marker in about twenty
# dashboard tables. That is table typography, not prose, and it carries none of
# the tell this check exists to catch.
PLACEHOLDER = re.compile(r"""(['"`])\u2014\1""")

# A file that has to quote a dash in order to remove one, such as a migration
# whose whole job is a find-and-replace over live copy, opts out by carrying
# this marker on a line of its own. Use it nowhere else.
OPT_OUT = "copy-check: allow-dashes"

BLOCK_COMMENTS = {
    ".ts": [(r"/\*", r"\*/")],
    ".tsx": [(r"\{?/\*", r"\*/\}?")],
    ".css": [(r"/\*", r"\*/")],
    ".sql": [(r"/\*", r"\*/")],
    ".html": [(r"<!--", r"-->")],
}

LINE_COMMENTS = {
    ".ts": r"//",
    ".tsx": r"//",
    ".sql": r"--",
}


def blank_comments(text: str, suffix: str) -> str:
    """Replace every comment with spaces, keeping line numbers intact.

    Blanking rather than deleting means a reported line number still points at
    the right line in an editor, which is the whole value of the report.
    """
    for open_pat, close_pat in BLOCK_COMMENTS.get(suffix, []):
        pattern = re.compile(open_pat + r".*?" + close_pat, re.DOTALL)
        text = pattern.sub(lambda m: re.sub(r"[^\n]", " ", m.group(0)), text)

    marker = LINE_COMMENTS.get(suffix)
    if marker:
        out = []
        for line in text.split("\n"):
            hit = line.find(marker)
            # A `--` inside a SQL string literal is not a comment, and neither
            # is `//` inside a URL. Counting quotes ahead of the marker is
            # crude, but it is right for every real case in this repo.
            if hit >= 0 and line[:hit].count("'") % 2 == 0 and not line[:hit].endswith(":"):
                line = line[:hit]
            out.append(line)
        text = "\n".join(out)

    return text


def offending_lines(path: Path) -> list[tuple[int, str]]:
    suffix = path.suffix
    text = path.read_text(encoding="utf-8")
    if OPT_OUT in text:
        return []
    stripped = blank_comments(text, suffix)
    originals = text.split("\n")

    hits: list[tuple[int, str]] = []
    for number, line in enumerate(stripped.split("\n"), 1):
        line = PLACEHOLDER.sub("", line)
        if DASHES.search(line):
            hits.append((number, originals[number - 1].strip()[:120]))
    return hits


def files() -> list[Path]:
    found: list[Path] = []
    for target in TARGETS:
        base = ROOT / target
        if base.is_file():
            found.append(base)
            continue
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if not path.is_file() or path.suffix not in SUFFIXES:
                continue
            if SKIP_PARTS & set(path.parts) or SKIP_NAME_RE.search(path.name):
                continue
            if "migrations" in path.parts:
                match = MIGRATION_RE.match(path.name)
                if match and int(match.group(1)) < MIGRATION_FLOOR:
                    continue
            found.append(path)
    return found


def main() -> int:
    problems = [(p, hits) for p in files() if (hits := offending_lines(p))]
    if not problems:
        print(f"copy check: no em or en dashes in {len(files())} files")
        return 0

    total = sum(len(h) for _, h in problems)
    print(f"copy check: {total} dash(es) in copy, in {len(problems)} file(s)\n")
    for path, hits in problems:
        rel = path.relative_to(ROOT)
        for number, text in hits:
            print(f"  {rel}:{number}: {text}")
    print(
        "\nReplace each with a full stop, a comma, a colon, or parentheses."
        "\nA full stop is usually right: two sentences that each say one thing."
        "\nIf the match is inside a code comment, this check has a gap: widen"
        "\nthe comment detection in scripts/check-copy.py rather than the copy."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
