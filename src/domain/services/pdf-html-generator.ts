export interface PdfHtmlOptions {
  title: string;
  subtitle?: string;
  totals?: { label: string; value: string }[];
  headers: string[];
  rows: string[][];
  includeNotes?: boolean;
}

export function generatePdfHtml(options: PdfHtmlOptions): string {
  const { title, subtitle, totals, headers, rows } = options;

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 20mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      direction: rtl;
      text-align: right;
      color: #333;
      margin: 0;
      padding: 0;
      font-size: 12px;
    }
    .header {
      margin-bottom: 20px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 10px;
    }
    h1 {
      font-size: 24px;
      margin: 0 0 5px 0;
      color: #0f172a;
    }
    .subtitle {
      font-size: 14px;
      color: #64748b;
      margin: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
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
      padding: 8px;
      text-align: right;
    }
    th {
      background-color: #f8fafc;
      font-weight: 600;
      color: #334155;
    }
    .totals {
      margin-top: 20px;
      width: 50%;
      margin-right: auto;
      border: 1px solid #cbd5e1;
      border-collapse: collapse;
    }
    .totals th, .totals td {
      padding: 8px;
      border: 1px solid #cbd5e1;
    }
    .totals th {
      background-color: #f1f5f9;
      width: 60%;
    }
    .signature {
      margin-top: 50px;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
    }
    .signature-box {
      width: 40%;
      border-top: 1px solid #333;
      padding-top: 5px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
  </div>

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

  <div class="signature">
    <div class="signature-box">חתימת עובד</div>
    <div class="signature-box">חתימת מנהל</div>
  </div>
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
