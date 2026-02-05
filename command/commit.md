---
description: Create git commit(s) with intelligent change grouping
agent: git
---

Create git commit(s) for the user's recent changes, using intelligent file-level and chunk-level grouping to produce clean, atomic commits.

## Amend Mode

First argument: $1

If the first argument is "amend", amend the previous commit instead of creating a new one. Skip all grouping logic and go directly to the Amend Process below.

## Commit Message

$ARGUMENTS

If a commit message is provided above (not empty and not "amend"), use it exactly as provided and skip the grouping workflow -- stage all changes and create a single commit with that message.

## Amend Process

**If $1 is "amend":**
1. Check git status to see modified files
2. Review changes using git diff
3. Stage any modified files using git add
4. Amend the previous commit using `git commit --amend --no-edit`
5. Confirm the amendment was successful

---

## Smart Commit Workflow (no message provided, not amend)

When no commit message is given, analyze changes deeply and group them into atomic, meaningful commits.

### Phase 1: Gather All Changes

1. Run `git status --porcelain` to get all changed, staged, and untracked files
2. Run `git diff` to get the full unstaged diff (with hunks)
3. Run `git diff --cached` to get any already-staged changes
4. Run `git log --oneline -5` to see recent commit style for context
5. If there are no changes at all, inform the user and stop

### Phase 2: Analyze Changes at Two Granularities

#### File-Level Analysis
For each changed file, determine:
- **What kind of file it is**: source code, test, config, docs, migration, types/interfaces, CI/CD, dependency manifest
- **What module/feature area it belongs to**: infer from directory structure, naming, imports
- **What the nature of the change is**: new file, modification, deletion, rename

#### Chunk-Level (Hunk) Analysis
Parse the unified diff output to identify individual hunks within each file. For each hunk, determine:
- **Semantic intent**: Is this hunk adding a feature, fixing a bug, refactoring, updating types, adjusting config, etc.?
- **Relationship to other hunks**: Does this hunk in file A relate to a hunk in file B? (e.g., a function added in `src/utils.ts` and its usage added in `src/handler.ts`)
- **Independence**: Could this hunk be committed separately from other hunks in the same file?

Key signals for grouping hunks together:
- Shared function/variable names across files
- Import additions that correspond to new exports in another file
- Test files that test functionality added/changed in source files
- Type definitions that match new structures in implementation files
- Related config changes (e.g., adding a dependency + importing it)

### Phase 3: Form Semantic Groups

Group changes into commit candidates based on semantic intent. Each group should represent ONE logical change. Common grouping patterns:

| Group Type | Typical Contents |
|---|---|
| **Feature** | New implementation files + their tests + type updates + related config |
| **Fix** | Bug fix hunks + test updates that verify the fix |
| **Refactor** | Restructured code across files that achieves the same behavior |
| **Chore** | Dependency updates, CI config, linting, formatting |
| **Docs** | Documentation files, README updates, comment improvements |
| **Types** | Type/interface changes that don't affect runtime behavior |
| **Test** | New or updated tests without corresponding source changes |
| **Style** | Formatting-only changes, whitespace, import ordering |

**Rules for grouping:**
- A test file should be in the SAME group as the source code it tests, not a separate "test" group
- If a single file contains hunks with different intents (e.g., a bug fix AND a formatting cleanup), split them into separate groups at the hunk level
- If ALL changes are clearly one logical unit, keep them as a single group (don't over-split)
- Prefer fewer, cohesive groups over many tiny ones -- each group should be a meaningful unit of work
- Untracked files that are clearly related (e.g., a new feature file + its test) go in the same group
- Keep related dependency/config changes with the code that needs them

### Phase 4: Present Groups for User Confirmation

Present the proposed commit plan to the user in a clear format:

```
I've analyzed your changes and propose the following commit(s):

**Commit 1/N**: `feat(auth): add JWT token refresh logic`
  - src/auth/refresh.ts (new file)
  - src/auth/refresh.test.ts (new file)
  - src/auth/types.ts (hunks: added RefreshToken interface)

**Commit 2/N**: `fix(api): handle null response in user endpoint`
  - src/api/users.ts (hunks: null check in getUser)
  - src/api/users.test.ts (hunks: added null response test)

**Commit 3/N**: `chore(deps): update lodash to 4.17.21`
  - package.json (hunks: lodash version)
  - package-lock.json (modified)

Shall I proceed with this plan? You can also:
- Ask me to merge groups (e.g., "merge 1 and 2")
- Ask me to split a group further
- Ask me to move files/hunks between groups
- Ask me to change a commit message
```

**Wait for user confirmation before executing any commits.** If the user wants adjustments, update the plan and re-present it.

If there is only one logical group, you can simplify: just show the single proposed commit message and file list, and ask for a quick confirmation.

### Phase 5: Execute Commits

Execute each group as a separate commit, **in dependency order** (base changes before dependent changes).

#### For file-level groups (entire files belong to one group):
```bash
git add <file1> <file2> ...
git commit -m "<type>(<scope>): <subject>"
```

#### For hunk-level groups (only specific hunks from a file):
When a file's hunks are split across multiple groups, use patch-based staging:

```bash
# Generate a patch file containing only the relevant hunks
git diff <file> > /tmp/full.patch
# Manually construct a patch with only the target hunks, or use:
git diff <file> | <extract relevant hunks> > /tmp/group.patch
git apply --cached /tmp/group.patch
```

**Preferred approach for hunk-level staging:** Use `git add -p` logic via scripted input, or more reliably:

1. For each hunk group, create a temporary patch file containing only the relevant hunks from the unified diff
2. Apply it to the index: `git apply --cached <patch_file>`
3. Commit: `git commit -m "<message>"`
4. Clean up temp files

**Practical fallback:** If hunk-level splitting is complex and error-prone for the specific changes, fall back to file-level grouping and note this to the user. Correctness is more important than granularity.

#### After all commits:
1. Run `git log --oneline -N` (where N is the number of commits created) to show what was committed
2. Report summary: "Created N commits: [list of commit subjects]"
3. Check `git status` to confirm no unintended leftover changes (or report what's left uncommitted)

### Commit Message Format

Always use conventional commits: `<type>(<scope>): <subject>`

- **type**: feat, fix, refactor, chore, docs, test, style, perf, ci, build
- **scope**: module or area affected (infer from file paths, keep short)
- **subject**: imperative mood, lowercase, no period, concise (<72 chars)

Examples:
- `feat(auth): add JWT token refresh mechanism`
- `fix(api): handle null response in user endpoint`
- `refactor(db): extract connection pooling into separate module`
- `chore(deps): update lodash to 4.17.21`
- `test(utils): add edge case tests for date parsing`

---

## Edge Cases

- **No changes**: Inform user "Nothing to commit -- working tree clean"
- **Only staged changes**: Include them in the analysis (they may have been intentionally staged)
- **Only untracked files**: Ask if they should be committed or if any should be gitignored
- **Single trivial change**: Don't over-engineer -- just propose one commit
- **Merge conflicts present**: Warn the user and do not attempt to commit
- **Files that look like secrets** (.env, credentials, keys): Warn the user and exclude from commits unless explicitly confirmed
