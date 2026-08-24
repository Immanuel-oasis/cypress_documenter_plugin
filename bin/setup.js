#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// 1. Setup Imports (from our previous chat)
function injectImport(filePath, importLine, insertAfterKeyword) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(importLine.trim())) {
    console.log(`✅ ${path.basename(filePath)} already has the import.`);
    return;
  }
  const lines = content.split('\n');
  let insertIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(insertAfterKeyword)) {
      insertIndex = i + 1;
      while (lines[insertIndex] === '') insertIndex++;
      break;
    }
  }
  lines.splice(insertIndex, 0, `\n${importLine}`);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  console.log(`🛠️  Updated ${path.basename(filePath)}`);
}

// 2. NEW: Setup VS Code Snippets
function setupSnippets() {
  const snippetSource = path.join(__dirname, '..', '.vscode', 'cypress-doc-snippets.json');
  const targetVscodeDir = path.join(process.cwd(), '.vscode');
  const snippetDest = path.join(targetVscodeDir, 'cypress-doc-snippets.code-snippets');

  if (fs.existsSync(snippetSource)) {
    if (!fs.existsSync(targetVscodeDir)) {
      fs.mkdirSync(targetVscodeDir, { recursive: true });
    }
    fs.copyFileSync(snippetSource, snippetDest);
    console.log('🛠️  Copied VS Code snippets to .vscode/cypress-doc-snippets.code-snippets');
  }
}

// --- Execution ---
console.log('\nSetting up cypress-test-doc-plugin...\n');

setupSnippets();

injectImport('cypress.config.ts', "import { registerTestDocumentation } from 'cypress_test_documenter/src/node'", 'import');
injectImport('cypress/support/e2e.ts', "import 'cypress_test_documenter/src/browser'", 'import');

console.log('\n✨ Setup complete! Please reload your VS Code window if it is open.\n');