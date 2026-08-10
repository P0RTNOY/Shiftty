/**
 * Safeguard: Expo Router bundles every file under src/app/ as a route module.
 * Jest test files (.test.ts, .test.tsx, .spec.ts, .spec.tsx) must never exist
 * inside src/app/ because Jest globals (describe, it, expect) are not available
 * at native runtime and will crash the app.
 */

import { he } from '@/shared/i18n/translations';

describe('Expo Router route tree', () => {
  it('contains no .test. or .spec. files under src/app/', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cp = require('child_process');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require('path');

    const appDir = p.join(p.resolve('.'), 'src', 'app');

    let output = '';
    try {
      output = cp
        .execSync(
          `find "${appDir}" \\( -name "*.test.*" -o -name "*.spec.*" \\) -print`,
          { encoding: 'utf8' },
        )
        .trim();
    } catch {
      // find returns non-zero if the directory doesn't exist
      return;
    }

    expect(output).toBe('');
  });

  it('keeps Add Shift routable outside the four-screen tab group', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require('path');
    const layoutSource = fs.readFileSync(
      p.join(p.resolve('.'), 'src', 'app', '(tabs)', '_layout.tsx'),
      'utf8',
    );

    expect(layoutSource).not.toContain('name="add-shift"');
    expect(fs.existsSync(p.join(p.resolve('.'), 'src', 'app', 'add-shift.tsx'))).toBe(true);
    expect(fs.existsSync(p.join(p.resolve('.'), 'src', 'app', '(tabs)', 'add-shift.tsx'))).toBe(false);
    expect(he['nav.calendar']).toBe('לוח שנה');
  });
});
