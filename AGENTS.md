# AGENTS.md

Guide for autonomous agents working in this repository.

## Repository Overview

This is a personal [OpenCode](https://opencode.ai) configuration repo living at `~/.config/opencode/`. It defines a multi-agent architecture with custom agents, slash commands, plugins, and a custom tool — all written in Markdown (agent/command definitions) and TypeScript (plugins/tools). There is no application code; the deliverables are configuration files.

## Build, Lint & Test

### Package Manager

**Bun** is the package manager. The lockfile is `bun.lock`. Do not use npm, yarn, or pnpm.

```bash
bun install          # install dependencies (only @opencode-ai/plugin today)
```

### No Build Step

There is no build command. Agent definitions are Markdown, configs are JSONC, and plugin/tool TypeScript files are loaded directly by the OpenCode runtime. No transpilation, bundling, or compilation is needed.

### No Linter or Formatter

There are no ESLint, Prettier, Biome, or other lint/format configurations. Maintain consistency with the existing files manually. See the Code Style section below.

### No Test Suite

There are no tests or test runner. If you add a plugin or tool, verify it works by reading the OpenCode plugin SDK types and ensuring the code type-checks conceptually against `@opencode-ai/plugin`.

### Running a Single Test

Not applicable — there are no tests. If tests are added in the future, document the single-test command here.

## Project Structure

```
~/.config/opencode/
  opencode.jsonc          # Global config (strict mode — default for all repos)
  opencode-yolo.jsonc     # Relaxed config (YOLO mode — opt-in per repo via symlink)
  package.json            # Sole dependency: @opencode-ai/plugin
  bun.lock                # Bun lockfile
  agent/                  # Agent definitions (.md with YAML frontmatter)
    marsellus.md          #   Orchestrator — delegates, never works directly
    wolf.md               #   Executor — reads, writes, edits, runs commands
    vincent.md            #   Investigator — deep read-only codebase analysis
    architect.md          #   Planner — investigation + structured plan docs
    jules.md              #   Planning coordinator — interviews user, delegates to Architect
    git.md                #   Git specialist — commits, pushes, PRs (slash-command only)
    quick-answer.md       #   Fast concise answers (no tools except webfetch)
  command/                # Slash command definitions (.md)
    commit.md             #   /commit — smart atomic commit grouping
    push.md               #   /push — push to remote
    pr.md                 #   /pr — create pull request
    review.md             #   /review <PR#> — code review
    quick.md              #   /quick — quick-answer mode
    plan-list.md          #   /plan-list — list plans for current repo
    plan-implement.md     #   /plan-implement <name> — execute a plan
    plan-update.md        #   /plan-update <name> — update a plan
  plugins/                # Custom plugins (TypeScript)
    copilot-usage.ts      #   GitHub Copilot premium-quota monitor
  tools/                  # Custom tools (TypeScript)
    progress.ts           #   Real-time progress reporting via TUI title
  docs/                   # Design docs and analysis
```

## Code Style

### File Formats

| Content type | Format | Notes |
|---|---|---|
| Agent definitions | Markdown + YAML frontmatter | Frontmatter has `description`, `mode`, `model`, `tools`, `permission` |
| Slash commands | Markdown + YAML frontmatter | Frontmatter has `description`, `agent` |
| Config | JSONC (`*.jsonc`) | JSON with `//` comments |
| Plugins & tools | TypeScript (`.ts`) | Loaded directly by the OpenCode Bun runtime |

### TypeScript Conventions (plugins/ and tools/)

- **Imports**: Use named imports from `@opencode-ai/plugin`. Use Node built-ins via `"fs"` and `"path"` (not `node:` prefix). Example: `import type { Plugin } from "@opencode-ai/plugin"`.
- **Typing**: Use explicit types for exports. Use `type` imports where possible (`import type { ... }`). Prefer `any` over `unknown` when the SDK demands loose typing (see `copilot-usage.ts`).
- **Naming**: `PascalCase` for exported plugin/tool constants. `camelCase` for local variables and functions. Descriptive names, no abbreviations.
- **Error handling**: Use try/catch with silent failures for non-critical operations (toasts, telemetry). Never let a plugin crash the host. Pattern: `catch { return null }` or `catch { /* silently fail */ }`.
- **Formatting**: 2-space indentation. No semicolons at import lines (follow existing convention). Double quotes for strings. No trailing commas in function args; trailing commas in object/array literals follow existing style.
- **Exports**: Plugins export a `Plugin`-typed const. Tools use the `tool()` factory from `@opencode-ai/plugin`.

### Markdown Conventions (agent/ and command/)

- YAML frontmatter is fenced with `---`.
- Permissions in frontmatter use `allow` / `deny` / `ask` keywords, NOT quoted strings.
- Agent markdown uses `#` for the agent title, `##` for major sections, `###` for subsections.
- Use tables for structured comparisons. Use code blocks for command examples.
- Keep instructions imperative and precise — agents execute these literally.

### JSONC Config Conventions

- Use section comment headers: `// ══════...` for major sections, `// ──────...` for subsections.
- Group related permission rules under comment headers describing the category.
- Permission patterns use glob-style matching: `"git status*": "allow"`.
- Always include a `$schema` key pointing to `https://opencode.ai/config.json`.

## Agent Architecture

Understanding the delegation model is essential before modifying any agent:

1. **Marsellus** (orchestrator) — receives user requests, delegates to Wolf or Vincent via `Task()`. Never reads code or runs commands (except read-only git). Cannot invoke the git agent.
2. **Wolf** (executor) — does all implementation work. Cannot delegate to other agents. Cannot run git write operations. Reports results to Marsellus.
3. **Vincent** (investigator) — deep read-only analysis. No write access, no builds, no delegating. Returns structured findings.
4. **Architect** — investigation + planning. Delegates to Vincent for research, writes plan documents to `.opencode/plans/`. Returns metadata only.
5. **Jules** (planning coordinator) — interviews user, delegates to Architect. Cannot read source code.
6. **Git** — only invoked via `/commit`, `/push`, `/pr`. Has full git write permissions. No file edit access.
7. **Quick-answer** — fast responses, only has `webfetch`.

### Key Constraints

- **Git operations are forbidden** for all agents except the git agent. Wolf, Vincent, Architect, and Jules must never run `git add`, `git commit`, `git push`, etc.
- **The orchestrator never does work.** Marsellus has no file read/write/edit/grep/glob tools. It only delegates via `Task()`.
- **Permission model is default-deny** in strict mode. Every allowed command must be explicitly whitelisted.
- **YOLO mode** (per-repo opt-in via symlink) relaxes permissions for personal projects but still denies dangerous operations (force-push, `rm -rf /`, `sudo`, cloud mutations).

## Dependency Management

- The only runtime dependency is `@opencode-ai/plugin` (currently 1.1.54).
- Install with `bun install`. The lockfile is `bun.lock` — always commit it.
- Do not add dependencies unless they are strictly needed for a new plugin/tool.
- The `node_modules/` directory is gitignored.

## Branching & Git Workflow

- Commit messages follow **conventional commits**: `<type>(<scope>): <subject>`.
- Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `perf`, `ci`, `build`.
- The `/commit` command auto-generates messages in this format with smart change grouping.
- Force-push is denied even in YOLO mode. Hard resets are denied.
- The `.opencode/` directory in any repo should never be committed (add to global gitignore).

## Security Modes

| | Strict (default) | YOLO (opt-in) |
|---|---|---|
| Activation | Automatic everywhere | Symlink `opencode-yolo.jsonc` into repo's `.opencode/opencode.jsonc` |
| Bash for Wolf | Default-deny, read-only whitelist | Default-ask, broad allow-list |
| Git mutations | Denied | Allowed (except force-push/hard-reset) |
| Docker/k8s | Build only | Full local access |
| Cloud CLIs | Denied | Read-only allowed, mutations ask/deny |

## Cursor / Copilot Rules

No `.cursorrules`, `.cursor/rules/`, or `.github/copilot-instructions.md` files exist in this repository. All AI agent behavior is configured via the agent Markdown files in `agent/` and the JSONC permission configs described above.

## Adding New Agents or Commands

1. **Agent**: Create `agent/<name>.md` with YAML frontmatter specifying `description`, `mode` (`primary` or `subagent`), `model`, `tools`, and `permission`. Add the agent to `opencode.jsonc` / `opencode-yolo.jsonc` if it needs model overrides or custom permissions.
2. **Command**: Create `command/<name>.md` with YAML frontmatter specifying `description` and optionally `agent` (which agent handles the command). The body is the command's instruction prompt.
3. **Plugin**: Create `plugins/<name>.ts` exporting a `Plugin`-typed const. Register it in `opencode.jsonc` under the `plugin` array.
4. **Tool**: Create `tools/<name>.ts` using the `tool()` factory. Tools are auto-discovered by the runtime.
