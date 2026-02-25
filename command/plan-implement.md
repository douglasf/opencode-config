---
description: Implement a plan (markdown or vault0 task hierarchy) by delegating steps to Wolf
agent: marsellus
---

Implement a plan step by step, delegating each step to Wolf. Supports two execution modes: markdown plans (existing) and vault0 task hierarchies (new).

## Arguments

- First argument: $1 (required)
  - **Markdown mode**: a plan name — kebab-case slug e.g. `add-sso-auth`
  - **Vault0 mode**: `vault0:<task-id>` — e.g. `vault0:01ARZ3NDEKTSV4RRFFQ69G5FAV`

## Argument Detection

Check if `$1` starts with `vault0:`:

- **If yes** → strip the `vault0:` prefix, treat the remainder as a task ID, and execute **Vault0 Mode**
- **If no** → treat `$1` as a markdown plan name and execute **Markdown Mode** (existing behavior)

Examples:
- `/plan-implement vault0-integration` → Markdown mode, plan name = `vault0-integration`
- `/plan-implement vault0:01ARZ3NDEKTSV4RRFFQ69G5FAV` → Vault0 mode, task ID = `01ARZ3NDEKTSV4RRFFQ69G5FAV`

---

## Execution Modes

### Markdown Mode (Backward Compatible)

```
/plan-implement <plan-name>
```

Resolves `.opencode/plans/<plan-name>.md` and executes using wave-based parallel step execution. No changes from existing behavior.

#### Markdown Process

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

### Vault0 Mode (New)

```
/plan-implement vault0:<task-id>
```

Loads a vault0 parent task and its subtask/dependency graph, then executes subtasks in dependency order using Marsellus's single-task-at-a-time execution model.

#### Vault0 Prerequisites

Before starting execution, verify vault0 is available:

1. Run `vault0-task-view` with the provided task ID.
2. If the tool errors or is unavailable, stop immediately:
   **"vault0 is not configured or not available in this repo. Ensure vault0 is installed and the repo has been initialized with vault0."**
3. If the task ID is not found, stop immediately:
   **"Task '<task-id>' not found or invalid. Verify the task ID and try again."**

#### Vault0 Process

> **⚠️ Fresh State Principle:** Tool outputs are **snapshots** that go stale immediately. The user may reorganize, reprioritize, cancel, or add tasks between tool calls. **Every iteration of the execution loop MUST query fresh state from vault0 — never rely on cached or earlier tool output to decide what to execute next.**

1. **Load the parent task (fresh query):**
   Use `vault0-task-view <task-id>` to get the parent task and all its subtasks, dependencies, and current statuses.

2. **Assess the task structure:**
   - The parent task is the high-level feature/goal
   - Subtasks are the individual implementation steps
   - Dependencies between subtasks encode execution order
   - Subtask statuses indicate what has already been completed (supports resumption)

