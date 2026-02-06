# YOLO Mode Configuration: Analysis & Recommendation

## Context

**Goal**: A simple, non-AI mechanism to tell OpenCode "this repo should use relaxed/YOLO permissions" instead of the strict defaults in `~/.config/opencode/`.

**Constraints**:
- OpenCode is a CLI tool reading `opencode.jsonc` from project root
- Global config lives in `~/.config/opencode/opencode.jsonc`
- Agent configs live in `~/.config/opencode/agent/*.md`
- A static `opencode-yolo.jsonc` file already exists in `~/.config/opencode/`
- This is a one-time manual setup per repo — no AI decision-making
- OpenCode supports: `OPENCODE_CONFIG`, `OPENCODE_CONFIG_DIR`, `OPENCODE_CONFIG_CONTENT` env vars

**Key Discovery**: OpenCode's config system supports:
- **Config file merging** (later sources override earlier ones)
- **Precedence**: Remote → Global → `OPENCODE_CONFIG` → Project → `.opencode` dirs → `OPENCODE_CONFIG_CONTENT`
- **`{file:path}` variable substitution** in config values
- **No `extends` or `include` mechanism** — configs merge by precedence layer, not by reference

---

## Option Analysis

### Option 1: `.opencode.yolo` Marker File

**How it works**: Drop an empty `.opencode.yolo` file in the repo root. OpenCode checks for it at startup and swaps to yolo config.

**Implementation**:
- Would require a custom OpenCode plugin or wrapper script
- OpenCode has NO built-in support for checking arbitrary marker files
- Would need: shell wrapper that checks for the file and sets `OPENCODE_CONFIG` env var

**User Experience**: `touch .opencode.yolo` to enable, `rm .opencode.yolo` to disable

| Criterion | Rating | Notes |
|-----------|--------|-------|
| Detection/Implementation | ⚠️ Medium | Requires wrapper script; OpenCode won't detect this natively |
| User Experience | ✅ Excellent | Dead simple — touch/rm a file |
| Maintainability | ✅ Good | Yolo config is still centralized in `~/.config/opencode/` |
| Clarity | ✅ Excellent | Instantly obvious what `.opencode.yolo` means |
| Reversibility | ✅ Excellent | `rm .opencode.yolo` |
| Git Safety | ⚠️ Caution | Must add to `.gitignore`; empty file could accidentally be committed |

**Verdict**: Great UX but needs a wrapper script since OpenCode doesn't know about marker files.

---

### Option 2: `opencode.jsonc` with YOLO Config Directly

**How it works**: Place a full `opencode.jsonc` in the project root that contains the yolo permissions. Project config overrides global config by OpenCode's built-in precedence rules.

**Implementation**:
- **This is how OpenCode already works!** Project `opencode.jsonc` merges with and overrides global config
- Just copy `opencode-yolo.jsonc` → `<project>/opencode.jsonc`
- OpenCode natively reads this — zero custom code needed

**User Experience**: Copy a file once per repo:
```bash
cp ~/.config/opencode/opencode-yolo.jsonc ./opencode.jsonc
```

| Criterion | Rating | Notes |
|-----------|--------|-------|
| Detection/Implementation | ✅ Native | OpenCode does this out of the box — zero custom work |
| User Experience | ✅ Good | One copy command; but the file contains actual config, not just a flag |
| Maintainability | ❌ Poor | If you update the yolo template, every repo has a stale copy |
| Clarity | ⚠️ Medium | The file is just `opencode.jsonc` — not obvious it's "yolo" without reading it |
| Reversibility | ✅ Excellent | `rm opencode.jsonc` reverts to global strict defaults |
| Git Safety | ⚠️ Caution | Must `.gitignore` it or it gets committed to the repo |

**Verdict**: Zero implementation effort but poor maintainability — copies diverge from template.

---

### Option 3: `.opencode-mode` Text File

**How it works**: Create `.opencode-mode` containing the word `yolo` or `strict`. A wrapper script reads this and sets `OPENCODE_CONFIG` accordingly.

