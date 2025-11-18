---
description: Create a git commit with recent changes
agent: git
---

Create a git commit for the user's recent changes.

## Amend Mode

First argument: $1

If the first argument is "amend", amend the previous commit instead of creating a new one.

## Commit Message

$ARGUMENTS

If a commit message is provided above (not empty), use it exactly as provided. Otherwise, generate an appropriate commit message following conventional commits format.

## Process

**If $1 is "amend":**
1. Check git status to see modified files
2. Review changes using git diff
3. Stage any modified files using git add
4. Amend the previous commit using `git commit --amend --no-edit`
5. Confirm the amendment was successful

**Otherwise (normal commit):**
1. Check git status to see modified files
2. Review changes using git diff
3. Analyze changes to understand what was modified and why
4. If no commit message provided, craft one following conventional commits format: `<type>(<scope>): <subject>`
5. Stage relevant files using git add
6. Create the commit

If there are unrelated changes, ask the user if they want separate commits.
If there are no changes to commit, inform the user.


