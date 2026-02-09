# OpenCode Configuration

Personal OpenCode setup with custom agents, commands, and plugins. Lives at `~/.config/opencode/` and provides global defaults for all projects.

## Good Usage

This config uses a **multi-agent architecture**. When you type in OpenCode, you're talking to the **orchestrator** (Marsellus) — it never does work itself. Instead, it delegates to specialized agents: **Wolf** (reads, writes, searches, runs commands — all the actual work), **git** (commits, pushes, PRs — only via slash commands), and **quick-answer** (fast, concise responses with no deep investigation). The orchestrator breaks your request into subtasks, dispatches them to Wolf (in parallel when possible), and synthesizes the results.

You can also switch to the **Jules** agent (via tab) when you want to think through a feature or design before building. Jules interviews you about what you want to build, delegates investigation and planning to the **Architect** (who uses **Vincent** for deep analysis), and presents concise metadata summaries. You iterate with Jules on scope and decisions — then hand off to Wolf for implementation when ready.

### Day-to-Day Workflow

- **Ask a question or request a change** — just type naturally. The orchestrator will delegate to wolf, which investigates and executes autonomously. You don't need to manage the agents yourself.
- **Quick lookups** — use `/quick how do I do X` for fast, direct answers without the full investigation cycle. Great for syntax reminders, port numbers, or quick factual questions.
- **Planning** — switch to the **Jules** tab when you need to think through something bigger: a new feature, architectural change, or multi-step refactor. Describe what you want and Jules will guide you through a structured planning process, producing a plan document you can implement later.
- **Code changes** — describe what you want changed and where. Wolf will read the relevant files, make edits, and run tests if appropriate. Review the changes before committing.
- **Committing** — the orchestrator will *never* commit on its own. When you're happy with the changes, use `/commit` to stage and commit with an auto-generated message. Use `/push` and `/pr` for the rest of the git workflow.
- **Code review** — use `/review` to get a review of your staged or unstaged changes before committing.

### Strict vs YOLO Mode

By default, **strict mode** is active everywhere — the AI cannot run arbitrary commands or edit files without guardrails. This is what you want for work repos. For personal projects where speed matters more than safety, you can enable **YOLO mode** per repo (see instructions below). You can check which mode is active by looking for a `.opencode/opencode.jsonc` symlink in the project root.

### Things to Know

- The orchestrator speaks in the style of Winston Wolf from Pulp Fiction. This is intentional — don't be alarmed.
- Wolf reports back what it did but does not commit. You always control when changes are committed.
- If you're in strict mode and wolf says it can't run a command, that's the guardrails working. Either switch to YOLO mode or run the command yourself.
- Slash commands (`/commit`, `/push`, `/pr`, `/review`, `/quick`) are the primary way to trigger specific workflows. Type `/` to see what's available.

## Structure

```
~/.config/opencode/
  opencode.jsonc          # Global config (strict mode — default)
  opencode-yolo.jsonc     # Relaxed config (YOLO mode — opt-in per repo)
  agents/                 # Agent definitions (marsellus.md, wolf.md, vincent.md, jules.md, architect.md, git.md, quick-answer.md)
  command/                # Slash commands (/commit, /push, /pr, /review, /quick)
  plugins/                # Custom plugins (copilot-usage)
  docs/                   # Design docs and analysis
```

## Security Modes

This configuration supports two security modes for OpenCode:

| | **Strict** (default) | **YOLO** (opt-in) |
|---|---|---|
| **Bash access** | Denied (except read-only git commands) | Allowed |
| **File editing** | Restricted | Allowed |
| **Agent permissions** | Locked down | Relaxed |
| **Use case** | Work repos, shared projects, anything with risk | Personal repos, experiments, throwaway projects |

**Strict mode** is the global default — it applies automatically to every project unless overridden. The orchestrator can only delegate to wolf and cannot run arbitrary commands.

**YOLO mode** relaxes these restrictions for repos where you trust the AI to operate freely. It's designed for personal projects where speed matters more than guardrails.

### Enabling YOLO Mode in a Repo

YOLO mode uses a symlink so that all repos share a single source of truth. When you update `opencode-yolo.jsonc`, every YOLO-enabled repo picks up the change automatically.

```bash
# In the repo where you want YOLO mode:
mkdir -p .opencode
ln -s ~/.config/opencode/opencode-yolo.jsonc ./.opencode/opencode.jsonc
```

That's it. OpenCode reads `.opencode/opencode.jsonc` from the project directory, follows the symlink, and loads the relaxed config.

### Preventing Accidental Commits

The `.opencode` directory should **not** be committed to any repo. Add it to your global gitignore so it's ignored everywhere:

```bash
# One-time setup
echo ".opencode" >> ~/.gitignore_global
git config --global core.excludesfile ~/.gitignore_global
```

This ensures the YOLO symlink (and any other `.opencode` artifacts) never leak into version control.

### When to Use Each Mode

**Use strict mode** (do nothing — it's the default) when:
- Working on shared or team repositories
- Contributing to open-source projects
- Working with production code or sensitive data
- You want the AI to ask before running commands

**Use YOLO mode** when:
- Working on personal side projects
- Prototyping or experimenting
- Working in disposable repos (e.g., learning, demos)
- You trust the AI to run builds, tests, and edits without confirmation

### Verifying Which Mode Is Active

```bash
# Check if a YOLO symlink exists in the current project:
ls -la .opencode/opencode.jsonc

# If it's a symlink pointing to opencode-yolo.jsonc → YOLO mode
# If it doesn't exist → Strict mode (global defaults)
```

To disable YOLO mode in a repo, remove the symlink:

```bash
rm .opencode/opencode.jsonc
```

The repo immediately falls back to strict global defaults.

## Agents

- **marsellus** (default) — The orchestrator. Delegates everything to wolf, vincent, or architect. Never does work itself.
- **jules** (Jules) — The planning coordinator. Switch to this tab when you need to design before you build. Interviews you about what you want, delegates investigation and planning to the Architect, presents metadata summaries, and iterates until the plan is right. Never sees code.
- **architect** — The investigation-and-planning engine. Combines deep codebase analysis (via Vincent) with structured plan creation. Receives requests from Jules or Marsellus, investigates, writes complete plan documents to disk, and returns only metadata summaries. Powered by Claude Opus.
- **vincent** — The investigator. Deep codebase analyst powered by Claude Opus. Read-only — explores code, traces dependencies, and returns structured findings. The Architect's research arm.
- **wolf** — The executor. Reads, writes, searches, runs commands. Does all the actual work.
- **git** — Handles commits, pushes, and PRs. Only invoked via slash commands.
- **quick-answer** — Fast, concise answers without deep investigation.

## Slash Commands

- `/commit` — Stage and commit changes with an auto-generated message
- `/push` — Push current branch to remote
- `/pr` — Create a pull request
- `/review` — Code review of staged/unstaged changes
- `/quick` — Quick answer mode
- `/plan-list` — List all plans for the current repo
- `/plan-implement <plan-name>` — Implement a plan step by step (delegates to Wolf)
- `/plan-update <plan-name>` — Load a plan and update it through conversation

## Plan Storage

Plans are stored at `.opencode/plans/` in the repo root as markdown files. Plans are project-scoped — each repo has its own plan directory. Use `/plan-list` to see plans for the current repo.