**Implementation**:
- Same as Option 1 — requires wrapper script
- Slightly more flexible (supports multiple modes, not just yolo)
- Wrapper reads file content and maps to config path

**User Experience**: `echo yolo > .opencode-mode` to enable

| Criterion | Rating | Notes |
|-----------|--------|-------|
| Detection/Implementation | ⚠️ Medium | Requires wrapper script |
| User Experience | ✅ Good | Clear and self-documenting |
| Maintainability | ✅ Good | Centralized config; mode file is just a pointer |
| Clarity | ✅ Excellent | File content literally says what mode you're in |
| Reversibility | ✅ Excellent | `echo strict > .opencode-mode` or `rm .opencode-mode` |
| Git Safety | ⚠️ Caution | Must `.gitignore` |

**Verdict**: Over-engineered version of Option 1. The "multiple modes" flexibility adds complexity without clear benefit.

---

### Option 4: Git Branch Naming Convention

**How it works**: OpenCode checks the current git branch. If on `personal/*` or `yolo/*`, use relaxed config.

**Implementation**:
- Requires wrapper script that runs `git branch --show-current`
- Maps branch name patterns to config variants

**User Experience**: `git checkout -b personal/feature-x` → automatic yolo mode

| Criterion | Rating | Notes |
|-----------|--------|-------|
| Detection/Implementation | ⚠️ Medium | Requires wrapper script with git introspection |
| User Experience | ❌ Poor | Conflates branch purpose with security config; confusing |
| Maintainability | ✅ Good | Centralized config |
| Clarity | ❌ Poor | Why does `personal/cleanup` need YOLO? Not semantic |
| Reversibility | ❌ Poor | Must switch branches to change config |
| Git Safety | ❌ Dangerous | Could push yolo-mode code from "personal" branch to main |

**Verdict**: Terrible. Conflates version control concerns with security configuration. Branch switching changes your security posture silently.

---

### Option 5: Shell Command (`oc-enable-yolo`)

**How it works**: User runs `oc-enable-yolo` in repo root. The command copies `~/.config/opencode/opencode-yolo.jsonc` → `./opencode.jsonc`.

**Implementation**:
- Simple shell alias/function:
  ```bash
  oc-enable-yolo() { cp ~/.config/opencode/opencode-yolo.jsonc ./opencode.jsonc; }
  oc-disable-yolo() { rm -f ./opencode.jsonc; }
  ```
- No OpenCode customization needed — it just reads the project config natively

**User Experience**: Run once per repo, explicit and intentional

| Criterion | Rating | Notes |
|-----------|--------|-------|
| Detection/Implementation | ✅ Native | OpenCode reads project config natively; shell alias is trivial |
| User Experience | ✅ Good | Explicit action, clear intent |
| Maintainability | ❌ Poor | Same as Option 2 — creates a copy that diverges from template |
| Clarity | ⚠️ Medium | After running, the file is just `opencode.jsonc` |
| Reversibility | ✅ Excellent | `oc-disable-yolo` or `rm opencode.jsonc` |
| Git Safety | ⚠️ Caution | Must `.gitignore` |

**Verdict**: This is Option 2 with a nicer UX wrapper. Same maintainability problem.

---

### Option 6: Symlink

**How it works**: `opencode.jsonc` in repo root is a symlink to `~/.config/opencode/opencode-yolo.jsonc`.

**Implementation**:
```bash
ln -s ~/.config/opencode/opencode-yolo.jsonc ./opencode.jsonc
```
- OpenCode follows symlinks when reading files — this works natively
- Single source of truth: editing the yolo template updates all repos

**User Experience**: One symlink command per repo

