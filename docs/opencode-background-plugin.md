# opencode-background Plugin Reference (Wolf Guide)

> **Package**: `@zenobius/opencode-background` v0.2.0-alpha.2  
> **Source**: https://github.com/zenobi-us/opencode-background  
> **Purpose**: Manage long-running background processes from within OpenCode sessions.
>
> **Important — Actual Tool Names**: The plugin registers these exact tool names:
> `createBackgroundProcess`, `getBackgroundProcess`, `listBackgroundProcesss` (3 s's — typo in source), `killTasks`.
> The README uses `listBackgroundProcesses` and `killProcesses` but the real registered names differ.
> When invoking, use the **actual registered names** as they appear in the OpenCode tool list.

---

## Quick Decision: Background Process vs Direct Command

| Scenario | Use | Why |
|---|---|---|
| Command finishes quickly (<30s) | `bash` tool directly | No need for process management |
| Need output of a command to continue work | `bash` tool directly | Background processes don't block, so you can't wait for output |
| Long-running server/watcher (Gradle, dev server, test watcher) | `createBackgroundProcess` | Keeps it running without blocking the session |
| Process must survive session restarts | `createBackgroundProcess` with `global=true` | Global processes persist across sessions |
| One-shot build that takes a while | Either works | Background if you want to do other things while it runs |

**Rule of thumb**: If the process is meant to stay running while you do other work, use background. If you need its output to decide what to do next, run it directly.

---

## 1. Plugin Methods Reference

### `createBackgroundProcess`

Start a command as a background process with lifecycle tracking.

```
⚙ createBackgroundProcess
  command="./gradlew --continuous build"
  name="Gradle Build Server"
  tags=["gradle", "build-server"]
  global=false
```

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `command` | `string` | **Yes** | — | Shell command to execute (runs with `shell: true`) |
| `name` | `string` | No | Same as `command` | Human-readable name for identification |
| `tags` | `string[]` | No | `[]` | Tags for filtering/grouping processes |
| `global` | `boolean` | No | `false` | If `true`, survives session deletion; if `false`, killed when session ends |

**Returns**: `string` — The auto-generated process ID (format: `task-<random7chars>`)

**Notes**:
- The `sessionId` is automatically set from the calling context (`ctx.sessionID`)
- stdout and stderr are captured; stderr lines are prefixed with `[ERROR]`
- Output buffer retains all lines (last 100 returned when querying a specific task; last 10 when listing)

---

### `getBackgroundProcess`

Retrieve full details and output of a specific process.

```
⚙ getBackgroundProcess
  taskId="task-abc1234"
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `taskId` | `string` | **Yes** | The process ID returned from `createBackgroundProcess` |

**Returns**: JSON string with full process details including `outputStream` (last 100 lines).

---

### `listBackgroundProcesss` (actual registered name — note the triple 's')

List processes with optional filtering. All filters are optional and combine with AND logic (except tags, which use OR — any matching tag counts).

```
⚙ listBackgroundProcesss
  tags=["gradle", "build-server"]
  status="running"
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `sessionId` | `string` | No | Filter to processes from a specific session |
| `status` | `string` | No | Filter by status: `pending`, `running`, `completed`, `failed`, `cancelled` |
| `tags` | `string[]` | No | Filter by tags (OR logic: matches if process has ANY of the listed tags) |

**Returns**: JSON string — array of process objects (output truncated to last 10 lines per process).

---

### `killTasks` (actual registered name — README calls it `killProcesses`)

Terminate processes. Can target a specific process by ID, or filter to kill multiple.

```
⚙ killTasks
  tags=["gradle"]
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `taskId` | `string` | No | Kill a specific process by ID (takes priority — if set, filters are ignored) |
| `sessionId` | `string` | No | Kill processes in a specific session |
| `status` | `string` | No | Kill processes with a specific status |
| `tags` | `string[]` | No | Kill processes matching any of these tags |

**Returns**: JSON string — array of killed process IDs.

**Warning**: If you call `killTasks` with NO parameters, it matches ALL processes and kills everything. Always provide at least one filter.

---

## 2. Process Lifecycle

### States

```
pending → running → completed (exit 0)
                  → failed    (exit non-zero / error)
                  → cancelled (killed via killTasks or session cleanup)
```

### Session vs Global

| Type | `global` value | Behavior |
|---|---|---|
| **Session** (default) | `false` | Auto-killed when session ends. Use for processes tied to current work. |
| **Global** | `true` | Survives session deletion. Persists until explicitly killed or OpenCode closes. |

**For a Gradle server during development**: Use `global=false` (session-specific). The Gradle daemon will be tied to your active session. When you end the session, it's cleaned up automatically. You don't want orphaned Gradle daemons eating memory across sessions. If you specifically need the server to survive session switches (rare), then use `global=true`.

**Note**: ALL processes (including global) are killed when OpenCode itself closes. There is no true daemonization.

---

## 3. Concrete Examples

### Example A: Start a Gradle Continuous Build Server

This is the primary use case. Start Gradle in continuous mode so it watches for changes and rebuilds automatically.

```
⚙ createBackgroundProcess
  command="./gradlew --continuous build"
  name="Gradle Continuous Build"
  tags=["gradle", "build"]
  global=false
```

Then check on it later:

```
⚙ listBackgroundProcesss
  tags=["gradle"]
```

Or get full output:

```
⚙ getBackgroundProcess
  taskId="task-abc1234"
```

Kill it when done:

```
⚙ killTasks
  tags=["gradle"]
```

### Example B: Start a Test Watcher

```
⚙ createBackgroundProcess
  command="./gradlew test --continuous"
  name="Test Watcher"
  tags=["gradle", "test", "watcher"]
  global=false
```

### Example C: Start a Development Server

```
⚙ createBackgroundProcess
  command="npm run dev"
  name="Dev Server"
  tags=["server", "dev"]
  global=false
```

Then verify it's running and test it:

```
⚙ listBackgroundProcesss
  status="running"
  tags=["server"]
```

### Example D: Managing Multiple Processes with Tag Filtering

Start several processes:

```
⚙ createBackgroundProcess
  command="./gradlew --continuous build"
  name="Gradle Build"
  tags=["gradle", "build"]

⚙ createBackgroundProcess
  command="./gradlew test --continuous"
  name="Gradle Tests"
  tags=["gradle", "test"]

⚙ createBackgroundProcess
  command="npm run dev"
  name="Frontend Dev Server"
  tags=["frontend", "server"]
```

List only Gradle processes:

```
⚙ listBackgroundProcesss
  tags=["gradle"]
```

Kill only the test watcher but leave build running:

```
⚙ killTasks
  tags=["test"]
```

Kill everything Gradle-related:

```
⚙ killTasks
  tags=["gradle"]
```

---

## 4. Common Pitfalls

### DON'T: Call killTasks with no filters
```
# BAD — kills ALL background processes
⚙ killTasks
```
Always provide at least `taskId`, `tags`, or `sessionId`.

### DON'T: Expect to read process output synchronously
Background processes run asynchronously. You can't start a process and immediately read its full output. Use `getBackgroundProcess` after some time to check output, or use `listBackgroundProcesss` to check status.

### DON'T: Use `global=true` by default
Global processes accumulate across sessions. Only use global when you have a specific reason (e.g., a shared service multiple sessions need). For development workflows like Gradle builds, session-specific is correct.

### DON'T: Forget to check if a process is already running
Before starting a new Gradle server, list existing processes first:
```
⚙ listBackgroundProcesss
  tags=["gradle"]
```
If one is already running, don't start a duplicate.

### DON'T: Assume processes survive OpenCode restart
Even `global=true` processes are killed when OpenCode closes. Process state is in-memory only.

### DO: Always use descriptive names and tags
Tags are the primary mechanism for managing processes later. A process without tags is hard to filter and kill selectively.

### DO: Use `getBackgroundProcess` to check for errors
If a process status is `failed`, call `getBackgroundProcess` with the task ID to see the error details and last 100 lines of output for debugging.

---

## 5. Typical Gradle Workflow for Wolf

When the user asks to start a Gradle background process:

1. **Check for existing processes first**:
   ```
   ⚙ listBackgroundProcesss
     tags=["gradle"]
   ```

2. **If none running, start one**:
   ```
   ⚙ createBackgroundProcess
     command="./gradlew --continuous build"
     name="Gradle Continuous Build"
     tags=["gradle", "build"]
     global=false
   ```

3. **Periodically check status if needed**:
   ```
   ⚙ getBackgroundProcess
     taskId="<the-returned-id>"
   ```

4. **When done or switching tasks, clean up**:
   ```
   ⚙ killTasks
     tags=["gradle"]
   ```

This ensures no duplicate processes, clean lifecycle management, and easy identification via tags.
