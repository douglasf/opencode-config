---
description: Load a plan and update it through conversation
agent: jules
---

Load an existing plan and start a conversation about what needs updating.

## Arguments

- First argument: $1 (plan name — required, kebab-case slug e.g. "add-sso-auth")

## Process

1. **Resolve the plan file path:**
   ```bash
   git remote -v
   ```
   Parse origin to get `<org>/<repo>`, then read:
   ```
   ~/.opencode/plans/<org>/<repo>/$1.md
   ```

2. **If the plan doesn't exist**, list available plans and tell the user:
   "No plan named '$1' found. Here are the available plans for this repo: ..."

3. **If the plan exists**, read it and present a summary to the user:
   - Plan title and current status
   - Brief overview of each section (one line per section)
   - Then ask: "What needs updating?"

4. **Enter conversational update mode.** The user will tell you what they want to change. This could be:
   - Adjusting scope (adding/removing goals or non-goals)
   - Changing the approach based on new information
   - Adding implementation steps
   - Updating status
   - Revising the design based on what was learned during implementation
   - Adding risks or open questions that surfaced

5. **If the update requires new analysis** (e.g., "we need to handle a new edge case" or "the API changed"), delegate to the Architect:
   ```
   Task(
     subagent_type: "architect",
     description: "Update plan <plan-name>",
     prompt: "Update the existing plan at ~/.opencode/plans/<org>/<repo>/<plan-name>.md:\n\n## Changes Requested\n- <specific changes>\n\n## Additional Context\n<new information>\n\nRead the existing plan, investigate any new areas needed, make the updates, save back to disk, and return update metadata."
   )
   ```

6. **After discussing changes**, update the plan document and save it back to disk. Update the `Updated` date in the frontmatter.

7. **Show the user what changed** — present a before/after summary of the sections that were modified.

## Important

- Always show the current plan before asking what to update — the user needs context
- Keep the conversation natural — don't force them through a rigid update flow
- Multiple rounds of updates are fine — save when the user is satisfied
- If the plan status is `completed`, ask if they want to reopen it before making changes
