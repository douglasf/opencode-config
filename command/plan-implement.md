---
description: Implement a plan by delegating steps to Wolf
agent: jules
---

Load a plan and implement it step by step, delegating each step to Wolf.

## Arguments

- First argument: $1 (plan name — required, kebab-case slug e.g. "add-sso-auth")

## Process

1. **Resolve the plan file path:**
   ```bash
   git remote get-url origin
   ```
   Parse the URL to extract `<org>/<repo>`:
   - Strip any trailing `.git` suffix
   - **HTTPS** (e.g. `https://github.com/acme-corp/my-app.git`) → org=`acme-corp`, repo=`my-app`
   - **SSH** (e.g. `git@github.com:acme-corp/my-app.git`) → org=`acme-corp`, repo=`my-app`
   - **⚠️ The org comes from the remote URL, NOT from `$USER`, `$HOME`, or `whoami`**
   - **Fallback** (no remote): use `_local` as org and current directory name as repo
   
   Then read:
   ```
   ~/.opencode/plans/<org>/<repo>/$1.md
   ```

2. **If the plan doesn't exist**, list available plans and tell the user:
   "No plan named '$1' found. Here are the available plans for this repo: ..."

3. **Load and parse the plan.** Extract the Implementation Plan section (Section 6) to get the ordered list of steps.

4. **Update the plan status** to `in-progress` and save it back to disk.

5. **Execute each step sequentially** by delegating to Wolf:

   For each step in the implementation plan:
   
   a. Tell the user which step you're starting:
      "Starting Step N: <description>"
   
   b. Delegate to Wolf with full context:
      ```
      Task(
        subagent_type: "wolf",
        description: "Plan step N: <short desc>",
        prompt: "You are implementing step N of a plan. Here is the full plan for context:\n\n<full plan content>\n\nYour task is STEP N:\n<step details>\n\nImplement this step. The previous steps have already been completed."
      )
      ```
   
   c. Report Wolf's results to the user
   
   d. Ask if they want to continue to the next step or pause:
      "Step N complete. Continue to Step N+1, or want to review first?"

6. **After all steps are complete**, update the plan status to `completed` and save.

## Important

- Always give Wolf the FULL plan as context, not just the current step — Wolf needs to understand the bigger picture
- Execute steps IN ORDER — they may have dependencies
- If a step fails, stop and report the failure. Don't continue blindly.
- After each step, give the user a chance to review before continuing
- The user can always say "skip" to move to the next step or "stop" to pause implementation
- Do NOT attempt git operations — remind the user to use `/commit` when they want to save progress
