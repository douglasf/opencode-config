---
description: Push commits to remote repository
---

You are tasked with pushing commits to the remote repository.

## Your Process

1. **Check current branch** with `git branch --show-current`
2. **Check remote tracking** with `git status` to see if branch tracks a remote
3. **Check if there are commits to push** with `git status` or `git log origin/branch..HEAD`
4. **Verify you're on the right branch** - confirm with the user if it's not main/master/dev
5. **Push the commits**:
   - Use `git push` if remote tracking is set up
   - Use `git push -u origin <branch>` if this is the first push for the branch
6. **Confirm success** by showing the push output

## Important Notes

- If there are no commits to push, inform the user
- If the branch doesn't have a remote tracking branch, set it up with `-u`
- If there are conflicts or the push is rejected, explain clearly and suggest solutions
- DO NOT force push unless explicitly instructed with `--force`
- Show the user what commits are being pushed before pushing

Arguments: You can optionally provide a branch name like `/push origin feature-branch` to push to a specific remote/branch.