3. **Execute subtasks in dependency order — single-task-at-a-time:**

   **Anti-bundling rule applies here too — NEVER combine multiple vault0 subtasks into one Task() call. One subtask = one Wolf task.**

   #### Execution loop

   Repeat until every subtask has status `done` or `in_review`, or a failure occurs:

   a. **Build the ready list (FRESH query required).** Call `vault0-task-view <parent-task-id>` to refresh all subtask statuses before determining readiness. **Do NOT reuse subtask statuses from a prior call — they may be stale.** A subtask is "ready" when:
      - Its status is NOT `done`, `cancelled`, `in_progress`, or `in_review`
      - ALL of its dependencies (upstream tasks) have status `done` **or `in_review`** (the review gate does not block dependent work — `in_review` means implementation is complete)
      - Subtasks with no dependencies and status `backlog` or `todo` are ready immediately

   b. **If no subtasks are ready and some are still incomplete**, the execution is blocked. Report the blockage to the user:
      **"Execution blocked — no subtasks are ready but <N> remain incomplete. Check for circular dependencies or failed prerequisite tasks."**

   c. **Pick the highest-priority ready subtask.** Priority order: `critical` > `high` > `normal` > `low`. Break ties by creation order (earlier first).

   d. **Assign the subtask to Wolf via a single Task() call:**

   ```
   Task(
     subagent_type: "wolf",
     description: "vault0 task: <subtask title>",
     prompt: "You are executing a vault0 task.\n\n## Parent Task\n<parent task title and description>\n\n## Your Task\nTask ID: <subtask-id>\nTitle: <subtask title>\nDescription: <subtask description>\nPriority: <priority>\n\n## Instructions\n1. Read the task details with `vault0-task-view <subtask-id>`\n2. Claim the task: `vault0-task-move(id: '<subtask-id>', status: 'in_progress')`\n3. Implement the work described in the task\n4. When complete, submit for review: `vault0-task-move(id: '<subtask-id>', status: 'in_review')` — do NOT move to done, the review gate handles that\n5. Report back what you accomplished, any issues, and any observations\n\nImplement ONLY this single task. Do not work on other tasks."
   )
   ```

   e. **Wait for Wolf to complete and report back.**

   f. **Check the result:**
      - If Wolf succeeded → **mandatory**: refresh the task state via `vault0-task-view <parent-task-id>` to get current statuses before continuing to the next iteration (step a). Do NOT skip this refresh — the board may have changed during Wolf's execution.
      - If Wolf failed → stop execution and report the failure to the user. Do NOT continue to the next subtask.

   g. **Report progress after each subtask.** Tell the user:
      - Which subtask just completed (or failed)
      - How many subtasks remain
      - What's coming next (if continuing)
      - Remind them they can watch vault0's TUI for real-time status

4. **After all subtasks are complete**, report success:
   **"All <N> subtasks of '<parent task title>' have been implemented and are ready for review."**
   Remind the user to:
   - Use `/commit` to save their progress (this will also automatically approve all `in_review` tasks)

#### Why Single-Task-at-a-Time (Not Parallel Waves)

Vault0 mode uses sequential single-task execution instead of parallel waves because:
- Vault0's dependency graph may have complex inter-task relationships that don't map cleanly to discrete waves
- Single-task execution gives Wolf full context and avoids merge conflicts between parallel implementations
- Status updates in vault0 are real-time — the user sees progress incrementally in the TUI
- Marsellus can reassess the ready list after each completion, adapting to any changes

---

## Error Handling

| Scenario | Error Message |
|---|---|
| Markdown plan not found | "No plan named '$1' found. Here are the available plans for this repo: ..." |
| Vault0 not available | "vault0 is not configured or not available in this repo. Ensure vault0 is installed and the repo has been initialized with vault0." |
| Task ID not found | "Task '<task-id>' not found or invalid. Verify the task ID and try again." |
| Execution blocked (no ready subtasks) | "Execution blocked — no subtasks are ready but N remain incomplete. Check for circular dependencies or failed prerequisite tasks." |
| Wolf task failure | "Subtask '<title>' (ID: <id>) failed. Stopping execution. Review the error and retry with `/plan-implement vault0:<parent-id>`." |

## Important

- Always give Wolf the FULL context — for markdown mode, the full plan; for vault0 mode, the parent task details and subtask description
- **NEVER combine multiple steps/subtasks into one Task() call.** Each step or subtask gets its own Wolf task. This is non-negotiable.
- If a step/subtask fails, stop and report the failure. Don't continue blindly.
- In markdown mode: execute independent steps in parallel (one Task() per step, multiple Task() calls in one response). Proceed immediately to the next wave on success — do NOT pause to ask the user.
- In vault0 mode: execute one subtask at a time. Refresh the task state after each completion to get the latest dependency/status information.
- Do NOT attempt git operations — remind the user to use `/commit` when they want to save progress
- Vault0 mode supports **resumption** — if execution was interrupted, re-running `/plan-implement vault0:<task-id>` will skip already-completed subtasks and resume from the next ready one
