---
description: Push commits to remote repository
agent: git
---

Push commits to the remote repository.

## Arguments

- Remote: $1 (default to 'origin' if empty)
- Branch: $2 (default to current branch if empty)

## Instructions

1. Check how many commits are ahead of the remote using `git rev-list --count @{u}..HEAD`
2. If there are commits to push, show them using `git log @{u}..HEAD --oneline`
3. IMPORTANT: Actually execute `git push` to push the commits to the remote
4. Confirm what was pushed (branch name and number of commits)

Example output: "Pushed 3 commits to origin/main"
