---
description: Create a pull request from current branch
---

You are tasked with creating a pull request for the user's changes.

## Your Process

1. **Verify git and branch status**:
   - Check current branch with `git branch --show-current`
   - Ensure commits are pushed to remote with `git status`
   - If not pushed, inform user they need to push first or ask if they want you to push

2. **Gather PR information**:
   - Review commit history with `git log origin/main..HEAD` (or origin/master)
   - Use `git diff main...HEAD` to see all changes since branching
   - Understand the full scope of changes

3. **Analyze changes** to understand:
   - What feature/fix/refactor was implemented
   - Why these changes were made
   - The impact on the overall project

4. **Create PR title and description**:
   - **Title MUST follow conventional commits format**: `<type>(<scope>): <subject>`
   - **If Jira ID provided, include it after the colon**: `<type>(<scope>): [JIRA-123] <subject>`
   - Description should include:
     - What changes were made and why
     - Key features or fixes included
     - Any breaking changes or migration notes
     - Testing performed or needed
     - Related issues (e.g., "Closes #123")
     - Jira link if applicable

5. **Create the PR** using `gh pr create`:
   - Set appropriate title following conventional commits format
   - Include comprehensive body/description
   - Target the correct base branch (usually main/master)

## PR Title Format (REQUIRED)

**Without Jira:** `<type>(<scope>): <subject>`
**With Jira:** `<type>(<scope>): [JIRA-ID] <subject>`

**Types (required):**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks
- `ci:` - CI/CD changes
- `build:` - Build system changes

**Examples:**
- `feat(auth): add OAuth2 login support`
- `fix(api): [PROJ-456] resolve null pointer in user endpoint`
- `refactor(database): [TEAM-789] simplify query builder`
- `docs(readme): update installation instructions`

## PR Description Format

Use this format unless the repo has a template:

```
## Summary
- Brief bullet points of what was changed and why

## Changes
- List key changes made

## Testing
- How this was tested

Closes #issue-number (if applicable)
```

## Important Notes

- Check if repo has a PR template in `.github/PULL_REQUEST_TEMPLATE.md`
- Ensure all commits are pushed before creating PR
- Default base branch is usually `main` or `master` - verify with `git remote show origin`
- Use `gh pr create --web` if you want to open browser for manual editing

Arguments: You can provide arguments in multiple formats:
- `/pr` - Generate title and description automatically
- `/pr "feat(auth): add OAuth2 support"` - Use specific title (must follow conventional commits)
- `/pr PROJ-123` - Include Jira ID in the generated title: `<type>(<scope>): [PROJ-123] <subject>`
- `/pr PROJ-123 "feat(auth): add OAuth2"` - Jira ID with custom title (will insert ID after colon)

When a Jira ID is provided, always place it in brackets after the colon and before the subject, and include a link in the PR description.
