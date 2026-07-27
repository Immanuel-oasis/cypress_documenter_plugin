
import * as fs from 'fs'
import * as path from 'path'
import ExcelJS from 'exceljs'
import type { TestDocEntry } from '../support/types/test-documentation'

const OUTPUT_DIR = path.join(process.cwd(), 'cypress', 'test-docs')
const ENTRIES_FILE = path.join(OUTPUT_DIR, '_entries.json')

function ensureDir() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

function readEntries(): TestDocEntry[] {
  if (!fs.existsSync(ENTRIES_FILE)) return []
  return JSON.parse(fs.readFileSync(ENTRIES_FILE, 'utf-8'))
}

function writeEntries(entries: TestDocEntry[]) {
  ensureDir()
  const oldEntries = readEntries()

  // Merge by testKey (spec path + full test title), NOT by the user-typed
  // `id`. testKey is auto-computed and guaranteed unique + stable across
  // runs regardless of execution order; `id` is just a human-readable
  // label and can't be trusted to be unique (people copy-paste test cases
  // and forget to update the id). Deduping by `id` would silently drop one
  // of two different tests that happen to share the same typed id.
  const newKeys = new Set(entries.map((e) => e.testKey))
  const keptOldEntries = oldEntries.filter((e) => !newKeys.has(e.testKey))

  const merged = [...keptOldEntries, ...entries]

  warnOnDuplicateIds(merged)

  fs.writeFileSync(ENTRIES_FILE, JSON.stringify(merged, null, 2))
}

/**
 * Doesn't affect what gets written — testKey already keeps different tests
 * from colliding. This just surfaces a helpful warning so a copy-paste
 * mistake (two different tests both labeled "TC_ADM_001") gets noticed and
 * fixed, instead of silently producing a spreadsheet with a confusing
 * duplicate label in the Test Case ID column.
 */
function warnOnDuplicateIds(entries: TestDocEntry[]) {
  const idToKeys = new Map<string, Set<string>>()
  for (const entry of entries) {
    if (!idToKeys.has(entry.id)) idToKeys.set(entry.id, new Set())
    idToKeys.get(entry.id)!.add(entry.testKey)
  }

  for (const [id, keys] of idToKeys) {
    if (keys.size > 1) {
      // eslint-disable-next-line no-console
      console.warn(
        `\n⚠️  Duplicate Test Case ID "${id}" used by ${keys.size} different tests:\n` +
        Array.from(keys).map((k) => `   - ${k}`).join('\n') +
        `\n   Both are kept in the spreadsheet (no data lost), but you'll ` +
        `probably want to give them distinct IDs.\n`
      )
    }
  }
}

/**
 * Wipes all accumulated entries. Not called automatically — accumulation
 * across runs is the whole point (see writeEntries above). Opt in with:
 *   RESET_TEST_DOCS=true npx cypress run
 * Useful for pruning stale rows after renaming/removing test cases, since
 * nothing else ever removes an old entry that no longer matches any ID
 * produced by the current run.
 */
function resetEntries() {
  ensureDir()
  fs.writeFileSync(ENTRIES_FILE, JSON.stringify([], null, 2))
}

function formatList(value: string[] | string, numbered: boolean): string {
  if (Array.isArray(value)) {
    return numbered
      ? value.map((item, i) => `${i + 1}. ${item}`).join('\n')
      : value.join('\n')
  }
  return value
}

