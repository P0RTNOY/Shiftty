import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function source(path: string): string { return readFileSync(resolve(path), 'utf8'); }

it('keeps suggestion and calendar display formatting out of device-timezone APIs', () => {
  const audited = [
    'src/app/shifts/apply-suggestion.tsx',
    'src/features/shifts/components/smart-suggestion-card.tsx',
    'src/features/calendar/components/week-calendar-view.tsx',
    'src/features/calendar/components/calendar-view.tsx',
    'src/domain/services/week-calendar-service.ts',
  ].map(source).join('\n');

  expect(audited).not.toContain('.toLocaleTimeString(');
  expect(audited).not.toContain('.toLocaleDateString(');
  expect(audited).not.toContain(".split('T')[0]");
  expect(audited).not.toContain(".toISOString().slice(0, 10)");
  expect(source('src/app/shifts/apply-suggestion.tsx')).not.toContain('resolvedOptions().timeZone');
});
