export interface PdfHtmlOptions {
  title: string;
  subtitle?: string;
  note?: string;
  totals?: { label: string; value: string }[];
  headers: string[];
  rows: string[][];
  direction?: 'rtl' | 'ltr';
  language?: string;
}

export function generatePdfHtml(options: PdfHtmlOptions): string {
  const { title, subtitle, note, totals, headers, rows, direction = 'rtl', language = 'he' } = options;

  const html = `
<!DOCTYPE html>
<html dir="${direction}" lang="${escapeHtml(language)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      direction: ${direction};
      text-align: ${direction === 'rtl' ? 'right' : 'left'};
      color: #333;
      margin: 0;
      padding: 0;
      font-size: 10px;
    }
    .header {
      margin-bottom: 14px;
      border-bottom: 3px solid #4f46e5;
      padding-bottom: 8px;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 5px 0;
      color: #0f172a;
    }
    .subtitle {
      font-size: 14px;
      color: #64748b;
      margin: 0;
    }
    .note {
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      color: #475569;
      margin: 0 0 14px 0;
      padding: 8px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    thead {
      display: table-header-group;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px;
      text-align: ${direction === 'rtl' ? 'right' : 'left'};
      vertical-align: top;
    }
    th {
      background-color: #f8fafc;
      font-weight: 600;
      color: #334155;
    }
    .totals {
      margin: 0 0 14px 0;
      width: 100%;
      border: 1px solid #cbd5e1;
      border-collapse: collapse;
    }
    .totals th, .totals td {
      padding: 8px;
      border: 1px solid #cbd5e1;
    }
    .totals th {
      background-color: #f1f5f9;
      width: 45%;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
  </div>

  ${note ? `<p class="note">${escapeHtml(note)}</p>` : ''}

  ${totals && totals.length > 0 ? `
  <table class="totals">
    <tbody>
      ${totals.map(t => `
      <tr>
        <th>${escapeHtml(t.label)}</th>
        <td>${escapeHtml(t.value)}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <table>
    <thead>
      <tr>
        ${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('\n        ')}
      </tr>
    </thead>
    <tbody>
      ${rows.map(row => `
      <tr>
        ${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('\n        ')}
      </tr>
      `).join('')}
    </tbody>
  </table>

</body>
</html>
  `.trim();

  return html;
}

export function escapeHtml(unsafe: string | null | undefined): string {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