| Criterion | Rating | Notes |
|-----------|--------|-------|
| Detection/Implementation | ✅ Native | OpenCode follows symlinks transparently |
| User Experience | ✅ Good | One command per repo |
| Maintainability | ✅ Excellent | Single source of truth — edit template, all repos update |
| Clarity | ⚠️ Medium | `ls -la` reveals it's a symlink to yolo config, but `cat` shows config |
| Reversibility | ✅ Excellent | `rm opencode.jsonc` (only removes the symlink) |
| Git Safety | ✅ Good | Git stores symlinks as text; `.gitignore` prevents committing |

**Verdict**: Best maintainability of any option. Editing the yolo template instantly propagates to all repos.

---

### Option 7 (Bonus): `OPENCODE_CONFIG` Environment Variable

**How it works**: Set `OPENCODE_CONFIG=~/.config/opencode/opencode-yolo.jsonc` per-project using direnv, or per-shell.

**Implementation**:
- Using **direnv** (best approach):
  ```bash
  # In repo root: .envrc
  export OPENCODE_CONFIG="$HOME/.config/opencode/opencode-yolo.jsonc"
  ```
  Then `direnv allow` once.

- Or manual: `OPENCODE_CONFIG=~/.config/opencode/opencode-yolo.jsonc opencode`

**User Experience**: 
- With direnv: automatic per-directory, zero friction after setup
- Without direnv: must remember to set env var

| Criterion | Rating | Notes |
|-----------|--------|-------|
| Detection/Implementation | ✅ Native | `OPENCODE_CONFIG` is a first-class OpenCode feature |
| User Experience | ✅ Excellent (with direnv) | Fully automatic after `direnv allow` |
| Maintainability | ✅ Excellent | Single source of truth; `.envrc` just points to the file |
| Clarity | ✅ Good | `.envrc` explicitly states which config to use |
| Reversibility | ✅ Excellent | `rm .envrc` or remove the line |
| Git Safety | ✅ Good | `.envrc` is usually in `.gitignore` already |

**Verdict**: Uses OpenCode's built-in config override mechanism with direnv for per-project automation. No wrapper scripts, no copies, no symlinks.

---

## Ranking

| Rank | Option | Score | Key Strength | Key Weakness |
|------|--------|-------|--------------|--------------|
| **1** | **Option 6: Symlink** | ⭐⭐⭐⭐⭐ | Single source of truth + native support | Symlinks can break if home dir path changes |
| **2** | **Option 7: OPENCODE_CONFIG + direnv** | ⭐⭐⭐⭐⭐ | First-class OpenCode feature, automatic | Requires direnv installed |
| **3** | **Option 1+wrapper: Marker file** | ⭐⭐⭐⭐ | Great UX, dead simple | Requires wrapper script |
| **4** | **Option 5: Shell command** | ⭐⭐⭐ | Explicit, intentional | Copies diverge from template |
| **5** | **Option 2: Direct config copy** | ⭐⭐⭐ | Zero custom code | Copies diverge from template |
| **6** | **Option 3: Mode file** | ⭐⭐ | Multi-mode support | Over-engineered, needs wrapper |
| **7** | **Option 4: Branch naming** | ⭐ | Automatic | Dangerous, semantically wrong |

---

## Top Recommendation: Symlink (Option 6)

### Why

1. **Zero tooling needed** — no wrapper scripts, no direnv, no plugins
2. **Single source of truth** — edit `opencode-yolo.jsonc` once, all repos update
3. **Native OpenCode support** — OpenCode reads `opencode.jsonc` from project root; symlinks are transparent
4. **Dead simple** — one command per repo, obvious when inspected
5. **Safe** — `.gitignore` prevents committing; `rm` only removes the link

### Implementation

#### Step 1: Create the yolo config template

`~/.config/opencode/opencode-yolo.jsonc` — your relaxed config with permissive permissions.

This file already exists (or will be created separately). It should contain ALL overrides needed for YOLO mode: relaxed permissions, different agent configs, etc.

#### Step 2: Enable YOLO for a repo

```bash
cd /path/to/your/repo
ln -s ~/.config/opencode/opencode-yolo.jsonc opencode.jsonc
```

