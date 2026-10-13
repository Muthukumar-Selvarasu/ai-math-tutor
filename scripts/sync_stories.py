#!/usr/bin/env python3
"""
Synchronize and check story tracking integrity (ADM-08, PRD §6.1, §14.5).
Verifies that all registered issues in issue-tracker/TRACKER.md match existing ISSUE.md specifications.
"""

import os
import sys
import re

def sync_stories(check_only=False):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tracker_path = os.path.join(base_dir, "issue-tracker", "TRACKER.md")

    if not os.path.exists(tracker_path):
        print(f"ERROR: Master tracker not found at {tracker_path}", file=sys.stderr)
        return False

    with open(tracker_path, "r", encoding="utf-8") as f:
        tracker_content = f.read()

    # Find table rows with ISSUE-xxx
    pattern = r"\|\s*(ISSUE-\d+)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*\[#(\d+)\]\([^)]+\)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|"
    matches = re.findall(pattern, tracker_content)

    if not matches:
        print("ERROR: No stories found in TRACKER.md", file=sys.stderr)
        return False

    mismatches = []
    verified_count = 0

    for match in matches:
        issue_id = match[0].strip()
        story_id = match[1].strip()
        title = match[2].strip()
        priority = match[3].strip()
        gh_num = match[4].strip()
        status = match[5].strip()
        stage = match[6].strip()
        completed = match[7].strip()
        local_ref = match[8].strip()
        local_rel_path = match[9].strip()

        # Check local path exists
        local_full_path = os.path.join(base_dir, "issue-tracker", local_rel_path)
        if not os.path.exists(local_full_path):
            mismatches.append(f"{issue_id} ({story_id}): Local spec missing at {local_rel_path}")
            continue

        with open(local_full_path, "r", encoding="utf-8") as spec_file:
            spec_content = spec_file.read()

        if story_id not in spec_content:
            mismatches.append(f"{issue_id} ({story_id}): Story ID not found inside {local_rel_path}")
            continue

        verified_count += 1

    print(f"Verified {verified_count} stories in issue-tracker/TRACKER.md.")

    if mismatches:
        print(f"FAILED: Found {len(mismatches)} story discrepancies:", file=sys.stderr)
        for m in mismatches:
            print(f"  - {m}", file=sys.stderr)
        return False

    print("SUCCESS: 0 story differences detected. Tracker and local specs are strictly synchronized.")
    return True

if __name__ == "__main__":
    check_mode = "--check" in sys.argv
    success = sync_stories(check_only=check_mode)
    sys.exit(0 if success else 1)
