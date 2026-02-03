---
description: Manually add information to project memory
---

# Remember Command

Write information to the project memory system.

## Arguments

$ARGUMENTS

## Behavior

**If arguments provided above:**
Interpret the text as information to remember. Extract the key facts, categorize appropriately, and write to memory using the standard format.

**If no arguments provided:**
Analyze the recent conversation in this session. Identify any insights, decisions, corrections, or project knowledge that would be valuable to remember in future sessions. Write those to memory.

## Memory System Instructions

Follow the exact same format and rules as defined in the memory system:

**Memory file:** `~/.opencode/memory/<repo-id>/MEMORY.md`

**Get repo-id:** `git remote get-url origin 2>/dev/null | sed 's|.*://||; s|.*@||; s|\.git$||; s|:|/|'`

## Commands:
```bash
# Write
REPO_ID=$(git remote get-url origin 2>/dev/null | sed 's|.*://||; s|.*@||; s|\.git$||; s|:|/|')
mkdir -p ~/.opencode/memory/$REPO_ID
cat >> ~/.opencode/memory/$REPO_ID/MEMORY.md << 'EOF'
## [Topic]

### [YYYY-MM-DD]

[Fact]

---
EOF
```

## Rules

- Be concise - store facts, not conversations
- Use clear topic categories
- Include today's date
- Deduplicate - don't store the same fact twice
- After writing, briefly confirm what was saved
