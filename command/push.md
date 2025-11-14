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
2. Check if the local branch has diverged from remote using `git rev-list --count HEAD..@{u}`
3. If the branches have diverged (step 2 returns > 0):
   - Explain to the user that the local and remote branches have diverged
   - Show the diverged commits from both local (`git log @{u}..HEAD --oneline`) and remote (`git log HEAD..@{u} --oneline`)
   - Explain why a force push might be needed (e.g., amended commits, rebased history)
   - Ask the user: "Do you want to force push? This will overwrite the remote branch history. (yes/no)"
   - If the user says yes/y, proceed with `git push --force-with-lease`
   - If the user says no/n, abort and inform them the push was cancelled
4. If there are commits to push and no divergence, show them using `git log @{u}..HEAD --oneline`
5. IMPORTANT: Actually execute `git push` (or `git push --force-with-lease` if confirmed in step 3) to push the commits to the remote
6. Confirm what was pushed (branch name and number of commits)

Example output: "Pushed 3 commits to origin/main"
Example force push output: "Force pushed 2 commits to origin/main (overwrote 1 remote commit)"