async function generateXlsx(entries: TestDocEntry[]) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Test Documentation')

  const columns: { header: string; key: keyof TestDocEntry | 'no'; width: number }[] = [
    { header: '', key: 'no', width: 5 },
    { header: 'Test Suit ID', key: 'suite', width: 16 },
    { header: 'Test Case ID', key: 'id', width: 14 },
    { header: 'Test Case Description', key: 'description', width: 42 },
    { header: 'Preconditions', key: 'preconditions', width: 20 },
    { header: 'Test Procedure', key: 'procedure', width: 42 },
    { header: 'Test Data', key: 'testData', width: 16 },
    { header: 'Expected Result', key: 'expectedResult', width: 34 },
    { header: 'Actual Result', key: 'actualResult', width: 34 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Assigned', key: 'assigned', width: 14 },
    { header: 'Comment', key: 'comment', width: 32 },
  ]

  sheet.columns = columns as any

  entries.forEach((entry, index) => {
    const row = sheet.addRow({
      no: index + 1,
      suite: entry.suite,
      id: entry.id,
      description: entry.description,
      preconditions: formatList(entry.preconditions, false),
      procedure: formatList(entry.procedure, true),
      testData: entry.testData,
      expectedResult: entry.expectedResult,
      actualResult: entry.actualResult,
      status: entry.status,
      assigned: entry.assigned || '',
      comment: entry.comment || '',
    })

    row.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' }
    row.font = { name: 'Arial', size: 10 }

    // Color the Status cell green/red for a quick visual scan
    const statusCell = row.getCell('status')
    statusCell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: entry.status === 'Passed' ? 'FF006100' : 'FF9C0006' },
    }
    statusCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: entry.status === 'Passed' ? 'FFC6EFCE' : 'FFFFC7CE' },
    }
  })

  // Header styling
  const headerRow = sheet.getRow(1)
  headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  // Clean up any old timestamped files from previous versions of this script,
  // or from before this fix — keeps the folder down to just one file.
  cleanupOldFiles()

  const latestPath = path.join(OUTPUT_DIR, 'test-documentation-latest.xlsx')

  try {
    await workbook.xlsx.writeFile(latestPath)
  } catch (err: any) {
    if (err?.code === 'EBUSY' || err?.code === 'EPERM') {
      // The file is almost certainly open in Excel right now, which takes
      // an exclusive lock on Windows. Don't crash the whole task — fall
      // back to a timestamped file so this run's results aren't lost, and
      // tell the person what to do.
      const fallbackPath = path.join(
        OUTPUT_DIR,
        `test-documentation-${Date.now()}.xlsx`
      )
      await workbook.xlsx.writeFile(fallbackPath)
      // eslint-disable-next-line no-console
      console.warn(
        `\n⚠️  Could not overwrite test-documentation-latest.xlsx — it's ` +
        `probably open in Excel right now. Close it and re-run to get a ` +
        `single "latest" file again. Wrote this run's results to:\n` +
        `   ${fallbackPath}\n`
      )
      return { latestPath: fallbackPath, count: entries.length }
    }
    throw err
  }

  return { latestPath, count: entries.length }
}

function cleanupOldFiles() {
  if (!fs.existsSync(OUTPUT_DIR)) return

  const files = fs.readdirSync(OUTPUT_DIR)
  for (const file of files) {
    // Skip Microsoft Office's own lock files (created automatically while
    // a workbook is open, e.g. "~$test-documentation-latest.xlsx"). These
    // aren't ours to manage, and deleting one while Excel has the real file
    // open can throw.
    if (file.startsWith('~$')) continue

    // Delete every generated xlsx EXCEPT the stable "latest" one
    // (which we're about to overwrite anyway) and the entries json.
    if (file.endsWith('.xlsx') && file !== 'test-documentation-latest.xlsx') {
      try {
        fs.unlinkSync(path.join(OUTPUT_DIR, file))
      } catch (err: any) {
        // Don't let a locked/in-use file crash the whole cleanup —
        // just leave it and move on.
        // eslint-disable-next-line no-console
        console.warn(`⚠️  Could not delete ${file} (probably in use): ${err.message}`)
      }
    }
  }
}

async function regenerateAndLog(source: string) {
  const entries = readEntries()
  if (entries.length === 0) return

  const result = await generateXlsx(entries)
  // eslint-disable-next-line no-console
  console.log(
    `\n📄 [${source}] Test documentation updated: ${result.latestPath} (${result.count} test cases)\n`
  )
}

export function registerTestDocumentation(on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) {
  // Everything in this plugin is a no-op during `cypress open`. Documentation
  // only happens during `cypress run` — this is what avoids duplicate/
  // accumulating entries from refreshing or re-running specs interactively.
  // The browser-side guard lives in support/e2e-addition.ts (afterEach);
  // this is a second, independent guard in case a task ever fires anyway.
  const isRunMode = !config.isInteractive

  on('before:run', () => {
    if (!isRunMode) return
    ensureDir()
    if (process.env.RESET_TEST_DOCS === 'true') {
      resetEntries()
      // eslint-disable-next-line no-console
      console.log('\n🗑️  RESET_TEST_DOCS=true — cleared all previously accumulated entries\n')
    }
  })

  on('task', {
    recordTestDoc(entry: TestDocEntry) {
      if (!isRunMode) return null
      const entries = readEntries()
      entries.push(entry)
      writeEntries(entries)
      return null
    },
  })

  on('after:run', async () => {
    if (!isRunMode) return
    await regenerateAndLog('after:run')
  })
}