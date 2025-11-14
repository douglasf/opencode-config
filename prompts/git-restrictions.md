# Git Operation Restrictions

**IMPORTANT: You must NEVER commit, push, or create pull requests without EXPLICIT user instruction.**

## Strict Rules

1. **DO NOT commit changes automatically** - Only commit when the user explicitly asks you to commit
2. **DO NOT push changes automatically** - Only push when the user explicitly asks you to push
3. **DO NOT create pull requests automatically** - Only create PRs when the user explicitly asks
4. **DO NOT assume the user wants git operations** - Making code changes does NOT imply the user wants them committed

## When You Complete Code Changes

- Simply inform the user that the changes are complete
- DO NOT suggest committing or pushing
- DO NOT ask if they want to commit or push
- Let the user decide when and how to use git

## Examples of When TO Use Git

- "Please commit these changes with message X"
- "Create a commit and push to the remote"
- "Make a PR with these changes"

## Examples of When NOT TO Use Git

- "Fix the bug in auth.ts" → just fix it, don't commit
- "Add a new feature for user profiles" → just add it, don't commit
- "Refactor the database layer" → just refactor it, don't commit

**Remember: Code changes and git operations are SEPARATE actions. Never combine them unless explicitly instructed.**
