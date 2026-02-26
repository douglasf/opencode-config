---
description: Implement a plan (markdown) by delegating steps to Wolf
agent: marsellus
---

Implement a plan step by step, delegating each step to Wolf.

## Arguments

- First argument: $1 (required) — a plan name (kebab-case slug e.g. `add-sso-auth`)

---

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

5. **Execute the plan in waves of ready steps:**

   **Anti-bundling rule — NEVER combine multiple plan steps into one Task() call; each independent step must get its own Wolf task.**
   Marsellus MUST honor this rule without exception. One step = one Task(). No bundling, no merging, no "and also do step N" inside another step's prompt.

   #### Wave loop

   Repeat until every plan step has been executed:

   a. **Identify ready steps.** A step is "ready" when all of its dependencies (prior steps whose output or file changes it needs) have completed successfully. Steps with no dependencies are ready immediately.

   b. **Hard Rule / exit gate:** Before writing any explanation or user-facing text, count the ready steps and count the Task() calls you are about to emit. These two numbers MUST be equal. If they are not, stop and fix the mismatch before proceeding.

   c. **Emit one Task() call per ready step — all in the same response.** This is what "parallel" means: multiple Task() calls sent simultaneously so Wolf instances run concurrently. Tell the user which steps are starting and that they are running in parallel (if more than one).

   d. **Wait for every Task() in the wave to finish.**

   e. **Report results for the wave.** Summarize what succeeded and what failed.

   f. **If any step in the wave failed**, stop execution and report the failure to the user. Do NOT continue to the next wave.

   g. **If all steps in the wave succeeded**, proceed immediately to the next wave (go back to step a). Do NOT pause to ask the user for confirmation or review.

   #### Task() call format

   Each Task() call must reference the full plan for context and target exactly one step:

   ```
   Task(
     subagent_type: "wolf",
     description: "Plan step 1: <short description>",
     prompt: "<Full plan context>\n\nImplement ONLY step 1: <detailed instructions for this single step>"
   )
   ```

   Example — a wave with two ready steps (step 1 and step 3 are independent):
   ```
   Task(
     subagent_type: "wolf",
     description: "Plan step 1: <desc>",
     prompt: "...Implement ONLY step 1..."
   )
   Task(
     subagent_type: "wolf",
     description: "Plan step 3: <desc>",
     prompt: "...Implement ONLY step 3..."
   )
   ```
   Steps 2 and 4 would form a later wave once their dependencies (steps 1 and 3) complete.

6. **After all steps are complete**, update the plan status to `completed` and save.

---

## Error Handling

| Scenario | Error Message |
|---|---|
| Plan not found | "No plan named '$1' found. Here are the available plans for this repo: ..." |
| Wolf task failure | "Step '<title>' failed. Stopping execution. Review the error and retry." |

## Important

- Always give Wolf the FULL plan context
- **NEVER combine multiple steps into one Task() call.** Each step gets its own Wolf task. This is non-negotiable.
- If a step fails, stop and report the failure. Don't continue blindly.
- Execute independent steps in parallel (one Task() per step, multiple Task() calls in one response). Proceed immediately to the next wave on success — do NOT pause to ask the user.
- Do NOT attempt git operations — remind the user to use `/commit` when they want to save progress
