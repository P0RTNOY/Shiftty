export interface CsvExportOptions {
  includeBOM?: boolean;
  delimiter?: string;
}

export type CsvCellValue = string | number | boolean | null | undefined;

export interface CsvColumn {
  key: string;
  header: string;
  /**
   * If true, this column contains user input and will be protected against formula injection
   * (e.g., prefixing with a single quote if it starts with =, +, -, or @).
   * Negative numbers or generated text should have this set to false.
   */
  isUserText?: boolean;
}

export interface CsvReportData {
  columns: CsvColumn[];
  rows: Record<string, CsvCellValue>[];
}

export function generateCsv(data: CsvReportData, options?: CsvExportOptions): string {
  const delimiter = options?.delimiter || ',';
  const includeBOM = options?.includeBOM ?? true;

  let output = includeBOM ? '\uFEFF' : '';

  // Write headers
  output += data.columns.map(col => formatCsvCell(col.header, delimiter, false)).join(delimiter) + '\r\n';

  // Write rows
  for (const row of data.rows) {
    const rowValues = data.columns.map(col => {
      const val = row[col.key];
      return formatCsvCell(val, delimiter, col.isUserText);
    });
    output += rowValues.join(delimiter) + '\r\n';
  }

  return output;
}

function formatCsvCell(value: CsvCellValue, delimiter: string, protectInjection = false): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);

  // Formula injection protection for user-entered text
  if (protectInjection && str.length > 0) {
    const firstChar = str.charAt(0);
    if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@') {
      // Prefix with a single quote so Excel treats it as text, not a formula
      str = "'" + str;
    }
  }

  // Quote escaping if necessary
  const needsQuotes = str.includes(delimiter) || str.includes('\\n') || str.includes('\\r') || str.includes('"');
  if (needsQuotes) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }

  return str;
}
