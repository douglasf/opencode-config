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
