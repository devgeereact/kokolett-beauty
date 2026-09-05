#!/usr/bin/env python3
"""Fail the build when a Tailwind class in `src/` produces no CSS.

`tailwind.config.ts` declares `colors`, `screens`, `fontSize`, `borderRadius`,
`boxShadow` and `zIndex` at THEME level rather than inside `extend`, so the
project's scale is meant to replace Tailwind's default instead of adding to it.

It only half works, and the half that fails is the reason this script has two
checks rather than one. Measured against the compiled stylesheet on
2026-09-05, under Tailwind v4 loaded through `@config`:

  * `colors`, `fontSize` and `boxShadow` ARE replaced. A name outside the
    scale emits nothing: the build succeeds, eslint says nothing, and the
    element quietly renders with whatever it inherited. That is check one.
  * `screens` is NOT replaced. `dist/assets/*.css` carries
    `@media (min-width:40rem)` for `sm:`, which is v4's own 640px and not one
    of the three declared breakpoints. A `sm:` class therefore RESOLVES, so
    check one can never see it. That is check two.
  * `zIndex` is NOT replaced either: `z-<number>` is a bare-value utility in
    v4 with no theme lookup, so `.z-10{z-index:10}` is emitted regardless.
    Check two covers the named variants; a bare `z-10` is caught by the
    zIndex rule below.
  * Arbitrary values (`text-[11px]`) are never blocked by either check.
    `docs/DESIGN.md` and code review remain the control for those.

Five of these were live on 2026-09-04, all found by measuring the rendered
page or the compiled stylesheet rather than by reading the code:

  * `text-7xl` on the 404 numeral. The scale stops at `6xl`, so a 72px display
    numeral rendered at the inherited 16px, which is also what pushed it under
    the contrast threshold.
  * `from-black/70` on the Contact page photo scrim. The colour scale is closed
    and has no `black`, so every gradient stop resolved to `rgba(0,0,0,0)` and
    the white caption sat directly on the photograph.
  * `shadow-sm` on the template preview's selected segment. The boxShadow scale
    is `none | card | popover | modal`, so the selected state had no lift.
  * seven `sm:` classes, breaking at an undeclared 640px.
  * two `z-10` classes, outside the named z-index scale.

How it works: it needs a build first, because the built CSS is the only honest
answer to "did this class produce anything". A candidate is reported only when
all three are true, which is what keeps it quiet enough to be a gate:

  1. it sits in a string literal that holds at least one OTHER class which does
     resolve, so the literal is demonstrably a class list and not a DOM id, a
     storage key or a status value;
  2. it is shaped like a utility from one of the replaced scales; and
  3. no rule for it exists in `dist/assets/*.css`.

Comments are stripped before any of that. Without it the check reports itself:
this very file's neighbours document the three bugs above by name, in
backticks, and a naive scan reads a backtick as a string delimiter.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST_CSS = sorted((ROOT / "dist" / "assets").glob("*.css"))
CONFIG = ROOT / "tailwind.config.ts"

# Variants that are NOT responsive breakpoints and so are never in `screens`.
# Anything else ending in `:` is treated as a breakpoint claim and checked.
NON_SCREEN_VARIANTS = frozenset(
    """
    hover focus focus-visible focus-within active visited target disabled enabled
    checked indeterminate required optional valid invalid placeholder-shown
    autofill read-only open first last odd even first-of-type last-of-type only
    empty group-hover group-focus peer-hover peer-focus peer-checked
    before after placeholder file marker selection first-line first-letter
    backdrop dark motion-safe motion-reduce contrast-more contrast-less
    print portrait landscape rtl ltr forced-colors aria-expanded aria-selected
    aria-checked aria-disabled aria-pressed supports has not where is
    pointer-fine pointer-coarse pointer-none any-pointer-fine any-pointer-coarse
    """.split()
)

# The scale of z-index names the design system declares. A bare `z-<number>`
# resolves in Tailwind v4 with no theme lookup, so the closed scale does not
# actually close it.
BARE_Z = re.compile(r"^(?:[a-z][a-z0-9-]*:)*-?z-\d+$")

# A variant or base name shaped like a Tailwind identifier, so prose with a
# colon in it ("Opening hours: 09:00") never reaches the breakpoint check.
VARIANT_SAFE = re.compile(r"^-?[a-z][a-z0-9]*(?:-[a-z0-9.]+)*$")

# Utility prefixes fed by a scale this config REPLACES. A class starting with
# one of these and resolving to nothing is a silent no-op, not a plugin class.
PREFIXES = (
    "text-",
    "bg-",
    "from-",
    "via-",
    "to-",
    "border-",
    "ring-",
    "fill-",
    "stroke-",
    "shadow-",
    "z-",
    "rounded-",
    "decoration-",
    "outline-",
    "divide-",
    "placeholder-",
    "caret-",
    "accent-",
)

# Utilities whose suffix is a length, a fraction or a keyword rather than a
# theme token, so "not in the CSS" says nothing about whether they are valid.
# `border-2` and `rounded-full` are fine; it is `border-slate-300` we are after.
SKIP = re.compile(
    r"""^(
        (?:text|bg|border|ring|from|via|to|divide|outline|decoration)-\[.*\]
      | border-(?:[0-9]+|x|y|t|r|b|l|s|e|collapse|separate|solid|dashed|dotted|double|hidden|none|spacing)(?:-[0-9]+)?
      | divide-(?:x|y)(?:-[0-9]+|-reverse)?
      | rounded-(?:none|full|[trbles]{1,2}(?:-[a-z0-9]+)?)?
      | text-(?:left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|opacity-[0-9]+)
      | bg-(?:cover|contain|center|top|bottom|left|right|repeat|no-repeat|fixed|local|scroll|clip-[a-z]+|origin-[a-z]+|blend-[a-z]+|gradient-to-[a-z]{1,2}|auto|none)
      | shadow-(?:none|inner)
      | z-(?:auto|[0-9]+)
      | ring-(?:[0-9]+|inset|offset-[0-9]+)
      | outline-(?:none|[0-9]+|offset-[0-9]+|dashed|dotted|double|hidden)
      | (?:fill|stroke)-(?:none|current|[0-9]+)
      | accent-(?:auto)
      | decoration-(?:[0-9]+|solid|double|dotted|dashed|wavy|from-font|auto|slice|clone)
    )$""",
    re.X,
)

# `class="..."`, `'a b c'` inside cn(), template chunks: any string literal that
# could be a class list. Narrow enough that identifiers with a dot or a slash
# in an unexpected place never reach the prefix test.
STRING = re.compile(r"""['"`]([^'"`\n]{2,300})['"`]""")
TOKEN = re.compile(r"^(?:[a-z][a-z0-9]*:)*(?:-?[a-z][a-z0-9]*)(?:-[a-z0-9.]+)+(?:/[0-9]+)?$")

CSS_ESCAPE = ".:/[]()%#!,"


# Comments first, or a comment that names a class in backticks becomes a
# "string literal" containing that class. Ordered so a `//` inside a string is
# not mistaken for the start of a comment.
COMMENTS = re.compile(
    r"""('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|(/\*.*?\*/|//[^\n]*)""",
    re.S,
)


def strip_comments(source: str) -> str:
    return COMMENTS.sub(lambda m: m.group(1) or " ", source)


def css_selector(cls: str) -> str:
    """The class as it appears in a stylesheet, with CSS-special characters escaped."""
    return "." + "".join("\\" + c if c in CSS_ESCAPE else c for c in cls)


def resolves(cls: str, css: str) -> bool:
    return css_selector(cls) in css or css_selector(cls.split(":")[-1]) in css


def declared_screens() -> set[str]:
    """The breakpoint names in tailwind.config.ts's theme-level `screens`."""
    source = CONFIG.read_text(encoding="utf-8")
    start = source.index("    screens: {")
    depth = 0
    for i in range(start, len(source)):
        if source[i] == "{":
            depth += 1
        elif source[i] == "}":
            depth -= 1
            if depth == 0:
                block = source[start : i + 1]
                break
    else:  # pragma: no cover - the config always closes its brace
        raise SystemExit("check-dead-classes: could not read `screens` from the config")
    return set(re.findall(r"^\s{6}'?([A-Za-z0-9_-]+)'?:", block, re.M))


def undeclared_variants(token: str, css: str, screens: set[str]) -> list[str]:
    """Breakpoint-looking variants on this class that the config never declares.

    The base utility must itself resolve before any variant is judged. Prose is
    full of colons ("Opening hours: 09:00", "og:title"), and unlike check one
    there is no "produced no CSS" signal to lean on here, because the whole
    point is that these classes DO produce CSS.
    """
    *variants, base = token.split(":")
    if not variants or not base or not VARIANT_SAFE.match(base):
        return []
    if not resolves(base, css):
        return []
    return [
        v
        for v in variants
        if VARIANT_SAFE.match(v)
        and v not in screens
        and v not in NON_SCREEN_VARIANTS
        and not v.startswith(("group-", "peer-", "aria-", "data-", "has-", "not-"))
    ]


def main() -> int:
    if not DIST_CSS:
        print(
            "check-dead-classes: no dist/assets/*.css found. "
            "Run `npm run build` first: the built CSS is what this checks against.",
            file=sys.stderr,
        )
        return 1

    css = "\n".join(p.read_text(encoding="utf-8") for p in DIST_CSS)
    screens = declared_screens()

    seen = 0
    dead: dict[str, set[str]] = {}
    offscale: dict[str, set[str]] = {}
    for path in sorted((ROOT / "src").rglob("*")):
        if path.suffix not in {".ts", ".tsx"}:
            continue
        text = strip_comments(path.read_text(encoding="utf-8"))
        for literal in STRING.findall(text):
            tokens = literal.split()
            if len(tokens) < 2:
                continue
            # The literal has to prove it is a class list before anything in it
            # is judged. One resolving neighbour is enough.
            if not any(resolves(t, css) for t in tokens):
                continue

            # Check two, on every class in the list rather than only the
            # theme-scale prefixes: these classes RESOLVE, which is exactly why
            # check one is blind to them.
            for token in tokens:
                if BARE_Z.match(token):
                    offscale.setdefault(
                        f"{token} (z-index scale is named: see tailwind.config.ts)",
                        set(),
                    ).add(str(path.relative_to(ROOT)))
                for variant in undeclared_variants(token, css, screens):
                    offscale.setdefault(
                        f"{variant}: (declared breakpoints: {', '.join(sorted(screens))})",
                        set(),
                    ).add(str(path.relative_to(ROOT)))

            for token in tokens:
                if not token.startswith(PREFIXES):
                    continue
                if not TOKEN.match(token) or SKIP.match(token):
                    continue
                seen += 1
                if not resolves(token, css):
                    dead.setdefault(token, set()).add(str(path.relative_to(ROOT)))

    def report(title: str, why: str, rows: dict[str, set[str]]) -> None:
        print(f"check-dead-classes: {title}\n{why}\n", file=sys.stderr)
        for cls in sorted(rows):
            print(f"  {cls}", file=sys.stderr)
            for f in sorted(rows[cls]):
                print(f"      {f}", file=sys.stderr)
        print("", file=sys.stderr)

    if dead:
        report(
            f"{len(dead)} class(es) in src/ produced no CSS.",
            "colors, fontSize and boxShadow are declared at theme level, so a name outside\n"
            "the scale is silently dropped. Use a defined token, or add one to\n"
            "tailwind.config.ts and document it in docs/DESIGN.md.",
            dead,
        )

    if offscale:
        report(
            f"{len(offscale)} off-scale utility group(s) in src/.",
            "These RESOLVE, which is why the check above cannot see them: Tailwind v4 keeps\n"
            "its own breakpoints alongside the declared `screens`, and `z-<number>` is a\n"
            "bare-value utility with no theme lookup. Use a declared breakpoint or a named\n"
            "z-index token, or declare the one you want in tailwind.config.ts.",
            offscale,
        )

    if dead or offscale:
        return 1

    print(
        f"dead-class check: {seen} theme-scale class uses resolve; "
        f"no off-scale breakpoints or z-index values"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
