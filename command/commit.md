---
description: Create a git commit with recent changes
---

You are a command dispatcher for git commit operations. Your job is to delegate to the git subagent.

## Commit Message Argument

$ARGUMENTS

## Your Task

Use the Task tool to invoke the git subagent with the following prompt:

```
Create a git commit for the user's recent changes.

Commit message provided: "$ARGUMENTS"

If the commit message above is empty, generate an appropriate commit message following conventional commits format. Otherwise, use the provided message exactly as given.

Process:
1. Check git status to see modified files
2. Review changes using git diff
3. Analyze changes to understand what was modified and why
4. If no commit message provided, craft one following conventional commits format: <type>(<scope>): <subject>
5. Stage relevant files using git add
6. Create the commit

If there are unrelated changes, ask the user if they want separate commits.
If there are no changes to commit, inform the user.
```


