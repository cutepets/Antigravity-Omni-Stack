/**
 * excel.ts — ExcelJS helper
 * Replaces the vulnerable `xlsx` (SheetJS) library.
 * Exposes a thin, browser-compatible API for exporting/importing .xlsx files.
 */
import ExcelJS from 'exceljs'

type Row = Record<string, string | number | boolean | null | undefined>

/**
 * Export a JSON array to a single-sheet .xlsx file and trigger browser download.
 *
 * @param rows      Array of plain objects (keys become column headers)
 * @param sheetName Sheet tab label
 * @param fileName  Output file name (e.g. 'report.xlsx')
 */
export async function exportJsonToExcel(rows: Row[], sheetName: string, fileName: string): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)

  if (rows.length === 0) return

  const headers = Object.keys(rows[0]!)
  sheet.addRow(headers)

  for (const row of rows) {
    sheet.addRow(headers.map((h) => row[h] ?? ''))
  }

  await triggerDownload(workbook, fileName)
}

/**
 * Export multiple named sheets from JSON arrays.
 *
 * @param sheets  Array of { name, rows } — each becomes one sheet tab
 * @param fileName Output file name
 */
export async function exportMultiSheetToExcel(
  sheets: Array<{ name: string; rows: Row[] }>,
  fileName: string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook()

  for (const { name, rows } of sheets) {
    const sheet = workbook.addWorksheet(name)
    if (rows.length === 0) continue
    const headers = Object.keys(rows[0]!)
    sheet.addRow(headers)
    for (const row of rows) {
      sheet.addRow(headers.map((h) => row[h] ?? ''))
    }
  }

  await triggerDownload(workbook, fileName)
}

/**
 * Export raw array-of-arrays (like XLSX.utils.aoa_to_sheet) to a single sheet.
 *
 * @param data      2D array — first row is headers
 * @param colWidths Optional column character widths array
 * @param sheetName Sheet tab label
 * @param fileName  Output file name
 */
export async function exportAoaToExcel(
  data: Array<Array<string | number | boolean | null | undefined>>,
  sheetName: string,
  fileName: string,
  colWidths?: number[],
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)

  for (const row of data) {
    sheet.addRow(row)
  }

  if (colWidths) {
    sheet.columns = colWidths.map((width) => ({ width }))
  }

  await triggerDownload(workbook, fileName)
}

/**
 * Read the first sheet of an Excel File into an Array of Arrays.
 * This skips empty rows and maps cells to their actual values.
 * 
 * @param file The uploaded File object
 * @returns 2D array of rows
 */
export async function importExcelToAoa(file: File): Promise<any[][]> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(arrayBuffer)
  
  const worksheet = workbook.worksheets[0]
  if (!worksheet) return []

  const result: any[][] = []
  
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    // row.values usually starts at index 1 for ExcelJS
    const rowValues = Array.isArray(row.values) ? row.values.slice(1) : []
    // Map objects if cell is formulated, etc.
    const mapped = rowValues.map((cell: any) => {
      if (cell && typeof cell === 'object' && cell.result !== undefined) {
        return cell.result
      }
      return cell
    })
    
    // Fill the empty elements to make the array length match
    if (mapped.length > 0) {
       result.push(mapped)
    }
  })
  
  return result
}

// ── Internal ────────────────────────────────────────────────────────────────

async function triggerDownload(workbook: ExcelJS.Workbook, fileName: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
