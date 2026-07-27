import * as fs from 'node:fs'
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
  const oldEntries = readEntries()
  ensureDir()
  // check if entry id exists

  const newID = new Set(entries.map(e => e.id))
  const filteredOldEntries = oldEntries.filter(e => !newID.has(e.id))

  const newEntries = [...filteredOldEntries, ...entries]
  fs.writeFileSync(ENTRIES_FILE, JSON.stringify(newEntries, null, 2))
}

function formatProcedure(procedure: string[] | string): string {
  if (Array.isArray(procedure)) {
    return procedure.map((step, i) => `${i + 1}. ${step}`).join('\n')
  }
  return procedure
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
      preconditions: formatProcedure(entry.preconditions),
      procedure: formatProcedure(entry.procedure),
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

  // const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  // const outPath = path.join(OUTPUT_DIR, `test-documentation-${timestamp}.xlsx`)
  // await workbook.xlsx.writeFile(outPath)

  // Also keep a stable "latest" copy that's easy to link to / open repeatedly
  const latestPath = path.join(OUTPUT_DIR, 'test-documentation-latest.xlsx')
  await workbook.xlsx.writeFile(latestPath)

  return { latestPath, count: entries.length }
}

let entries: TestDocEntry[] = [];

export function registerTestDocumentation(on: Cypress.PluginEvents) {
  on('before:run', () => {
    ensureDir()
  })

  on('task', {
    recordTestDoc(entry: TestDocEntry) {
      entries.push(entry)
      return null
    },
  })

  on('after:run', async () => {
    if (entries.length === 0) return
    writeEntries(entries)
    const result = await generateXlsx(entries)
    // eslint-disable-next-line no-console
    console.log(
      `\n📄 Test documentation generated: ${result.latestPath} (${result.count} test cases)\n`
    )
  })
}