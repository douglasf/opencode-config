---
description: Manage TODO.md — update completed items from git history or add new entries
agent: marsellus
---

Manage the project's TODO.md file. This command has two modes based on arguments.

## Arguments

$ARGUMENTS

## Mode Detection

- **If `$ARGUMENTS` is empty** → **Update mode**: delegate to `todo` subagent
- **If `$ARGUMENTS` is non-empty** → **Add mode**: call `todo-add` tool

## Update Mode (`/todo`)

Delegate to the `todo` subagent to scan git history and update TODO.md:

```
Task(
  subagent_type: "todo",
  description: "Update TODO.md from git history",
  prompt: "Update mode: Read TODO.md and the last 30 git commits (git log --oneline -30). Match commits to pending TODO items. Check off any items that are clearly resolved and move them from the Pending section to the Completed section (preserving their original IDs). Fix any formatting issues. Report what you changed — items checked off and moved (with matching commit hash and message), formatting fixes, and any uncertain matches you chose not to check off."
)
```

Relay the subagent's report directly to the user.

## Add Mode (`/todo <description>`)

The user wants to add a new TODO entry. Analyze their description to determine:

- **title**: Extract a clean, concise title from `$ARGUMENTS`
- **priority**: Infer from language:
  - Words like "critical", "urgent", "breaking", "blocker" → `critical`
  - Words like "important", "should", "significant" → `important`
  - Default → `normal`
- **details**: The full description text, expanded if needed
- **section**: Default to `Pending` unless the description explicitly says "completed" or "done"

Then call the `todo-add` tool:

```
todo-add(
  title: "<extracted title>",
  section: "Pending",
  priority: "<inferred priority>",
  details: "<expanded description>"
)
```

Report the result to the user: what was added, the assigned ID, and where it was placed.

If the `todo-add` tool is not available, fall back to delegating to the `todo` subagent:

```
Task(
  subagent_type: "todo",
  description: "Add TODO entry",
  prompt: "Add mode: Add a new entry to TODO.md with the following details:\n\nTitle: <title>\nPriority: <priority>\nSection: Pending\nDetails: <details>\n\nGenerate the next ID, format the entry properly, and insert it in the correct subsection."
)
```

## Examples

- `/todo` → Scans git history, checks off completed items, fixes formatting
- `/todo Fix the broken auth token refresh in the middleware` → Adds a new Pending/important entry
- `/todo critical: Deploy pipeline fails on ARM64 builds` → Adds a new Pending/critical entry
- `/todo Add dark mode toggle to settings page` → Adds a new Pending/normal entry
