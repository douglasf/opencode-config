---
description: Review changes in a GitHub PR
model: github-copilot/claude-opus-4.5
---

Review the changes in a GitHub Pull Request, focusing ONLY on the diff between the PR's base and head.

## Arguments

- First argument: $1 (PR number - required)

## Process

1. **Fetch PR metadata and existing feedback** using:
   ```
   gh pr view $1 --json baseRefName,headRefName,title,body,comments,reviews
   ```
   Note any existing review comments to avoid duplicating feedback.

2. **Get the exact diff** of only the PR changes:
   ```
   gh pr diff $1
   ```
   This returns ONLY the changes in the PR, not everything merged to main.

3. **Review the changes** focusing on:
   - Code correctness and potential bugs
   - Security concerns
   - Performance implications
   - Code style and readability
   - Missing error handling
   - Test coverage considerations

4. **Provide feedback** in chat, organized by:
   - Critical issues (must fix)
   - Suggestions (nice to have)
   - Questions for the author
   - Positive observations

## Important

- Do NOT use `git diff` against the local working directory
- Always use `gh pr diff $1` to ensure you're reviewing exactly what's in the PR
- Skip feedback that duplicates existing PR comments/reviews
- This command does NOT require the branch to be checked out locally
