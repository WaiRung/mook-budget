import type { BudgetItem, BudgetSheet, BudgetSummary, BudgetTable } from '../types/accounting'

export type ExcelRow = Array<string | number | Date | null | undefined>

const normalize = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ')

const numberFrom = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const cleaned = String(value ?? '').replace(/,/g, '').replace(/[^0-9.()-]/g, '')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

const textFrom = (value: unknown): string => {
  if (value instanceof Date) return value.toLocaleDateString('th-TH')
  return normalize(value)
}

const findColumn = (row: ExcelRow, expected: string) =>
  row.findIndex((cell) => normalize(cell) === expected)

export function parseBudgetSheet(name: string, rows: ExcelRow[]): BudgetSheet | null {
  let headerIndex = -1
  let nameColumn = -1
  let detailColumn = -1
  let amountColumn = -1
  let totalColumn = -1

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    const foundName = findColumn(row, 'รายการ')
    const foundDetail = findColumn(row, 'รายละเอียด')
    const foundAmount = findColumn(row, 'จำนวน (บาท)')
    const foundTotal = findColumn(row, 'รวม')

    if (foundName >= 0 && foundDetail >= 0 && foundAmount >= 0 && foundTotal > foundAmount) {
      headerIndex = rowIndex
      nameColumn = foundName
      detailColumn = foundDetail
      amountColumn = foundAmount
      totalColumn = foundTotal
      break
    }
  }

  if (headerIndex < 0) return null

  const numberColumn = Math.max(0, nameColumn - 1)
  const header = rows[headerIndex] ?? []
  const subheader = rows[headerIndex + 1] ?? []
  const periodColumns = Array.from(
    { length: totalColumn - amountColumn - 1 },
    (_, offset) => amountColumn + offset + 1,
  )
  const tableStarts: number[] = []

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const rawNumber = rows[rowIndex]?.[numberColumn]
    const numeric = numberFrom(rawNumber)
    if (rawNumber !== null && rawNumber !== undefined && numeric > 0 && Number.isInteger(numeric)) {
      tableStarts.push(rowIndex)
    }
  }

  const tables: BudgetTable[] = tableStarts.flatMap((startRow, tableIndex) => {
    const nextStart = tableStarts[tableIndex + 1] ?? rows.length
    const start = rows[startRow] ?? []
    const tableNumber = numberFrom(start[numberColumn])
    let summaryRow = nextStart - 1

    if (tableIndex === tableStarts.length - 1) {
      const detectedSummary = rows.findIndex((row, rowIndex) =>
        rowIndex > startRow && textFrom(row[nameColumn]).startsWith('รวม'),
      )
      if (detectedSummary >= startRow) summaryRow = detectedSummary
    }

    const summaryName = textFrom(rows[summaryRow]?.[nameColumn])
    const itemCandidates: number[] = []

    for (let rowIndex = startRow + 1; rowIndex < summaryRow; rowIndex += 1) {
      const row = rows[rowIndex] ?? []
      const rowNumber = row[numberColumn]
      const hasName = textFrom(row[nameColumn]).length > 0
      const numericRowNumber = numberFrom(rowNumber)
      const isUnnumbered = rowNumber === null || rowNumber === undefined || normalize(rowNumber) === ''
      const isLeafNumber = !isUnnumbered && !Number.isInteger(numericRowNumber) && textFrom(row[detailColumn]).length > 0
      if ((isUnnumbered || isLeafNumber) && hasName && numberFrom(row[amountColumn]) > 0) itemCandidates.push(rowIndex)
    }

    const startHasAmount = numberFrom(start[amountColumn]) > 0
    if (itemCandidates.length === 0 && startHasAmount) itemCandidates.push(startRow)

    const items: BudgetItem[] = itemCandidates.map((rowIndex) => {
      const row = rows[rowIndex] ?? []
      const amount = numberFrom(row[amountColumn])
      return {
        id: `${name}:${rowIndex + 1}`,
        rowNumber: rowIndex + 1,
        name: textFrom(row[nameColumn]),
        detail: textFrom(row[detailColumn]),
        amount,
        total: numberFrom(row[totalColumn]),
        periods: periodColumns.map((column) => ({
          column,
          name: textFrom(header[column]),
          detail: textFrom(subheader[column]),
          amount: numberFrom(row[column]),
        })),
      }
    })

    const summary: BudgetSummary = {
      name: summaryName || textFrom(start[nameColumn]) || `ตารางที่ ${tableNumber}`,
      amount: numberFrom(rows[summaryRow]?.[amountColumn]),
      total: numberFrom(rows[summaryRow]?.[totalColumn]),
      periods: periodColumns.map((column) => numberFrom(rows[summaryRow]?.[column])),
    }

    return [{
      id: `${name}:table:${tableNumber}`,
      number: tableNumber,
      title: textFrom(start[nameColumn]) || `ตารางที่ ${tableNumber}`,
      firstRow: startRow + 1,
      items,
      summary,
    }]
  })

  return { name, tables }
}
