#!/usr/bin/env python3
"""Keep PRD section 6 acceptance criteria identical to user-story.md.

user-story.md is the single source of the acceptance criteria. This script
rewrites the criteria blocks in PRD.md from it. Run with --check in CI: it
exits 1 and changes nothing if the two files differ.

Contract: PRD section 6.1. Standard library only.

Usage: python3 scripts/sync_stories.py [--check]
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STORY_ID = r"(?:STU|EDU|ADM)-\d+"


def story_criteria(lines):
    """Map story id -> list of criteria text, read from user-story.md."""
    out, cur, active = {}, None, False
    for line in lines:
        m = re.match(rf"### ({STORY_ID}) —", line)
        if m:
            cur, active = m.group(1), False
            out[cur] = []
            continue
        if line.startswith("## "):
            cur, active = None, False
        if cur is None:
            continue
        if line.startswith("**Acceptance criteria**"):
            active = True
        elif line.startswith("**Definition of Done**"):
            active = False
        elif active and line.startswith("- [ ] "):
            out[cur].append(line[len("- [ ] "):])
    return out


def rewrite_prd(lines, criteria):
    """Return PRD lines with each story's criteria replaced from criteria."""
    out, cur, i, seen = [], None, 0, set()
    while i < len(lines):
        line = lines[i]
        m = re.match(rf"#### ({STORY_ID}):", line)
        if m:
            cur = m.group(1)
        elif line.startswith("## ") or line.startswith("### "):
            cur = None
        out.append(line)
        i += 1
        if cur and line.startswith("- **Acceptance criteria:**"):
            if cur not in criteria or not criteria[cur]:
                sys.exit(f"{cur} has no criteria in user-story.md")
            while i < len(lines) and lines[i].startswith("  - "):
                i += 1
            out.extend(f"  - {c}" for c in criteria[cur])
            seen.add(cur)
    missing = set(criteria) - seen
    if missing:
        sys.exit(f"In user-story.md but not in PRD section 6: {sorted(missing)}")
    return out


def main():
    check = "--check" in sys.argv
    us = (ROOT / "user-story.md").read_text().split("\n")
    prd_path = ROOT / "PRD.md"
    prd = prd_path.read_text().split("\n")
    new = rewrite_prd(prd, story_criteria(us))
    if new == prd:
        print("PRD section 6 criteria match user-story.md")
        return 0
    if check:
        print("PRD section 6 criteria differ from user-story.md. Run scripts/sync_stories.py")
        return 1
    prd_path.write_text("\n".join(new))
    print("PRD section 6 criteria rewritten from user-story.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
