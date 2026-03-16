---
description: Start autonomous work loop on a task
agent: orchestrate
---

Start working autonomously on a vault0 task until completion.

## Arguments
$ARGUMENTS

The argument must be a vault0 task ID (ULID format: starts with `01`, 26 alphanumeric chars).

## Execution Steps

1. **Validate the task ID format.** If `$ARGUMENTS` doesn't match a ULID pattern (`01[A-Z0-9]{24}`), reply with an error: "Usage: /ralph <taskId>"

2. **Delegate to Ralph Agent.** Pass only the taskId — Ralph discovers everything else via tools:
   ```
   Task(subagent_type="ralph", prompt="taskId: <taskId>")
   ```

3. **Relay the result.** When Ralph Agent returns, relay its result summary to the user.
