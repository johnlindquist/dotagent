#!/bin/bash

echo "DotAgent Demo"
echo "============="
echo ""
echo "1. Creating sample .agent/ directory with rules..."
mkdir -p .agent
echo '---
id: coding-standards
alwaysApply: true
priority: high
---

## Coding Standards

- Use TypeScript for all new code
- Follow ESLint rules
- Write tests for new features' > .agent/coding-standards.md

echo '---
id: api-rules
scope: src/api/**
---

## API Rules

- All endpoints must be documented
- Use proper HTTP status codes
- Implement rate limiting' > .agent/api-rules.md

echo ""
echo "2. Exporting .agent/ directory to all supported formats..."
echo ""

rm -rf .agentfile

# Export to all formats
node ../dist/cli.js export .

echo ""
echo "3. Files created:"
ls -la .github/copilot-instructions.md .cursor/rules/*.mdc .clinerules .windsurfrules .rules AGENTS.md CONVENTIONS.md best_practices.md 2>/dev/null | grep -v "No such"

echo ""
echo "4. Re-importing all formats back to .agent-reimport/..."
mkdir -p temp-reimport
node ../dist/cli.js import . -o temp-reimport

echo ""
echo "5. Checking round-trip consistency..."
if [ -d "temp-reimport/.agent" ]; then
    echo "✅ Round-trip successful - .agent/ directory created!"
    echo "Original rules: $(ls .agent/*.md | wc -l)"
    echo "Reimported rules: $(ls temp-reimport/.agent/*.md | wc -l)"
    rm -rf temp-reimport
else
    echo "❌ Round-trip failed"
fi