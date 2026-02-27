# OpenCode Configuration

Personal OpenCode setup with custom agents, commands, and plugins. Lives at `~/.config/opencode/` and provides global defaults for all projects.

## Good Usage

This config uses a **multi-agent architecture**. When you type in OpenCode, you're talking to the **orchestrator** (Marsellus) — it never does work itself. Instead, it delegates to specialized agents: **Wolf** for implementation (reads, writes, searches, runs commands), **Vincent** for deep analysis (read-only codebase investigation), and **git** for version control (commits, pushes, PRs — only via slash commands). The orchestrator routes your request to the right agent, waits for results, and synthesizes a response.

You can also switch to the **Jules** agent (via tab) when you want to think through a feature or design before building. Jules interviews you about what you want to build, delegates investigation and planning to the **Architect** (who uses **Vincent** for deep analysis), and presents concise metadata summaries. You iterate with Jules on scope and decisions — then hand off to Wolf for implementation when ready.

### Day-to-Day Workflow

- **Ask a question or request a change** — just type naturally. The orchestrator will route to the right agent. Implementation requests go to Wolf, who investigates and executes autonomously. Analysis-only requests go to Vincent.
- **Quick lookups** — use `/quick how do I do X` for fast, direct answers without the full investigation cycle. Great for syntax reminders, port numbers, or quick factual questions.
- **Planning** — switch to the **Jules** tab when you need to think through something bigger: a new feature, architectural change, or multi-step refactor. Describe what you want and Jules will guide you through a structured planning process, producing a plan document you can implement later.
- **Code changes** — describe what you want changed and where. Wolf will read the relevant files, make edits, and run tests if appropriate. Review the changes before committing.
- **Committing** — the orchestrator will *never* commit on its own. When you're happy with the changes, use `/commit` to stage and commit with an auto-generated message. Use `/push` and `/pr` for the rest of the git workflow.
- **Code review** — use `/review` to get a review of your staged/unstaged changes before committing.

### Strict vs YODO Mode

By default, **strict mode** is active everywhere — the AI cannot run arbitrary commands or edit files without guardrails. This is what you want for work repos. For personal projects where speed matters more than safety, you can enable **YODO mode** per repo (see instructions below). You can check which mode is active by looking for a `.opencode/opencode.jsonc` symlink in the project root.

### Things to Know

- Wolf reports back what it did but does not commit. You always control when changes are committed.
- If you're in strict mode and Wolf says it can't run a command, that's the guardrails working. Either switch to YODO mode or run the command yourself.
- Slash commands (`/commit`, `/push`, `/pr`, `/review`, `/quick`) are the primary way to trigger specific workflows. Type `/` to see what's available.

## Structure

```
~/.config/opencode/
  opencode.jsonc          # Global config (strict mode — default)
  opencode-yodo.jsonc     # Relaxed config (YODO mode — opt-in per repo)
  package.json            # Sole dependency: @opencode-ai/plugin
  bun.lock                # Bun lockfile
  agent/                  # Agent definitions (marsellus, wolf, vincent, jules, architect, git, quick-answer)
  command/                # Slash commands (/commit, /push, /pr, /review, /quick, /plan-*)
  plugins/                # Custom plugins (copilot-usage)
  tools/                  # Custom tools (progress reporting)
  docs/                   # Design docs and analysis
```

## Agents

### Delegation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Input                              │
└──────────┬────────────────────────┬─────────────────────────────┘
           │                        │
     (default tab)            (Jules tab)
           │                        │
           ▼                        ▼
    ┌─────────────┐          ┌─────────────┐
    │  Marsellus  │          │    Jules    │
    │ orchestrator│          │  planning   │
    │             │          │  coordinator│
    └──┬───────┬──┘          └──┬───────┬──┘
       │       │                │       │
  "do" │       │ "know"         │       │ (hand off to
       │       │                │       │  implementation)
       ▼       ▼                ▼       ▼
    ┌──────┐ ┌──────────┐  ┌──────────┐ ┌──────┐
    │ Wolf │ │ Vincent  │  │Architect │ │ Wolf │
    │      │ │          │  │          │ │      │
    └──┬───┘ └──────────┘  └────┬─────┘ └───┬──┘
       │      (terminal)        │           │
       │                        ▼           │
       │                   ┌─────────┐      │
       ├──────────────────▶│ Vincent │◀─────┘
        │  (deep analysis)  └─────────┘
        │                    (terminal)
        ▼
   ┌──────────────┐   ┌──────┐
   │ quick-answer │   │ git  │
   └──────────────┘   └──────┘
     (terminal)     (slash cmds only)
