import * as fs from 'fs'
import * as path from 'node:path'
import ExcelJS from 'exceljs'
import type { TestDocEntry } from '../types'
import { extractFullProcedureList } from './extractProcedure'

const OUTPUT_DIR = path.join(process.cwd(), 'cypress', 'test-docs')
const ENTRIES_FILE = path.join(OUTPUT_DIR, '_entries.json')
const REGISTRY_FILE = path.join(OUTPUT_DIR, '_id_registry.json')

interface IdRegistry {
  prefixCounters: Record<string, number>
  testKeyToId: Record<string, string>
}

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

  const newKeys = new Set(entries.map((e) => e.testKey))
  const keptOldEntries = oldEntries.filter((e) => !newKeys.has(e.testKey))

  const merged = [...keptOldEntries, ...entries]

  warnOnDuplicateIds(merged)

  fs.writeFileSync(ENTRIES_FILE, JSON.stringify(merged, null, 2))
}

function readRegistry(): IdRegistry {
  if (!fs.existsSync(REGISTRY_FILE)) return { prefixCounters: {}, testKeyToId: {} }
  return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'))
}

function writeRegistry(registry: IdRegistry) {
  ensureDir()
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2))
}

function getBasePrefix(id: string): string {
  const match = id.match(/^(.*?)(?:-\d+)?$/)
  return match ? match[1] : id
}

function stripVowelsAfterFirst(word: string): string {
  const first = word[0]
  const rest = word.slice(1).replace(/[aeiouAEIOU]/g, '')
  return (first + rest).toUpperCase()
}

function derivePrefix(suite: string): string {
  const words = suite.match(/[a-zA-Z]+/g) || []
  let prefix = ''

  if (words.length === 0) return 'TEST'

  const w1 = stripVowelsAfterFirst(words[0]!)
  prefix += w1.substring(0, 3)

  if (words.length > 1) {
    const w2 = stripVowelsAfterFirst(words[1]!)
    prefix += w2.substring(0, 1)
  } else {
    prefix += w1.substring(3, 4)
  }

  while (prefix.length < 4) {
    prefix += 'X'
  }

  return `TC-${prefix}`
}

function resolveId(entry: TestDocEntry, registry: IdRegistry): string {
  if (registry.testKeyToId[entry.testKey]) {
    return registry.testKeyToId[entry.testKey]
  }

  let basePrefix: string

  if (entry.id) {
    basePrefix = getBasePrefix(entry.id)
  } else {
    basePrefix = derivePrefix(entry.suite!)
  }

  const currentCount = registry.prefixCounters[basePrefix] || 0
  const nextCount = currentCount + 1
  registry.prefixCounters[basePrefix] = nextCount

  const finalId = `${basePrefix}-${String(nextCount).padStart(3, '0')}`

  registry.testKeyToId[entry.testKey] = finalId

  return finalId
}

