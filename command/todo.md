---
description: Manage TODO.md — update completed items from git history or add new entries
agent: marsellus
---

Manage the project's TODO.md file. This command has two modes based on whether arguments are provided.

## Arguments

$ARGUMENTS

## Routing — Read This First

Check `$ARGUMENTS` above. Your behavior depends entirely on whether it is empty or not:

- **`$ARGUMENTS` is empty** → go to **Update Mode** below (delegate to `todo` subagent)
- **`$ARGUMENTS` is non-empty** → go to **Add Mode** below (you call `todo-add` directly — do NOT delegate)

## Update Mode (`/todo` with no arguments)

Delegate to the `todo` subagent to scan git history and update TODO.md:

```
Task(
  subagent_type: "todo",
  description: "Update TODO.md from git history",
  prompt: "Update mode: Read TODO.md and the last 30 git commits (git log --oneline -30). Match commits to pending TODO items. Check off any items that are clearly resolved and move them from the Pending section to the Completed section (preserving their original IDs). Fix any formatting issues. Report what you changed — items checked off and moved (with matching commit hash and message), formatting fixes, and any uncertain matches you chose not to check off."
)
```

Relay the subagent's report directly to the user.

## Add Mode (`/todo <idea>` with arguments)

**You handle this yourself. Do NOT delegate to any subagent.**

The user's idea is in `$ARGUMENTS`. Expand on it — flesh out the idea into a clear, actionable description. Then determine:

- **title**: A clean, concise title distilled from the user's idea
- **priority**: Infer from the language:
  - Words like "critical", "urgent", "breaking", "blocker" → `critical`
  - Words like "important", "should", "significant" → `important`
  - Default → `normal`
- **details**: The user's idea expanded into a fuller description — add context, clarify intent, suggest scope. Make it useful for whoever picks it up later.
- **section**: Always `Pending` (unless the user explicitly says "completed" or "done")

Call the `todo-add` tool directly:

```
todo-add(
  title: "<extracted title>",
  section: "Pending",
  priority: "<inferred priority>",
  details: "<expanded description>"
)
```

Report the result to the user: what was added, the assigned ID, and where it was placed.

## Examples

- `/todo` → Update mode: delegates to todo subagent, scans git history, checks off completed items
- `/todo Fix the broken auth token refresh in the middleware` → Add mode: Marsellus calls todo-add directly with priority "important"
- `/todo critical: Deploy pipeline fails on ARM64 builds` → Add mode: Marsellus calls todo-add directly with priority "critical"
- `/todo Add dark mode toggle to settings page` → Add mode: Marsellus calls todo-add directly with priority "normal"