```

**Routing rules:**
- **Marsellus** routes based on intent: "do something" → Wolf, "know something" → Vincent. Default bias is Wolf.
- **Wolf** can self-delegate to Vincent mid-task when deep investigation is needed.
- **Jules** delegates to Architect for investigation + planning, or to Wolf for implementation handoff.
- **Architect** delegates to Vincent for deep codebase research.
- **Vincent**, **git**, and **quick-answer** are terminal — they do not delegate further.

### Agent Roles

| Agent | Role | Model | Mode | Can Delegate To |
|---|---|---|---|---|
| **Marsellus** | Orchestrator — receives user requests, routes to the right agent. Never reads code, edits files, or runs commands (except read-only git for context). | Claude Haiku 4.5 | Primary | Wolf, Vincent |
| **Wolf** | Executor — reads, writes, edits, searches, and runs commands. Does all implementation work. Owns the full cycle from investigation to delivery. | Claude Opus 4.6 | Subagent | Vincent |
| **Vincent** | Investigator — deep read-only codebase analysis. Traces dependencies, maps architecture, returns structured findings with file paths and line numbers. Never modifies anything. | Claude Opus 4.6 | Subagent | *None* |
| **Architect** | Planner — combines investigation (directly + via Vincent) with structured planning. Writes plan documents to `.opencode/plans/`. Returns only metadata summaries to caller. | Claude Opus 4.6 | Subagent | Vincent |
| **Jules** | Planning coordinator — interviews users about what to build, delegates investigation and planning to the Architect. Only sees plan metadata, never source code. | Claude Haiku 4.5 | Primary | Architect, Wolf |
| **git** | Git specialist — commits, pushes, creates PRs. Only invoked via `/commit`, `/push`, `/pr` slash commands. Has full git write permissions but no file edit access. | Claude Opus 4.6 | Subagent | *None* |
| **quick-answer** | Fast responder — concise answers to simple questions. Only has `webfetch` for lookups. No file access, no investigation. | Claude Haiku 4.5 | Subagent | *None* |

### Permission Model

Each agent has a strict permission boundary enforced by the tool and bash permission configs. The principle is **least privilege** — agents only get the access they need.

| Agent | File Read | File Write/Edit | Bash | Git (read) | Git (write) | Task Delegation | Web Access |
|---|---|---|---|---|---|---|---|
| **Marsellus** | Limited (prompt context only) | No | No | Yes (status, log) | No | Wolf, Vincent | No |
| **Wolf** | Full | Full | Extensive allow-list (read-only + builds/tests) | Yes | No | Vincent | Yes |
| **Vincent** | Full | No | Read-only exploration only | Yes | No | No | Yes |
| **Architect** | Full | Plans directory only (`.opencode/plans/`) | Minimal (ls, cat, git read) | Yes | No | Vincent | Yes |
| **Jules** | Plans directory only | No | Plan storage + git context | Yes | No | Architect, Wolf | No |
| **git** | Full | No | Git + GitHub CLI (full write) | Yes | Yes | No | No |
| **quick-answer** | No | No | No | No | No | No | Yes |

**Key constraints:**
- **Git write operations are forbidden** for all agents except git. Wolf, Vincent, Architect, and Jules cannot run `git add`, `git commit`, `git push`, etc.
- **The orchestrator never does work.** Marsellus has no grep, glob, write, or edit tools. It only delegates via `Task()`.
- **Vincent is strictly read-only.** No file writes, no builds, no package installs, no code execution. Not even `make` or `npm run`.
- **Wolf has broad bash access** in strict mode, but it's an explicit allow-list — default-deny with whitelisted commands for builds, tests, linting, and read-only tools. Dangerous operations (cloud mutations, remote access, package publishing, system commands) are denied.
- **Architect can only write to `.opencode/plans/`** — it cannot modify source code.
- **Jules cannot read source code** — its read access is restricted to plan files only.

## Slash Commands

- `/commit` — Stage and commit changes with an auto-generated message
- `/push` — Push current branch to remote
- `/pr` — Create a pull request
- `/review` — Code review of staged/unstaged changes
- `/quick` — Quick answer mode (fast, concise responses)
- `/plan-list` — List all plans for the current repo
- `/plan-implement <plan-name>` — Implement a plan step by step (delegates to Wolf)
- `/plan-update <plan-name>` — Load a plan and update it through conversation

## Security Modes

This configuration supports two security modes for OpenCode:

| | **Strict** (default) | **YODO** (opt-in) |
|---|---|---|
| **Activation** | Automatic everywhere | Symlink `opencode-yodo.jsonc` into repo's `.opencode/opencode.jsonc` |
| **Bash for Wolf** | Default-deny, explicit allow-list (builds, tests, read-only tools) | Default-ask, broad allow-list |
| **File editing** | Allowed (Wolf has full write/edit) | Allowed |
| **Git mutations** | Denied (git agent only, via slash commands) | Allowed (except force-push/hard-reset) |
| **Docker** | Build + compose only | Full local access |
| **Cloud CLIs** | Denied | Read-only allowed, mutations ask/deny |
| **Use case** | Work repos, shared projects, anything with risk | Personal repos, experiments, throwaway projects |

### Enabling YODO Mode in a Repo

YODO mode uses a symlink so that all repos share a single source of truth. When you update `opencode-yodo.jsonc`, every YODO-enabled repo picks up the change automatically.

```bash
# In the repo where you want YODO mode:
mkdir -p .opencode
ln -s ~/.config/opencode/opencode-yodo.jsonc ./.opencode/opencode.jsonc
```

That's it. OpenCode reads `.opencode/opencode.jsonc` from the project directory, follows the symlink, and loads the relaxed config.

### Enabling Websearch (Exa AI)

The websearch and codesearch tools require the `OPENCODE_ENABLE_EXA=1` environment variable. Since the yodo config is symlinked into project directories, the env var needs to be set **in each target project**, not in the config directory itself.

The recommended approach is [direnv](https://direnv.net/), which scopes env vars to a directory:

```bash
# One-time: install direnv and add the shell hook
brew install direnv
# Add hook to your shell — see https://direnv.net/docs/hook.html

