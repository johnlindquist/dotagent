#!/bin/bash

echo "🎨 AgentConfig Color & Dry-Run Demo"
echo "==================================="
echo ""

# Show help with colors
echo "1. Help with colors:"
echo "-------------------"
node ../dist/cli.js --help | head -20
echo ""

# Test dry-run export
echo "2. Dry-run export (preview mode):"
echo "---------------------------------"
node ../dist/cli.js export .agent.md --dry-run
echo ""

# Test actual export
echo "3. Actual export:"
echo "-----------------"
node ../dist/cli.js export .agent.md
echo ""

# Test import with no files
echo "4. Import with helpful hints:"
echo "-----------------------------"
rm -rf .github .cursor .clinerules .windsurfrules .rules AGENTS.md CONVENTIONS.md 2>/dev/null
node ../dist/cli.js import .
echo ""

# Test error handling
echo "5. Error handling with hints:"
echo "-----------------------------"
node ../dist/cli.js convert nonexistent.md 2>&1 || true