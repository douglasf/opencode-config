#!/bin/bash
# Re-injects memory during compaction (capped to prevent infinite loops)

MAX_BYTES=4000

REPO_ID=$(git remote get-url origin 2>/dev/null | sed 's|.*://||; s|.*@||; s|\.git$||; s|:|/|')
if [ -z "$REPO_ID" ]; then
    exit 0
fi

MEMORY_FILE="$HOME/.opencode/memory/$REPO_ID/MEMORY.md"
if [ ! -f "$MEMORY_FILE" ]; then
    exit 0
fi

FILE_SIZE=$(wc -c < "$MEMORY_FILE")

if [ "$FILE_SIZE" -gt "$MAX_BYTES" ]; then
    echo "## 📚 PROJECT MEMORY (truncated for compaction)"
    echo ""
    head -c "$MAX_BYTES" "$MEMORY_FILE"
    echo ""
    echo "..."
    echo "[Full memory: $MEMORY_FILE - $(($FILE_SIZE / 1000))KB total]"
else
    echo "## 📚 PROJECT MEMORY"
    echo ""
    cat "$MEMORY_FILE"
fi
