---
description: List all plans for the current repository
agent: wolf
---

List all plans stored for the current repository.

## Process

1. Check if the plans directory exists:
   ```bash
   ls .opencode/plans/
   ```

2. If the directory exists and contains plans, list them with their status. For each `.md` file found:
   - Read the file to extract the **Status** and **Scope** from the frontmatter
   - Display a formatted table:
     ```
     Plan Name               Status        Scope
     ─────────               ──────        ─────
     add-sso-auth            reviewed      Add SSO authentication via SAML
     refactor-api-layer      in-progress   Restructure API into modular handlers
     ```

3. If no plans exist, say so:
   "No plans found for this repo yet. Start describing what you want to build and I'll help you plan it."

## Important

- Only list plans in `.opencode/plans/` (repo root)
- Show status and scope for quick scanning
- Sort by last modified (most recent first)
