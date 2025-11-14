---
description: Create a git commit with recent changes
---

You are tasked with creating a git commit for the user's recent changes.

## Your Process

1. **Check git status** to see what files have been modified, added, or deleted
2. **Review the changes** using `git diff` to understand what has changed
3. **Analyze the changes** to understand:
   - What was modified and why
   - The scope and impact of the changes
   - Whether changes are related or should be split into multiple commits
4. **Craft a meaningful commit message** that:
   - **MUST follow conventional commits format**: `<type>(<scope>): <subject>`
   - Has a clear, concise subject line (50 chars or less)
   - Includes a detailed body if needed to explain the "why"
   - References issue numbers if applicable
5. **Stage the relevant files** using `git add`
6. **Create the commit** with your crafted message

## Conventional Commits Format (REQUIRED)

**Format:** `<type>(<scope>): <subject>`

**Types (required):**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, missing semicolons, etc.)
- `refactor:` - Code refactoring without feature changes
- `perf:` - Performance improvements
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks, dependency updates
- `ci:` - CI/CD configuration changes
- `build:` - Build system or external dependency changes
- `revert:` - Reverting a previous commit

**Scope (optional):** The area of the codebase affected (e.g., `auth`, `api`, `ui`, `database`)

**Examples:**
- `feat(auth): add OAuth2 login support`
- `fix(api): resolve null pointer exception in user endpoint`
- `docs(readme): update installation instructions`
- `refactor(database): simplify query builder logic`

**Additional Guidelines:**
- Use imperative mood ("add feature" not "added feature")
- Be specific and descriptive
- Focus on the "why" not just the "what"
- Breaking changes should include `BREAKING CHANGE:` in the body or use `!` after type (e.g., `feat!:`)

## Important Notes

- If there are unrelated changes, ask the user if they want separate commits
- If there are no changes to commit, inform the user
- DO NOT push automatically - that's a separate command
- If files aren't staged, stage them before committing

Arguments: You can optionally provide a commit message like `/commit "fix(auth): resolve login timeout bug"` to use a specific message instead of having the agent generate one. The message MUST follow conventional commits format.
