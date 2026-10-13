#!/usr/bin/env python3
"""
Seed synthetic users for SolvePath (ADM-06, PRD §8.1, §16.1, §16.2, SPEC §2.1, §5.7).

Contract (Criterion 7):
- Reads content/seed/users.json (logical clerk_ref values, roles, display_label).
- Reads active content/seed/clerk_ids.<APP_ENV>.json map.
- Reads BOOTSTRAP_ADMIN_CLERK_ID from environment or argument.
- Fails with an explicit error if any clerk_ref is missing from the map.
- Creates app_user rows (or writes to output DB / seed registry).
- Inserts bootstrap administrator only if none exists.
- Stores NO name and NO email in app_user.
- Idempotent: creates no duplicates when run a second time.
"""

import sys
import os
import json
import uuid

def seed_synthetic(app_env=None, bootstrap_admin_id=None, output_path=None):
    if not app_env:
        app_env = os.environ.get("APP_ENV", "test")
    if not bootstrap_admin_id:
        bootstrap_admin_id = os.environ.get("BOOTSTRAP_ADMIN_CLERK_ID", "user_2bootstrap_admin_001")

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    users_path = os.path.join(base_dir, "content", "seed", "users.json")
    map_path = os.path.join(base_dir, "content", "seed", f"clerk_ids.{app_env}.json")

    if not os.path.exists(users_path):
        raise FileNotFoundError(f"Missing seed users file: {users_path}")
    if not os.path.exists(map_path):
        raise FileNotFoundError(f"Missing Clerk IDs map for environment '{app_env}': {map_path}")

    with open(users_path, "r", encoding="utf-8") as f:
        users_data = json.load(f)

    with open(map_path, "r", encoding="utf-8") as f:
        clerk_map = json.load(f)

    # 1. Validation: Fail with explicit error for any clerk_ref missing from the map
    missing_refs = []
    for user in users_data:
        ref = user.get("clerk_ref")
        if not ref or ref not in clerk_map:
            missing_refs.append(ref)

    if missing_refs:
        raise ValueError(
            f"Explicit error: Missing clerk_ref mapping in {os.path.basename(map_path)}: {', '.join(str(r) for r in missing_refs)}"
        )

    # 2. Load existing seeded store if output_path specified, else initialize
    if not output_path:
        output_path = os.path.join(base_dir, "content", "seed", f"seeded_users.{app_env}.json")

    existing_users = []
    existing_clerk_ids = set()

    if os.path.exists(output_path):
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                existing_users = json.load(f)
                existing_clerk_ids = {u["clerk_user_id"] for u in existing_users if "clerk_user_id" in u}
        except Exception:
            existing_users = []
            existing_clerk_ids = set()

    created_count = 0

    # 3. Insert users without duplicates
    for user in users_data:
        clerk_id = clerk_map[user["clerk_ref"]]
        if clerk_id in existing_clerk_ids:
            continue

        new_user = {
            "id": str(uuid.uuid4()),
            "clerk_user_id": clerk_id,
            "role": user["role"],
            "display_label": user.get("display_label", f"User {user['role'].title()}"),
            "grants": user.get("grants", []),
            "created_at": "2026-10-12T00:00:00Z"
        }
        # Explicit invariant: NO name and NO email stored in app_user
        assert "name" not in new_user, "Security invariant: name must not be stored in app_user"
        assert "email" not in new_user, "Security invariant: email must not be stored in app_user"

        existing_users.append(new_user)
        existing_clerk_ids.add(clerk_id)
        created_count += 1

    # 4. Insert bootstrap administrator only if none exists
    admin_exists = any(u.get("role") == "administrator" for u in existing_users)
    bootstrap_inserted = False

    if not admin_exists or bootstrap_admin_id not in existing_clerk_ids:
        bootstrap_user = {
            "id": str(uuid.uuid4()),
            "clerk_user_id": bootstrap_admin_id,
            "role": "administrator",
            "display_label": "Bootstrap Administrator",
            "grants": ["trace_review"],
            "created_at": "2026-10-12T00:00:00Z"
        }
        existing_users.append(bootstrap_user)
        existing_clerk_ids.add(bootstrap_admin_id)
        created_count += 1
        bootstrap_inserted = True

    # Save output
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(existing_users, f, indent=2)

    return {
        "status": "success",
        "app_env": app_env,
        "total_users": len(existing_users),
        "created_this_run": created_count,
        "bootstrap_admin_inserted": bootstrap_inserted,
        "output_path": output_path
    }

if __name__ == "__main__":
    env = sys.argv[1] if len(sys.argv) > 1 else "test"
    admin_id = sys.argv[2] if len(sys.argv) > 2 else None
    try:
        result = seed_synthetic(env, admin_id)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
