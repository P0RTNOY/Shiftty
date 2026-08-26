import { generatePdfHtml, escapeHtml, PdfHtmlOptions } from './pdf-html-generator';

describe('pdf-html-generator', () => {
  describe('escapeHtml', () => {
    it('escapes common XSS vectors', () => {
      expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
      expect(escapeHtml('"&\'<>')).toBe('&quot;&amp;&#039;&lt;&gt;');
    });

    it('handles null or undefined safely', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });
  });

  describe('generatePdfHtml', () => {
    const baseOptions: PdfHtmlOptions = {
      title: 'דו"ח שעות',
      headers: ['תאריך', 'כניסה', 'יציאה', 'הערות'],
      rows: [
        ['01/08/2026', '08:00', '16:00', 'רגיל'],
        ['02/08/2026', '15:00', '02:00', '<script>bad()</script>']
      ]
    };

    it('generates a valid HTML skeleton with RTL direction and Hebrew language', () => {
      const result = generatePdfHtml(baseOptions);
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html dir="rtl" lang="he">');
    });

    it('escapes title and rows', () => {
      const result = generatePdfHtml(baseOptions);
      expect(result).toContain('דו&quot;ח שעות');
      expect(result).toContain('&lt;script&gt;bad()&lt;/script&gt;');
    });

    it('includes optional subtitle and totals', () => {
      const result = generatePdfHtml({
        ...baseOptions,
        subtitle: 'חודש אוגוסט',
        note: 'הסכום <משוער> & אינו תלוש',
        totals: [
          { label: 'סה"כ שעות', value: '15:00' },
          { label: 'שכר כולל', value: '₪ 500' }
        ]
      });

      expect(result).toContain('חודש אוגוסט');
      expect(result).toContain('סה&quot;כ שעות');
      expect(result).toContain('₪ 500');
      expect(result).toContain('<p class="note">הסכום &lt;משוער&gt; &amp; אינו תלוש</p>');
      expect(result).toContain('break-inside: avoid');
    });

    it('does not add irrelevant signature fields to a data export', () => {
      const result = generatePdfHtml(baseOptions);
      expect(result).not.toContain('חתימת עובד');
      expect(result).not.toContain('חתימת מנהל');
    });

    it('keeps every escaped row in a long RTL report with multipage-safe table styles', () => {
      const rows = Array.from({ length: 120 }, (_, index) => [`${index + 1}`, `משמרת <${index + 1}>`]);
      const result = generatePdfHtml({ title: 'דוח ארוך', note: 'הערה יחידה', headers: ['מספר', 'כותרת'], rows });

      expect(result).toContain('<html dir="rtl" lang="he">');
      expect(result).toContain('display: table-header-group');
      expect(result).toContain('page-break-before: always');
      expect(result).toContain('page-break-inside: avoid');
      expect((result.match(/<tr>/g) ?? []).length).toBe(130);
      expect(result.match(/<table class="report-table">/g)).toHaveLength(10);
      expect(result.match(/<thead>/g)).toHaveLength(10);
      expect(result).toContain('משמרת &lt;120&gt;');
      expect(result.match(/הערה יחידה/g)).toHaveLength(1);
    });
  });
});
