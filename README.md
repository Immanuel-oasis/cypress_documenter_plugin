# Cypress Test Documenter

A Cypress plugin that auto-generates an Excel test documentation spreadsheet from your test runs. Each `it()` block that opts in via `cy.docTest()` becomes a row in the spreadsheet — with test case IDs, preconditions, numbered procedures, expected/actual results, pass/fail status, and more — all driven by a few custom Cypress commands sprinkled into your specs.

## Features

- 📄 **Auto-generates an Excel spreadsheet** from your cypress run results
- 🆔 **Stable test case IDs** — auto-derived from suite names (e.g. `TC-LGNT-001`), persisted across runs via a registry so the same test always gets the same ID
- ✅ **Procedure tracking** — completed steps render in black, skipped steps (written but never reached due to an earlier failure) render in red italic
- 🔢 **Sorted output** — entries are sorted by ID (prefix alphabetically, suffix numerically) before export; IDs themselves never change
- 🧩 **Custom commands** — `cy.docTest()`, `cy.precondition()`, `cy.procedure()`, `cy.actualResult()`
- 🔄 **Incremental adoption** — tests that don't call `cy.docTest()` are silently skipped, so you can migrate specs one at a time
- 📁 **File-lock tolerant** — if the output file is open in Excel, it falls back to a timestamped copy instead of crashing

## Prerequisites

- Cypress 10+
- TypeScript 5.x (Cypress does not currently support TypeScript 7+)
- Node.js 16+

## Installation

### 1. Install plugin dependencies

Open the plugin folder in a terminal or VS Code and run:

```bash
npm install
```

