# Repository Memory System

A persistent memory system for OpenCode that stores project-level knowledge across sessions.

## Overview

This system allows agents to:
- **Read** project-specific facts from previous sessions
- **Write** new knowledge when users share non-obvious information
- **Persist** institutional knowledge that can't be deduced from code

## Installation

### 1. Create the scripts directory and memory loader

```bash
mkdir -p ~/.opencode/scripts
mkdir -p ~/.opencode/memory
```

Create `~/.opencode/scripts/load-memory.sh`:

```bash
#!/bin/bash
# First message: full memory. Subsequent: read/write directives.

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)

TRACK_DIR="$HOME/.opencode/memory/.sessions"
mkdir -p "$TRACK_DIR"
TRACK_FILE="$TRACK_DIR/$SESSION_ID"

REPO_ID=$(git remote get-url origin 2>/dev/null | sed 's|.*://||; s|.*@||; s|\.git$||; s|:|/|')
if [ -z "$REPO_ID" ]; then
    exit 0
fi

MEMORY_PATH="$HOME/.opencode/memory/$REPO_ID"
MEMORY_FILE="$MEMORY_PATH/MEMORY.md"

if [ -f "$TRACK_FILE" ]; then
    echo "[MEMORY SYSTEM]"
    echo "- If you don't know something: cat $MEMORY_FILE"
    echo "- If user shares project knowledge (deployment info, constraints, business rules): append to $MEMORY_FILE silently, don't ask permission"
else
    touch "$TRACK_FILE"
    find "$TRACK_DIR" -type f -mtime +1 -delete 2>/dev/null
    
    echo "## 📚 PROJECT MEMORY"
    echo ""
    if [ -f "$MEMORY_FILE" ]; then
        cat "$MEMORY_FILE"
    else
        echo "(No memory yet for this project)"
    fi
    echo ""
    echo "---"
    echo "When user shares project knowledge you couldn't deduce from code, append it to $MEMORY_FILE without asking."
fi
```

Make it executable:

```bash
chmod +x ~/.opencode/scripts/load-memory.sh
```

### 2. Create the Claude Code hooks config

Create `~/.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "~/.opencode/scripts/load-memory.sh"
          }
        ]
      }
    ]
  }
}
```

### 3. Create the rules file

Create `~/.claude/rules/memory-system.md`:

```markdown
---
alwaysApply: true
---

# Project Memory

**Memory file:** `~/.opencode/memory/<repo-id>/MEMORY.md`

**Get repo-id:** `git remote get-url origin 2>/dev/null | sed 's|.*://||; s|.*@||; s|\.git$||; s|:|/|'`

## READ Memory When:
- Unsure about project-specific details
- Before saying "I don't know" about project behavior

## WRITE Memory When:
**When user shares project knowledge you couldn't deduce from code, IMMEDIATELY write it to memory.**

**DO NOT ask permission. DO NOT offer to save it. Just SAVE IT silently, then continue the conversation.**

Examples of memory-worthy information:
- Deployment/CI requirements
- Rate limits, quotas, timing constraints  
- Business rules, external dependencies
- "The X system does Y because of Z"
- Corrections to mistakes you made

## Commands:
\`\`\`bash
# Read
REPO_ID=$(git remote get-url origin 2>/dev/null | sed 's|.*://||; s|.*@||; s|\.git$||; s|:|/|')
cat ~/.opencode/memory/$REPO_ID/MEMORY.md

# Write
REPO_ID=$(git remote get-url origin 2>/dev/null | sed 's|.*://||; s|.*@||; s|\.git$||; s|:|/|')
mkdir -p ~/.opencode/memory/$REPO_ID
cat >> ~/.opencode/memory/$REPO_ID/MEMORY.md << 'EOF'
## [Topic]

### [YYYY-MM-DD]

[Fact]

---
EOF
\`\`\`
```

### 4. Configure OpenCode permissions

Add to your `~/.config/opencode/opencode.jsonc` under the `agent.build.permission` section:

```jsonc
{
  "agent": {
    "build": {
      "permission": {
        "external_directory": {
          "/Users/YOUR_USERNAME/.opencode/memory": "allow",
          "/Users/YOUR_USERNAME/.opencode/memory/*": "allow"
        }
      }
    }
  }
}
```

Replace `YOUR_USERNAME` with your actual username.

## How It Works

### Memory Location

Memory files are stored at:
```
~/.opencode/memory/<repo-identifier>/MEMORY.md
```

Where `<repo-identifier>` is derived from the git remote URL:
- `git@github.com:user/repo.git` → `github.com/user/repo`
- `https://github.com/user/repo.git` → `github.com/user/repo`

### Injection Behavior

| Message | What Gets Injected |
|---------|-------------------|
| **1st message** | Full memory content + write instruction |
| **2nd+ messages** | Read/write reminders with file path |

### Session Tracking

Session IDs are tracked in `~/.opencode/memory/.sessions/` to determine first vs subsequent messages. Old session files are auto-cleaned after 1 day.

## Usage

### Reading Memory

Agents automatically receive memory content on the first message of each session. On subsequent messages, they're reminded to `cat` the memory file if they need information.

### Writing Memory

When you share project-specific knowledge, agents should automatically append it to the memory file. Examples:

- "The staging database syncs from production every 15 minutes"
- "Our API rate limit is 100 req/min per user"
- "The /legacy endpoints can't be removed until Q3 due to Acme Corp"

### Memory File Format

```markdown
## Topic Name

### YYYY-MM-DD

Concise fact or information here.

---

## Another Topic

### YYYY-MM-DD

Another piece of information.

---
```

## Dependencies

- Bash shell
- Git (for repo identification)
- Claude Code hooks support (via `~/.claude/settings.json`)

## File Summary

| File | Purpose |
|------|---------|
| `~/.opencode/scripts/load-memory.sh` | Hook script that injects memory |
| `~/.claude/settings.json` | Claude Code hooks configuration |
| `~/.claude/rules/memory-system.md` | Agent instructions for memory usage |
| `~/.opencode/memory/<repo>/MEMORY.md` | Actual memory storage per repo |
| `~/.opencode/memory/.sessions/` | Session tracking (auto-managed) |
