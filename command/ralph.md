---
description: Start autonomous work loop on a task
agent: michael
---

Start working autonomously on a vault0 task until completion.

## Arguments
$ARGUMENTS

The argument must be a vault0 task ID (ULID format: starts with `01`, 26 alphanumeric chars).

## Execution Steps

1. **Validate the task ID format.** If `$ARGUMENTS` doesn't match a ULID pattern (`01[A-Z0-9]{24}`), reply with an error: "Usage: /ralph <taskId>"

2. **Validate the task exists.** Use `vault0_task-view` to look up the task. If the task doesn't exist, reply with an error: "Task not found: <taskId>"

3. **Move the task to in_progress.** Use `vault0_task-move`:
   ```
   vault0_task-move(id: "<taskId>", status: "in_progress")
   ```

4. **Delegate to Ralph Agent.** Use the Task tool to hand off all orchestration:
   ```
   Task(subagent_type="ralph", prompt="taskId: <taskId>")
   ```
   Ralph Agent will handle everything: creating its own tracking task, reading the work task, planning, delegating to Jim/Dwight, detecting completion, running verification, and reporting back.

5. **Relay the result.** When Ralph Agent returns, relay its result summary to the user.
