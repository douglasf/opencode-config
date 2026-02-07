---
description: List all plans for the current repository
agent: jules
---

List all plans stored for the current repository.

## Process

1. Determine the current repository's org and repo name:
   ```bash
   git remote get-url origin
   ```
   Parse the URL to extract `<org>/<repo>`:
   - Strip any trailing `.git` suffix
   - **HTTPS** (e.g. `https://github.com/acme-corp/my-app.git`) → org=`acme-corp`, repo=`my-app`
   - **SSH** (e.g. `git@github.com:acme-corp/my-app.git`) → org=`acme-corp`, repo=`my-app`
   - **⚠️ The org comes from the remote URL, NOT from `$USER`, `$HOME`, or `whoami`**
   - **Fallback** (no remote): use `_local` as org and current directory name as repo

2. Check if the plans directory exists:
   ```bash
   ls ~/.opencode/plans/<org>/<repo>/
   ```

3. If the directory exists and contains plans, list them with their status. For each `.md` file found:
   - Read the file to extract the **Status** and **Scope** from the frontmatter
   - Display a formatted table:
     ```
     Plan Name               Status        Scope
     ─────────               ──────        ─────
     add-sso-auth            reviewed      Add SSO authentication via SAML
     refactor-api-layer      in-progress   Restructure API into modular handlers
     ```

4. If no plans exist, say so:
   "No plans found for this repo yet. Start describing what you want to build and I'll help you plan it."

## Important

- Only list plans for the CURRENT repository (based on git remote)
- Show status and scope for quick scanning
- Sort by last modified (most recent first)
