import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const AUDITED_FILES = [
  'src/shared/i18n/translations.ts',
  'src/shared/i18n/translations-phase2.ts',
  'src/shared/i18n/translations-phase3.ts',
  'src/shared/i18n/translations-phase4.ts',
  'src/shared/i18n/translations-phase5.ts',
  'src/features/reports/monthly-report-export.ts',
  'src/app/(tabs)/index.tsx',
  'src/app/(tabs)/reports.tsx',
  'src/app/shifts/[id]/index.tsx',
  'src/app/settings/salary/index.tsx',
  'src/app/settings/exports/index.tsx',
  'src/features/pay-rules/components/salary-breakdown.tsx',
  'src/features/pay-rules/components/salary-trust-disclosure.tsx',
  'src/features/shifts/components/active-shift-panel.tsx',
  'src/features/shifts/components/quick-clock-out-review.tsx',
  'src/features/reports/report-shift-row.tsx',
] as const;

const AUTHORITATIVE_PAY_PHRASES = [
  /הרווחת/,
  /מגיע לך/,
  /השכר הסופי/,
  /שכר סופי/,
  /נצבר עד עכשיו/,
  /שכר ברוטו(?! משוער)/,
  /\{\{amount\}\}\s+שכר(?=['",])/,
  /\byou earned\b/i,
  /\bearned so far\b/i,
  /\bearned pay\b/i,
  /\bfinal pay\b/i,
  /\bfinal(?:ized)? salary\b/i,
  /\bgross salary\b/i,
  /\{\{amount\}\}\s+pay(?=['",])/i,
] as const;

describe('salary trust terminology audit', () => {
  it('does not present app-calculated pay as authoritative in user-visible salary surfaces', () => {
    const findings = AUDITED_FILES.flatMap((file) => {
      const lines = readFileSync(join(process.cwd(), file), 'utf8').split(/\r?\n/);
      return lines.flatMap((line, index) => AUTHORITATIVE_PAY_PHRASES
        .filter((pattern) => pattern.test(line))
        .map((pattern) => `${file}:${index + 1}: ${pattern.exec(line)?.[0] ?? pattern.source}`));
    });

    expect(findings).toEqual([]);
  });
});