This pulls in the required `node_modules` (the only runtime dependency is [exceljs](https://github.com/exceljs/exceljs)).

### 2. Install the plugin into your Cypress project

We recommend placing the plugin folder in the same parent directory as your test project so the path is easy to reference:

```bash
npm install ../cypress_test_documenter
```

### 3. Run the setup command

This adds the necessary imports to your Cypress config and support files, and configures the snippets file:

```bash
npx setup-test-docs
```

### 4. Verify the configuration

After setup, confirm the following files have the right imports (the setup command should have added them automatically, but verify manually):

**cypress.config.ts**

```ts
import { defineConfig } from 'cypress'
import { registerTestDocumentation } from 'cypress_test_documenter/src/node'

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      registerTestDocumentation(on, config)
      return config
    },
  },
})
```

> **Note:** `registerTestDocumentation` takes `(on, config)` — both arguments are required. The config is used to detect interactive vs. run mode.

**cypress/support/e2e.ts**

```ts
import 'cypress_test_documenter/src/browser'
```

This imports the custom commands (`cy.docTest`, `cy.procedure`, `cy.actualResult`) and registers the `afterEach` hook that captures test results.

## Configuration Options

### Plugin Options

Pass an options object as the third argument to `registerTestDocumentation`:

```ts
registerTestDocumentation(on, config, {
  markLastProcedureAsSkipped: true,
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `markLastProcedureAsSkipped` | boolean | `false` | On a failed test, moves the last runtime procedure from "completed" (black) to "skipped" (red italic). Useful when `cy.procedure()` is used as a "what I'm about to do" marker. **Warning:** mislabels the last procedure as skipped when the failure happens after that procedure's action completed. |

### Environment Variables

| Variable | Description |
|---|---|
| `RESET_TEST_DOCS=true` | Clears all previously accumulated entries and the ID registry before the run starts. Use this when you want a fresh spreadsheet (e.g. after restructuring your test suite or renaming suites). |

## Usage

### Custom Commands

#### `cy.docTest(details)`

Initializes the test documentation metadata for the current test. **Must be called at the top of the `it()` block, before any `cy.precondition()` or `cy.procedure()` calls.**

**DocTestDetails shape:**

| Field | Type | Required | Description |
|---|---|---|---|
| `suite` | string | Yes | The test suite name (used to derive the ID prefix). |
| `id` | string | No | Manual ID override (e.g. `"TC-ADM-001"`). Auto-generated if omitted. |
| `description` | string | No | Test case description. Defaults to the `it()` block title. |
| `testData` | string | Yes | Test data used (e.g. credentials, input values). |
| `expectedResult` | string | No | Expected result. Defaults to the `it()` block title. |
| `assigned` | string | No | Name of the tester/developer assigned to this test. |
| `comment` | string | No | Free-form comment (e.g. browsers tested on). |
| `actualResultOverride` | string | No | Manual actual result override. Auto-filled from test status if omitted. |

```ts
cy.docTest({
  suite: 'Authentication',
  testData: 'admin@example.com / ********',
  description: 'Verifies that a valid user can sign in',
  assigned: 'Jane Doe',
  comment: 'Tested on Chrome and Brave',
})
```

#### `cy.precondition(text)`

Adds a precondition line to the test documentation. Multiple calls are stacked into a single cell, one per line.

```ts
cy.precondition('Application is running and accessible')
cy.precondition('User has valid credentials')
```

#### `cy.procedure(text)`

Adds a procedure step to the test documentation. Steps are numbered automatically and continuously in the spreadsheet cell. On failure, steps that were written but never reached are shown in red italic.

```ts
cy.procedure('Click on the Login button')
cy.contains('login', { matchCase: false }).click()

cy.procedure('Verify user is signed in')
cy.url().should('contain', 'dashboard')
```

#### `cy.actualResult(text)`

Sets an explicit actual result and fails the test with the given message. Use this when you want to mark a test as failed with a custom reason rather than relying on the default error message.

```ts
cy.actualResult('Login button was not visible within the 5s timeout')
```

### Full Example

```ts
it('should sign in successfully with valid credentials', () => {
  cy.docTest({
    suite: 'Authentication',
    testData: 'admin@example.com / ********',
    description: 'Verifies that a valid user can sign in',
    assigned: 'Jane Doe',
  })

  cy.precondition('Application is running and accessible')

  cy.procedure('Navigate to the home page')
  cy.visit('/')

  cy.procedure('Click on the Login button')
  cy.contains('login', { matchCase: false }).click()

  cy.procedure('Enter email and password, then submit')
  cy.get('#email').type('admin@example.com')
  cy.get('#password').type('password123')
  cy.get('#submit').click()

  cy.procedure('Verify user is signed in')
  cy.url().should('contain', 'dashboard')
})
```

## How IDs Are Generated

When `id` is omitted from `cy.docTest()`, the plugin auto-generates a stable ID:

- **Prefix** — derived from the suite name:
  1. Strip vowels after the first letter of each word.
  2. Take the first 3 letters of word #1 + the first letter of word #2.
  3. Pad with `X` to 4 characters. Prefix with `TC-`.

  **Example:** `Login Tests` → `LGNT` → `TC-LGNT`
- **Suffix** — a zero-padded sequential number (`001`, `002`, `003`, …) tracked per prefix via a persistent registry stored at `cypress/test-docs/_id_registry.json`.
- **Persistence** — the `testKeyToId` mapping ensures the same test always gets the same ID across runs. IDs are never renumbered. If a test is deleted, its ID is retired (gaps are preserved as a historical record).

## Spreadsheet Output

The spreadsheet is written to `cypress/test-docs/test-documentation-latest.xls` after each cypress run.

| Column | Source |
|---|---|
| No | Sequential row number |
| Test Suit ID | From `cy.docTest({ suite })` |
| Test Case ID | Auto-generated or manual (e.g. `TC-LGNT-001`) |
| Test Case Description | From `cy.docTest({ description })` |
| Preconditions | From `cy.precondition()` calls |
| Test Procedure | From `cy.procedure()` calls (black = completed, red italic = skipped) |
| Test Data | From `cy.docTest({ testData })` |
| Expected Result | From `cy.docTest({ expectedResult })` |
| Actual Result | Auto-filled from test status or `cy.actualResult()` |
| Status | Passed (green) / Failed (red) / Blocked (gray) |
| Assigned | From `cy.docTest({ assigned })` |
| Comment | From `cy.docTest({ comment })` |

## Best Practices

- **Call `cy.docTest()` first** — always at the very top of the `it()` block, before any other doc command. Calling `cy.procedure()` or `cy.precondition()` before `cy.docTest()` throws an error.
- **Use `cy.procedure()` as a "what I'm about to do" marker** — place it before the action it describes, not after. This way, if the action fails, the procedure correctly represents the step that was in-flight when the test broke.
- **Let IDs auto-generate** — omit the `id` field and let the plugin assign stable IDs. Manually specifying IDs is supported but can lead to duplicates if not managed carefully (the plugin warns about duplicates in the console).
- **Use `RESET_TEST_DOCS=true` sparingly** — it wipes all entries and the ID registry. Use it only when restructuring your test suite (e.g. renaming suites, which changes prefixes and would otherwise leave orphaned entries).
- **Login flows in custom commands** — if your login is in a `cy.login()` custom command that calls `cy.procedure()` internally, those login steps will appear in the spreadsheet (in black) but won't be part of the static procedure list used for skipped-step recovery. The plugin handles this gracefully via suffix-prefix matching, so skipped steps are still correctly identified.

## FAQ

**Q1: I followed all the steps but Cypress shows errors.**

Make sure you are using TypeScript 5.x. Cypress does not currently support higher versions like 7.

**Q2: I'm using TypeScript 5 and have everything running, but I still get tsconfig errors.**

This is not a plugin issue — you likely forgot to add a `tsconfig.json` to your project. Run `npx tsc --init` to create one.

**Q3: My spreadsheet is missing some tests.**

Tests that don't call `cy.docTest()` are silently skipped. This is by design — it lets you adopt the plugin incrementally, test by test.

**Q4: The skipped procedures aren't showing in red.**

This can happen if the static parser can't locate your test in the spec file. Common causes: template literals with interpolation in `describe`/`it` titles, using `specify` instead of `it`, or the spec file path not resolving correctly. Make sure your `describe` and `it` titles use plain string literals.

**Q5: The test case IDs have gaps (e.g. 001, 003, 005).**

Gaps are expected when tests are deleted. IDs are never renumbered — the gap is a historical record that a test once existed. If you want to start fresh, use `RESET_TEST_DOCS=true`.

**Q6: My spreadsheet shows login steps in every test row.**

This happens when `cy.login()` (or a `beforeEach`) calls `cy.procedure()` internally. Those steps are captured at runtime and appear in the spreadsheet. If you want cleaner rows, either remove `cy.procedure()` calls from your login command and add a single `cy.procedure('Sign in as admin')` at the test level, or accept the audit trail.
