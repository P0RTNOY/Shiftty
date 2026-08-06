import { generateCsv, CsvReportData } from './csv-generator';

describe('csv-generator', () => {
  it('generates basic CSV with BOM by default', () => {
    const data: CsvReportData = {
      columns: [{ key: 'name', header: 'שם' }, { key: 'age', header: 'גיל' }],
      rows: [{ name: 'עומר', age: 30 }]
    };
    const result = generateCsv(data);
    expect(result.startsWith('\uFEFF')).toBe(true);
    expect(result).toContain('שם,גיל\r\n');
    expect(result).toContain('עומר,30\r\n');
  });

  it('allows disabling BOM and changing delimiter', () => {
    const data: CsvReportData = {
      columns: [{ key: 'a', header: 'A' }, { key: 'b', header: 'B' }],
      rows: [{ a: '1', b: '2' }]
    };
    const result = generateCsv(data, { includeBOM: false, delimiter: ';' });
    expect(result.startsWith('\uFEFF')).toBe(false);
    expect(result).toContain('A;B\r\n');
    expect(result).toContain('1;2\r\n');
  });

  it('escapes quotes, delimiters, and newlines', () => {
    const data: CsvReportData = {
      columns: [{ key: 'val', header: 'Value' }],
      rows: [
        { val: 'has,comma' },
        { val: 'has"quote' },
        { val: 'has\nnewline' }
      ]
    };
    const result = generateCsv(data);
    expect(result).toContain('"has,comma"\r\n');
    expect(result).toContain('"has""quote"\r\n');
    expect(result).toContain('"has\nnewline"\r\n');
  });

  it('protects against formula injection for user text only', () => {
    const data: CsvReportData = {
      columns: [
        { key: 'userNote', header: 'Note', isUserText: true },
        { key: 'amount', header: 'Amount', isUserText: false }
      ],
      rows: [
        { userNote: '=1+1', amount: -50 },
        { userNote: '+alert()', amount: '+100' },
        { userNote: '-foo', amount: -20 },
        { userNote: '@bar', amount: 0 }
      ]
    };
    const result = generateCsv(data);
    // User text is prefixed with a single quote
    expect(result).toContain("'=1+1,-50\r\n");
    expect(result).toContain("'+alert(),+100\r\n");
    expect(result).toContain("'-foo,-20\r\n");
    expect(result).toContain("'@bar,0\r\n");
  });
});
