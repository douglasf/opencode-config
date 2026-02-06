# OpenCode Configuration

Personal OpenCode setup with custom agents, commands, and plugins. Lives at `~/.config/opencode/` and provides global defaults for all projects.

## Structure

```
~/.config/opencode/
  opencode.jsonc          # Global config (strict mode — default)
  opencode-yolo.jsonc     # Relaxed config (YOLO mode — opt-in per repo)
  prompts/                # System prompts (orchestrator)
  agent/                  # Agent definitions (wolf, git, quick-answer)
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

- **wolf** — The executor. Reads, writes, searches, runs commands. Does all the actual work.
- **git** — Handles commits, pushes, and PRs. Only invoked via slash commands.
- **quick-answer** — Fast, concise answers without deep investigation.

## Slash Commands

- `/commit` — Stage and commit changes with an auto-generated message
- `/push` — Push current branch to remote
- `/pr` — Create a pull request
- `/review` — Code review of staged/unstaged changes
- `/quick` — Quick answer mode