# In each project where you want websearch:
echo 'OPENCODE_ENABLE_EXA=1' > .envrc
direnv allow
```

Add `.envrc` to your global gitignore (same as `.opencode` above) so it doesn't leak into repos:

```bash
echo ".envrc" >> ~/.gitignore_global
```

**Alternative** — if you don't want direnv, export the var globally in your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export OPENCODE_ENABLE_EXA=1
```

This enables websearch everywhere rather than per-project.

### Preventing Accidental Commits

The `.opencode` directory should **not** be committed to any repo. Add it to your global gitignore so it's ignored everywhere:

```bash
# One-time setup
echo ".opencode" >> ~/.gitignore_global
git config --global core.excludesfile ~/.gitignore_global
```

This ensures the YODO symlink (and any other `.opencode` artifacts) never leak into version control.

### When to Use Each Mode

**Use strict mode** (do nothing — it's the default) when:
- Working on shared or team repositories
- Contributing to open-source projects
- Working with production code or sensitive data
- You want the AI to ask before running commands

**Use YODO mode** when:
- Working on personal side projects
- Prototyping or experimenting
- Working in disposable repos (e.g., learning, demos)
- You trust the AI to run builds, tests, and edits without confirmation

### Verifying Which Mode Is Active

```bash
# Check if a YODO symlink exists in the current project:
ls -la .opencode/opencode.jsonc

# If it's a symlink pointing to opencode-yodo.jsonc → YODO mode
# If it doesn't exist → Strict mode (global defaults)
```

To disable YODO mode in a repo, remove the symlink:

```bash
rm .opencode/opencode.jsonc
```

The repo immediately falls back to strict global defaults.

## Plan Storage

Plans are stored at `.opencode/plans/` in the repo root as markdown files. Plans are project-scoped — each repo has its own plan directory. Use `/plan-list` to see plans for the current repo.
