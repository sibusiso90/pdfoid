import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js'

const resolvedPdfjsLib =
  typeof pdfjsLib.getDocument === 'function'
    ? pdfjsLib
    : pdfjsLib?.default && typeof pdfjsLib.default.getDocument === 'function'
      ? pdfjsLib.default
      : null

const DEFAULT_MAX_PAGES = 80
const DEFAULT_SAMPLE_LINES = 20
const ROW_Y_TOLERANCE = 2.5

function parseArgs(argv) {
  const files = []
  let maxPages = DEFAULT_MAX_PAGES
  let sampleLines = DEFAULT_SAMPLE_LINES
  let outDir = ''

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]

    if (value === '--max-pages') {
      const next = Number(argv[index + 1])
      if (Number.isFinite(next) && next > 0) {
        maxPages = next
        index += 1
        continue
      }
      throw new Error('Expected a positive number after --max-pages')
    }

    if (value === '--sample-lines') {
      const next = Number(argv[index + 1])
      if (Number.isFinite(next) && next > 0) {
        sampleLines = next
        index += 1
        continue
      }
      throw new Error('Expected a positive number after --sample-lines')
    }

    if (value === '--out-dir') {
      const next = argv[index + 1]
      if (next) {
        outDir = next
        index += 1
        continue
      }
      throw new Error('Expected a directory path after --out-dir')
    }

    files.push(value)
  }

  return { files, maxPages, outDir, sampleLines }
}

function normalizeSpace(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function isMeaningfulLine(value) {
  if (value.length < 8) {
    return false
  }

  if (!/[A-Za-z]/.test(value)) {
    return false
  }

  return /[A-Za-z]{3,}/.test(value)
}

async function extractLines(filePath, maxPages) {
  if (!resolvedPdfjsLib) {
    throw new Error('Unable to resolve pdfjs-dist getDocument export in Node runtime')
  }

  const buffer = await fs.readFile(filePath)
  const document = await resolvedPdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
  }).promise

  const pages = document.numPages || 0
  const scannedPages = Math.min(maxPages, pages)
  const parsedLines = []

  for (let page = 1; page <= scannedPages; page += 1) {
    const pdfPage = await document.getPage(page)
    const content = await pdfPage.getTextContent()
    const items = Array.isArray(content.items) ? content.items : []
    const rows = []

    for (const item of items) {
      const text = normalizeSpace(typeof item?.str === 'string' ? item.str : '')
      if (!text) {
        continue
      }

      const transform = Array.isArray(item?.transform) ? item.transform : []
      const x = typeof transform[4] === 'number' ? transform[4] : 0
      const y = typeof transform[5] === 'number' ? transform[5] : 0

      let row = rows.find((entry) => Math.abs(entry.y - y) <= ROW_Y_TOLERANCE)
      if (!row) {
        row = { y, items: [] }
        rows.push(row)
      }

      row.items.push({ x, text })
    }

    rows.sort((left, right) => right.y - left.y)

    for (const row of rows) {
      row.items.sort((left, right) => left.x - right.x)
      const text = normalizeSpace(row.items.map((entry) => entry.text).join(' '))
      if (!text) {
        continue
      }

      parsedLines.push({ page, text })
    }
  }

  try {
    await document.destroy()
  } catch {
    // Ignore cleanup failures.
  }

  return {
    pages,
    scannedPages,
    lines: parsedLines,
    meaningfulLines: parsedLines.filter((entry) => isMeaningfulLine(entry.text)),
  }
}

function printResult(filePath, result, sampleLines) {
  const displayName = path.basename(filePath)
  const sample = result.meaningfulLines.slice(0, sampleLines)

  console.log(`FILE: ${displayName}`)
  console.log(`PATH: ${filePath}`)
  console.log(`PAGES: ${result.pages}`)
  console.log(`SCANNED_PAGES: ${result.scannedPages}`)
  console.log(`LINES: ${result.lines.length}`)
  console.log(`MEANINGFUL_LINES: ${result.meaningfulLines.length}`)
  console.log(`HAS_TEXT_LAYER: ${result.meaningfulLines.length > 0 ? 'yes' : 'no'}`)
  console.log('SAMPLE_START')

  if (sample.length === 0) {
    console.log('(no meaningful lines extracted)')
  }

  sample.forEach((entry, index) => {
    console.log(`${index + 1}. [p${entry.page}] ${entry.text}`)
  })

  console.log('SAMPLE_END')
  console.log('')
}

function toSafeName(filePath) {
  return path
    .basename(filePath, path.extname(filePath))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function writeExtractFile(filePath, result, outDir) {
  if (!outDir) {
    return
  }

  await fs.mkdir(outDir, { recursive: true })

  const targetPath = path.join(outDir, `${toSafeName(filePath)}.md`)
  const lines = [
    `# Extracted Text: ${path.basename(filePath)}`,
    '',
    `- Source path: ${filePath}`,
    `- Total pages: ${result.pages}`,
    `- Scanned pages: ${result.scannedPages}`,
    `- Extracted lines: ${result.lines.length}`,
    `- Meaningful lines: ${result.meaningfulLines.length}`,
    '',
    '## Extracted Lines',
    '',
  ]

  if (result.lines.length === 0) {
    lines.push('- No lines extracted.')
  } else {
    for (const entry of result.lines) {
      lines.push(`- [p${entry.page}] ${entry.text}`)
    }
  }

  lines.push('')
  await fs.writeFile(targetPath, `${lines.join('\n')}`, 'utf8')
}

async function main() {
  const { files, maxPages, outDir, sampleLines } = parseArgs(process.argv.slice(2))

  if (files.length === 0) {
    console.error('Usage: node scripts/extract-pdf-lines.mjs [--max-pages N] [--sample-lines N] [--out-dir DIR] <pdf-path> [pdf-path...]')
    process.exitCode = 1
    return
  }

  let hadError = false

  for (const filePath of files) {
    try {
      const result = await extractLines(filePath, maxPages)
      await writeExtractFile(filePath, result, outDir)
      printResult(filePath, result, sampleLines)
    } catch (error) {
      hadError = true
      console.log(`FILE: ${path.basename(filePath)}`)
      console.log(`PATH: ${filePath}`)
      console.log(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
      console.log('')
    }
  }

  if (hadError) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exit(1)
})