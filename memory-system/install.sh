#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing OpenCode Memory System..."

mkdir -p ~/.opencode/scripts
mkdir -p ~/.claude/rules

if [ -L ~/.opencode/scripts/load-memory.sh ]; then
    rm ~/.opencode/scripts/load-memory.sh
fi
ln -sf "$SCRIPT_DIR/scripts/load-memory.sh" ~/.opencode/scripts/load-memory.sh
echo "✓ Linked load-memory.sh"

if [ -L ~/.opencode/scripts/memory-precompact.sh ]; then
    rm ~/.opencode/scripts/memory-precompact.sh
fi
ln -sf "$SCRIPT_DIR/scripts/memory-precompact.sh" ~/.opencode/scripts/memory-precompact.sh
echo "✓ Linked memory-precompact.sh"

if [ -L ~/.claude/rules/memory-system.md ]; then
    rm ~/.claude/rules/memory-system.md
fi
ln -sf "$SCRIPT_DIR/rules/memory-system.md" ~/.claude/rules/memory-system.md
echo "✓ Linked memory-system.md rules"

if [ -f ~/.claude/settings.json ]; then
    if grep -q "load-memory.sh" ~/.claude/settings.json; then
        echo "✓ Hook already configured in ~/.claude/settings.json"
    else
        echo ""
        echo "⚠ ~/.claude/settings.json exists but doesn't have memory hook."
        echo "  Add this to your hooks config:"
        echo ""
        cat "$SCRIPT_DIR/settings.json"
        echo ""
    fi
else
    cp "$SCRIPT_DIR/settings.json" ~/.claude/settings.json
    echo "✓ Created ~/.claude/settings.json"
fi

echo ""
echo "Memory system installed!"
echo "Memory files will be stored in: ~/.opencode/memory/<repo-id>/MEMORY.md"
