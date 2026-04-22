import Papa from "papaparse";
import * as XLSX from "xlsx";

const EXCEL_EXTENSIONS = [".xlsx", ".xls", ".xlsb", ".xlsm", ".ods"];

function isExcelFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return EXCEL_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function parseExcel(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        // Use the first sheet
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convert to JSON with headers from first row
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
          defval: "",
          raw: false, // convert everything to strings
        });

        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function parseCsvTsv(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data as Record<string, string>[]);
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
}

export function parseFile(file: File): Promise<Record<string, string>[]> {
  if (isExcelFile(file)) {
    return parseExcel(file);
  }
  // PapaParse handles CSV, TSV, and other delimited text files automatically
  return parseCsvTsv(file);
}

export function guessCompanyColumn(headers: string[]): string | undefined {
  const patterns = [
    /^company$/i,
    /^company[\s_-]?name$/i,
    /^account$/i,
    /^account[\s_-]?name$/i,
    /^organization$/i,
    /^org$/i,
    /^employer$/i,
    /company/i,
    /account/i,
    /organization/i,
  ];

  for (const pattern of patterns) {
    const match = headers.find((h) => pattern.test(h));
    if (match) return match;
  }
  return undefined;
}

export function guessTitleColumn(headers: string[]): string | undefined {
  const patterns = [
    /^title$/i,
    /^job[\s_-]?title$/i,
    /^role$/i,
    /^position$/i,
    /title/i,
    /role/i,
  ];

  for (const pattern of patterns) {
    const match = headers.find((h) => pattern.test(h));
    if (match) return match;
  }
  return undefined;
}

export function exportToCsv(
  rows: Record<string, string>[],
  filename: string
): void {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const ACCEPTED_FORMATS =
  ".csv,.tsv,.txt,.xlsx,.xls,.xlsb,.xlsm,.ods";

export const FORMAT_LABEL = "CSV, TSV, Excel (.xlsx, .xls), ODS";
