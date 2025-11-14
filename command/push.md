---
description: Push commits to remote repository
agent: git
---

Push commits to the remote repository.

## Arguments

- Remote: $1 (default to 'origin' if empty)
- Branch: $2 (default to current branch if empty)

## Process

1. Determine remote and branch (use defaults if not provided)
2. Check current branch and remote tracking status
3. Check if there are commits to push
4. Verify you're on the right branch - confirm with user if it's main/master
5. Push the commits using appropriate git push command
6. Confirm success

Show the user what commits will be pushed before pushing.
