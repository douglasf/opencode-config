---
description: Implement a plan by delegating steps to Wolf
agent: marsellus
---

Load a plan and implement it step by step, delegating each step to Wolf.

## Arguments

- First argument: $1 (plan name — required, kebab-case slug e.g. "add-sso-auth")

## Process

1. **Resolve the plan file path:**
   The plan lives at `.opencode/plans/$1.md` (relative to repo root).
   
   Read:
   ```
   .opencode/plans/$1.md
   ```

2. **If the plan doesn't exist**, list available plans and tell the user:
   "No plan named '$1' found. Here are the available plans for this repo: ..."

3. **Load and parse the plan.** Extract the Implementation Plan section (Section 6) to get the ordered list of steps.

4. **Update the plan status** to `in-progress` and save it back to disk.

5. **Analyze step dependencies and execute in parallel where possible:**

   Before executing, analyze the implementation steps for dependencies:
   - Can any steps run independently of others? (no shared file changes, no output dependency)
   - Group independent steps together
   - Identify sequential chains (step B depends on A's output)
   
   Execute in this order:
   - All parallel groups run simultaneously via Task() calls in a single message
   - Sequential chains execute after their dependencies complete
   - Report progress to the user after each group completes
   
   For each group:
   a. Tell the user which steps are starting (and if parallel, note "running in parallel")
   b. Delegate to Wolf via Task() — if multiple independent steps, emit multiple Task() calls simultaneously
   c. Wait for all tasks in the group to complete
   d. Report results
   e. Ask if they want to continue or review
   
   Example format for parallel execution:
   ```
   Task(
     subagent_type: "wolf",
     description: "Plan step 1: <desc>",
     prompt: "Implement step 1..."
   )
   Task(
     subagent_type: "wolf", 
     description: "Plan step 3: <desc>",
     prompt: "Implement step 3..."
   )
   ```
   (Steps 2 and 4 would queue after steps 1 and 3 complete, if they depend on them)

6. **After all steps are complete**, update the plan status to `completed` and save.

## Important

- Always give Wolf the FULL plan as context, not just the current step — Wolf needs to understand the bigger picture
- Analyze each step for dependencies — execute independent steps in parallel, sequence only when there's a real dependency
- If a step fails, stop and report the failure. Don't continue blindly.
- After each step, give the user a chance to review before continuing
- The user can always say "skip" to move to the next step or "stop" to pause implementation
- Do NOT attempt git operations — remind the user to use `/commit` when they want to save progress