#### Step 3: Prevent git from committing it

Add to the repo's `.gitignore` (or your global `~/.gitignore_global`):
```
opencode.jsonc
```

Or better — add it to your **global gitignore** so every repo ignores it:
```bash
# One-time setup
echo "opencode.jsonc" >> ~/.gitignore_global
git config --global core.excludesfile ~/.gitignore_global
```

#### Step 4: Shell aliases for convenience

Add to `~/.zshrc` or `~/.bashrc`:
```bash
# YOLO mode management
alias oc-yolo='ln -sf ~/.config/opencode/opencode-yolo.jsonc opencode.jsonc && echo "YOLO mode enabled"'
alias oc-strict='rm -f opencode.jsonc && echo "Strict mode (global defaults)"'
alias oc-mode='if [ -L opencode.jsonc ]; then echo "YOLO (symlinked)"; elif [ -f opencode.jsonc ]; then echo "Custom (local file)"; else echo "Strict (global defaults)"; fi'
```

Usage:
```bash
cd ~/projects/my-personal-project
oc-yolo    # → "YOLO mode enabled"
oc-mode    # → "YOLO (symlinked)"
oc-strict  # → "Strict mode (global defaults)"
```

#### Step 5: Verify

```bash
ls -la opencode.jsonc
# lrwxr-xr-x  1 user  staff  52 Feb  6 12:00 opencode.jsonc -> /Users/user/.config/opencode/opencode-yolo.jsonc

opencode debug config  # Shows resolved config with yolo overrides
```

### How Config Merging Works

When the symlinked `opencode.jsonc` exists in the project root, OpenCode's precedence is:

1. Global config (`~/.config/opencode/opencode.jsonc`) — loaded first (strict defaults)
2. Project config (`./opencode.jsonc` → symlink → yolo config) — **overrides** global

The yolo config only needs to contain the **overrides**, not the full config. Anything not specified in yolo falls through to global defaults.

### Edge Cases

- **If `opencode-yolo.jsonc` is deleted**: Symlink becomes dangling, OpenCode may error. Fix: recreate the file.
- **If repo already has `opencode.jsonc`**: The symlink would replace it. Check first with `oc-mode`.
- **Multiple machines**: The symlink target path must be the same. Use `~/.config/opencode/` (XDG standard) for portability.
- **Agent configs**: The yolo config can override agent definitions inline, or you can create separate agent files in a yolo-specific directory and use `OPENCODE_CONFIG_DIR` for that.

---

## Runner-Up: OPENCODE_CONFIG + direnv (Option 7)

If you already use `direnv`, this is equally good:

```bash
# In repo root
echo 'export OPENCODE_CONFIG="$HOME/.config/opencode/opencode-yolo.jsonc"' > .envrc
direnv allow
```

This is arguably "cleaner" because it uses OpenCode's official `OPENCODE_CONFIG` mechanism, but it adds a dependency on direnv. The symlink approach has zero dependencies.

### When to prefer direnv over symlink

- You already use direnv across your projects
- You want the `.envrc` to also set other env vars (e.g., `OPENCODE_CONFIG_DIR` for yolo agent files)
- You need the yolo config to *replace* the global config rather than merge with it (env var loads config at a different precedence level)

### Important precedence difference

- **Symlink** (project config): Loads AFTER global config and merges/overrides it
- **`OPENCODE_CONFIG`**: Loads BETWEEN global and project config in precedence

For yolo mode, both achieve the same result since we want to override global strict defaults.

---

## What NOT to Do

1. **Don't use branch naming** — conflates VCS with security config, dangerous
2. **Don't copy files** — copies diverge from template, maintainability nightmare  
3. **Don't build custom OpenCode plugins** for this — too complex for a simple config switch
4. **Don't put the yolo config in the repo** (committed) — exposes your security preferences to collaborators
5. **Don't use `OPENCODE_CONFIG_CONTENT`** — meant for CI/runtime overrides, not persistent per-repo config
