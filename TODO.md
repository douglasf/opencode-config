# TODO

## Pending

### Critical Fixes

- [ ] **F1: Fix `/plan-list` command broken state** — Add `agent: marsellus` to frontmatter and rewrite instructions to use `read` tool instead of `ls` (command/plan-list.md). Command currently falls back to Marsellus who can't run bash. Alternatively route to `jules` agent who has bash access.

- [ ] **F2: Rewrite `/plan-update` command** — Currently tells Jules to update plan herself, but Jules lacks write permissions and role forbids this work. Step 2 should be a `Task(subagent_type="architect", ...)` delegation instead of direct action (command/plan-update.md).

- [ ] **F3: Restrict YOLO Wolf task delegation** — Change `opencode-yolo.jsonc` line 505 from `"task": "allow"` to `"task": { "*": "ask", "vincent": "allow", "git": "deny" }` to prevent Wolf from delegating to git agent directly without user slash commands.

### Important Fixes

- [ ] **F4: Remove Jules' unrestricted `cat` access** — Replace `cat *: allow` with `cat .opencode/plans/*: allow` in agent/jules.md line 26 to match read tool restrictions and prevent source code access.

- [ ] **F5: Add guardrails to git agent branch operations** — Add explicit denies for `git branch -D*` and `git branch -M*` in agent/git.md line 22, or document as accepted risk.

- [ ] **F6: Explicit tool declarations for Wolf and Git agents** — Add explicit `tools:` blocks to agent/wolf.md and agent/git.md instead of relying on defaults. Every other agent explicitly declares its tools.

- [ ] **F7: Restrict Architect write access** — Add write path restriction in agent/architect.md: `write: { ".opencode/plans/*": allow, "*": deny }` to match edit scope restrictions.

- [ ] **F8: Check that YOLO conf is still in line with its intent** — Audit the YOLO mode configuration (opencode-yolo.jsonc) to ensure it still aligns with its original design philosophy and intent. Review permission grants, tool access levels, and agent capabilities to verify they match the intended relaxed-but-safe model.

- [ ] **F9: Move TODO.md to .opencode/ directory for local tracking** — Relocate TODO.md from the repository root to .opencode/TODO.md so that TODO items are treated as local workspace state rather than version-controlled project artifacts. This keeps personal task tracking separate from committed project files. May require updating any scripts or tools that reference the root-level TODO.md path, and adding .opencode/TODO.md to .gitignore if not already present.

- [ ] **F10: Testing tools**

## Completed
