#!/bin/bash

echo "AgentConfig Demo"
echo "================"
echo ""
echo "1. Converting .agent.md to all supported formats..."
echo ""

# Export to all formats
node ../dist/cli.js export .agent.md

echo ""
echo "2. Files created:"
ls -la .github/copilot-instructions.md .cursor/rules/*.mdc .clinerules .windsurfrules .rules AGENTS.md CONVENTIONS.md 2>/dev/null | grep -v "No such"

echo ""
echo "3. Re-importing all formats back to verify round-trip..."
node ../dist/cli.js import . -o .agent-roundtrip.md

echo ""
echo "4. Comparing original and round-trip files..."
if diff -q .agent.md .agent-roundtrip.md > /dev/null; then
    echo "✅ Round-trip successful - files are identical!"
else
    echo "❌ Files differ"
    diff .agent.md .agent-roundtrip.md
fi