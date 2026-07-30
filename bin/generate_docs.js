#!/usr/bin/env node
const { execSync } = require('child_process');

// Get the spec path from the user's arguments (e.g., npx generate_docs cypress/e2e/myFile.cy.ts)
const specPath = process.argv[2];

if (!specPath) {
  console.error('\n❌ Error: Please provide a spec file or directory.');
  console.error('Usage: npx generate_docs <path-to-spec>\n');
  process.exit(1);
}

console.log(`\n🚀 Running Cypress for: ${specPath}\n`);

// We just run the standard cypress run command, which triggers your plugin!
execSync(`npx cypress run --spec "${specPath}"`, { stdio: 'inherit' });