function warnOnDuplicateIds(entries: TestDocEntry[]) {
  const idToKeys = new Map<string, Set<string>>()
  for (const entry of entries) {
    if (!idToKeys.has(entry.id!)) idToKeys.set(entry.id!, new Set())
    idToKeys.get(entry.id!)!.add(entry.testKey)
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

function resetEntries() {
  ensureDir()
  fs.writeFileSync(ENTRIES_FILE, JSON.stringify([], null, 2))
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify({ prefixCounters: {}, testKeyToId: {} }, null, 2))
}

/**
 * On a failed test, statically re-parses the spec file to recover every
 * cy.procedure() call that was WRITTEN for this test, including ones that
 * never ran because an earlier step failed. Diffs that against what
 * actually completed (entry.procedure, already populated at runtime) and
 * returns the remainder as "skipped".
 *
 * Assumes completed steps are always a prefix of the full list — true as
 * long as cy.procedure() calls execute in source order, which they do.
 *
 * Returns [] (not an error) if the file can't be parsed or the test can't
 * be located — skipped-step highlighting just silently doesn't apply.
 */
function resolveSkippedProcedures(entry: TestDocEntry): string[] {
  if (entry.status !== 'Failed') return []
  if (!entry.specRelativePath || !entry.titlePath) return []

  const absolutePath = path.resolve(process.cwd(), entry.specRelativePath)
  const fullList = extractFullProcedureList(absolutePath, entry.titlePath)
  if (!fullList) return []

  // Completed steps should be a prefix of the full list. If they've
  // diverged (e.g. the test was edited between runs), don't guess —
  // just skip highlighting rather than show something misleading.
  const completedCount = entry.procedure.length
  const prefixMatches = entry.procedure.every((step, i) => fullList[i] === step)
  if (!prefixMatches) return []

  return fullList.slice(completedCount)
}

function formatList(value: string[] | string, numbered: boolean): string {
  if (Array.isArray(value)) {
    return numbered
      ? value.map((item, i) => `${i + 1}. ${item}`).join('\n')
      : value.join('\n')
  }
  return value
}

/**
 * Builds the rich-text runs for the "Test Procedure" cell: completed steps
 * in normal black text, skipped steps in red — all numbered continuously
 * in one cell, in one flowing list.
 */
function buildProcedureRichText(
  completed: string[],
  skipped: string[]
): ExcelJS.CellRichTextValue {
  const richText: { text: string; font?: Partial<ExcelJS.Font> }[] = []

  completed.forEach((step, i) => {
    const prefix = i === 0 ? '' : '\n'
    richText.push({ text: `${prefix}${i + 1}. ${step}`, font: { color: { argb: '000000' } } })
  })

  skipped.forEach((step, i) => {
    const num = completed.length + i + 1
    const prefix = completed.length === 0 && i === 0 ? '' : '\n'
    richText.push({
      text: `${prefix}${num}. ${step}`,
      font: { color: { argb: 'FFCC0000' }, italic: true },
    })
  })

  if (richText.length === 0) {
    richText.push({ text: '' })
  }

  return { richText }
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
      testData: entry.testData,
      expectedResult: entry.expectedResult,
      actualResult: entry.actualResult,
      status: entry.status,
      assigned: entry.assigned || '',
      comment: entry.comment || '',
    })

    // Procedure column set separately as rich text (black = completed,
    // red = written in the test but never reached).
    const procedureCell = row.getCell('procedure')
    procedureCell.value = buildProcedureRichText(
      entry.procedure,
      entry.skippedProcedure || []
    )

    row.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' }
    row.font = { name: 'Arial', size: 10 }

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

  const headerRow = sheet.getRow(1)
  headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  cleanupOldFiles()

  const latestPath = path.join(OUTPUT_DIR, 'test-documentation-latest.xls')

  try {
    await workbook.xlsx.writeFile(latestPath)
  } catch (err: any) {
    if (err?.code === 'EBUSY' || err?.code === 'EPERM') {
      const fallbackPath = path.join(OUTPUT_DIR, `test-documentation-${Date.now()}.xls`)
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
    if (file.startsWith('~$')) continue
    if (file.endsWith('.xlsx') && file !== 'test-documentation-latest.xlsx') {
      try {
        fs.unlinkSync(path.join(OUTPUT_DIR, file))
      } catch (err: any) {
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
  const isRunMode = !config.isInteractive

  on('before:run', () => {
    if (!isRunMode) return
    ensureDir()
    if (process.env.RESET_TEST_DOCS === 'true') {
      resetEntries()
      // eslint-disable-next-line no-console
      console.log('\n🗑️  RESET_TEST_DOCS=true — cleared all previously accumulated entries and ID registry\n')
    }
  })

  on('task', {
    recordTestDoc(entry: TestDocEntry) {
      if (!isRunMode) return null

      const registry = readRegistry()
      const finalId = resolveId(entry, registry)
      entry.id = finalId
      writeRegistry(registry)

      entry.skippedProcedure = resolveSkippedProcedures(entry)

      writeEntries([entry])

      return null
    },
  })

  on('after:run', async () => {
    if (!isRunMode) return
    await regenerateAndLog('after:run')
  })
}