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
```bash
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
```
