---
description: Update an existing plan through the Architect
agent: architect
---

Update an existing plan by gathering user intent, then delegating all work to the Architect.

## Step 1 — Gather Intent

Check whether a plan name was provided as a command argument (`$1`):

- **If `$1` is provided** (e.g. the user ran `/plan-update import-from-url`):
  Use `$1` as the plan name. Do NOT ask for the plan name — skip straight to the next question.

- **If `$1` is empty or not provided** (e.g. the user ran `/plan-update` with no arguments):
  Ask: **"What plan do you want to update?"**
  — They should provide the plan name (kebab-case slug, e.g. `add-sso-auth`), and optionally `org/repo` if it's not obvious from the current project context.

Then, regardless of how the plan name was determined, ask:

**"What changes or updates do you want to make?"**
— Examples: adjusting scope, changing approach, adding steps, updating status, revising design, adding risks/open questions.

Wait for their response before proceeding.

## Step 2 — Delegate to Architect

Once you have the plan name and the requested changes:

1. **Locate the plan file:**
   - The plan lives at: `.opencode/plans/<plan-name>.md` (relative to repo root)

2. **Read the existing plan.** If it doesn't exist, list available plans in `.opencode/plans/` and tell the user.

3. **Analyze what changes are needed** based on the user's requested updates. Investigate code or context as necessary.

4. **Update the plan file** — apply the changes, update the `Updated` date in frontmatter, and save to disk.

5. **Return update metadata** — summarize what sections changed and why.

## Important

- This command is routed directly to the Architect, who handles both intent gathering and plan updates.
- Do NOT fall back to a general-purpose agent. All work stays within the Architect.
- Do NOT run git commits, pushes, or PRs.
