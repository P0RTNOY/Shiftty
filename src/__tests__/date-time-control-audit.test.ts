import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function source(file: string): string {
  return readFileSync(join(process.cwd(), file), 'utf8');
}

describe('user-facing date and time control audit', () => {
  it.each([
    ['src/app/shifts/active/expected-end.tsx', ['<DateField', '<TimeField']],
    ['src/app/shifts/active/end.tsx', ['<DateField', '<TimeField']],
    ['src/app/shifts/[id]/breaks.tsx', ['<TimeField']],
    ['src/app/shifts/start/unscheduled.tsx', ['<TimeField']],
    ['src/app/settings/salary/index.tsx', ['<DateField']],
    ['src/app/settings/salary/rules.tsx', ['<DateField', '<TimeField']],
    ['src/features/templates/components/template-form.tsx', ['<TimeField']],
  ])('%s uses canonical native picker fields', (file, requiredControls) => {
    const contents = source(file);
    for (const control of requiredControls) expect(contents).toContain(control);
  });

  it('does not expose raw date/time FormFields in the audited normal flows', () => {
    const audited = [
      'src/app/shifts/active/expected-end.tsx',
      'src/app/shifts/active/end.tsx',
      'src/app/shifts/[id]/breaks.tsx',
      'src/app/shifts/start/unscheduled.tsx',
      'src/app/settings/salary/index.tsx',
      'src/app/settings/salary/rules.tsx',
      'src/features/templates/components/template-form.tsx',
    ].map(source).join('\n');

    expect(audited).not.toMatch(/<FormField[^>]+(?:actualEndDate|actualEndTime|manualStart|manualEnd|startTime|endTime|specificDate|effectiveFrom|effectiveTo|expectedEnd)/);
    expect(audited).not.toContain('placeholder="YYYY-MM-DD"');
    expect(audited).not.toContain('placeholder="08:00"');
    expect(audited).not.toContain('placeholder="16:00"');
  });

  it('keeps route-tree tests outside Expo Router', () => {
    expect(source('src/__tests__/date-time-control-audit.test.ts')).toContain('user-facing date and time control audit');
  });
});
