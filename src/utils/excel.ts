import * as XLSX from 'xlsx'

export function readExcelFile(file: File | ArrayBuffer): { headers: string[], data: any[], sheetName: string } {
  const workbook = XLSX.read(file, { type: file instanceof File ? 'binary' : 'array' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
  
  if (jsonData.length === 0) {
    return { headers: [], data: [], sheetName }
  }
  
  const headers = jsonData[0].map(h => String(h || '').trim())
  const data = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== null && cell !== ''))
    .map(row => {
      const obj: any = {}
      headers.forEach((header, index) => {
        obj[header] = row[index]
      })
      return obj
    })
  
  return { headers, data, sheetName }
}

export function exportToExcel(data: any[], fileName: string, sheetName = 'Sheet1') {
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, fileName)
}

export function exportMultipleSheets(sheets: { name: string, data: any[] }[], fileName: string) {
  const workbook = XLSX.utils.book_new()
  sheets.forEach(sheet => {
    const worksheet = XLSX.utils.json_to_sheet(sheet.data)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  })
  XLSX.writeFile(workbook, fileName)
}
