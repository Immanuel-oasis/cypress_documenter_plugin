import * as fs from 'fs'
import * as path from 'path'
import ExcelJS from 'exceljs'
import type { TestDocEntry } from '../types' // Updated path to match new structure

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

/**
 * Extracts the base prefix from a user-provided ID.
 * 
 * e.g., "TC_ADM_001" -> "TC_ADM"
 * 
 * e.g., "TC_ADM" -> "TC_ADM"
 */
function getBasePrefix(id: string): string {
  const match = id.match(/^(.*?)(?:_\d+)?$/)
  return match ? match[1] : id
}

/**
 * Auto-derives a prefix from the suite name.
 * Rules: 1st 3 letters of word 1, 1st letter of word 2. Fallbacks for short strings.
 */
function derivePrefix(suite: string): string {
  // Extract actual words first
  const words = suite.match(/[a-zA-Z]+/g) || []
  let prefix = ''

  if (words.length === 0) return 'TEST' // Absolute fallback

  // Keep the first letter as-is, strip vowels from the rest of the word
  const stripVowelsAfterFirst = (word: string): string => {
    const first = word[0]
    const rest = word.slice(1).replace(/[aeiouAEIOU]/g, '')
    return (first + rest).toUpperCase()
  }

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

  return `TC_${prefix}`
}

/**
 * Resolves the final ID string for a test.
 */
function resolveId(entry: TestDocEntry, registry: IdRegistry): string {
  // 1. If this exact test has already been registered, return its locked-in ID
  if (registry.testKeyToId[entry.testKey]) {
    return registry.testKeyToId[entry.testKey]
  }

  let basePrefix: string

  // 2. Determine the base prefix
  if (entry.id) {
    // User provided an ID (e.g., "TC_ADM" or "TC_ADM_005"). Strip numbers to get base.
    basePrefix = getBasePrefix(entry.id)
  } else {
    // User omitted ID. Auto-derive from suite name.
    basePrefix = derivePrefix(entry.suite)
  }

  // 3. Get the next number for this prefix
  const currentCount = registry.prefixCounters[basePrefix] || 0
  const nextCount = currentCount + 1
  registry.prefixCounters[basePrefix] = nextCount

  // 4. Format the final ID (e.g., TC_HOMP_0001)
  const finalId = `${basePrefix}_${String(nextCount).padStart(4, '0')}`

  // 5. Lock it to this testKey forever
  registry.testKeyToId[entry.testKey] = finalId

  return finalId
}
// --- END NEW LOGIC ---


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

function resetEntries() {
  ensureDir()
  fs.writeFileSync(ENTRIES_FILE, JSON.stringify([], null, 2))
  // Also reset the ID registry so counters start fresh
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify({ prefixCounters: {}, testKeyToId: {} }, null, 2))
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

  const latestPath = path.join(OUTPUT_DIR, 'test-documentation-latest.xlsx')

  try {
    await workbook.xlsx.writeFile(latestPath)
  } catch (err: any) {
    if (err?.code === 'EBUSY' || err?.code === 'EPERM') {
      const fallbackPath = path.join(OUTPUT_DIR, `test-documentation-${Date.now()}.xlsx`)
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

      // 1. Read the current ID registry
      const registry = readRegistry()

      // 2. Resolve or generate the ID
      const finalId = resolveId(entry, registry)

      // 3. Assign the final ID to the entry
      entry.id = finalId

      // 4. Save the updated registry (new counters and testKey mappings)
      writeRegistry(registry)

      // 5. Continue with normal entry merging
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