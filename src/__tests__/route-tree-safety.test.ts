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

  it('routes ordinary Home and Calendar creation through one inferred Add Shift flow', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require('path');
    const appDir = p.join(p.resolve('.'), 'src', 'app');
    const home = fs.readFileSync(p.join(appDir, '(tabs)', 'index.tsx'), 'utf8');
    const calendar = fs.readFileSync(p.join(appDir, '(tabs)', 'calendar.tsx'), 'utf8');
    const compatibilityRoute = fs.readFileSync(p.join(appDir, 'add-shift.tsx'), 'utf8');

    expect(home).toContain("router.push('/shifts/new')");
    expect(home).not.toContain('home.addFuture');
    expect(home).not.toContain('home.addCompleted');
    expect(calendar).toContain('/shifts/new?date=');
    expect(calendar).not.toContain('mode=scheduled');
    expect(compatibilityRoute).toContain('<Redirect href="/shifts/new" />');
  });

  it('keeps the removed Reports and Backup hub as a safe compatibility redirect', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require('path');
    const source = fs.readFileSync(p.join(p.resolve('.'), 'src', 'app', 'settings', 'reports-backup.tsx'), 'utf8');

    expect(source).toContain('<Redirect href="/settings" />');
  });

  it('does not expose caught native or database messages from hardened routes', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require('path');
    const appDir = p.join(p.resolve('.'), 'src', 'app');
    const routes = [
      ['onboarding', 'workplace.tsx'],
      ['settings', 'data-management.tsx'],
      ['settings', 'exports', 'index.tsx'],
      ['settings', 'templates', '[id].tsx'],
      ['shifts', '[id]', 'index.tsx'],
      ['shifts', '[id]', 'edit.tsx'],
      ['shifts', 'new.tsx'],
      ['shifts', 'apply-suggestion.tsx'],
    ];

    for (const segments of routes) {
      const source = fs.readFileSync(p.join(appDir, ...segments), 'utf8');
      expect(source).not.toMatch(/Alert\.alert\([\s\S]{0,200}(?:caught|error|e)\.message/);
      expect(source).not.toMatch(/Alert\.alert\([\s\S]{0,200}String\((?:caught|error|e)\)/);
    }
  });

  it('keeps template editing navigable and safe when the target is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require('path');
    const source = fs.readFileSync(p.join(p.resolve('.'), 'src', 'app', 'settings', 'templates', '[id].tsx'), 'utf8');

    expect(source).toContain('<SettingsBackButton />');
    expect(source).toContain('!isNew && !template');
    expect(source).not.toContain('String(err)');
  });

  it('keeps explicit loading and safe error states on Calendar and Reports', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require('path');
    const tabsDir = p.join(p.resolve('.'), 'src', 'app', '(tabs)');

    for (const route of ['calendar.tsx', 'reports.tsx']) {
      const source = fs.readFileSync(p.join(tabsDir, route), 'utf8');
      expect(source).toContain("t('common.loading')");
      expect(source).toContain("t('common.error')");
      expect(source).toMatch(/accessibilityRole="alert"/);
    }
  });

  it('keeps notification settings non-blank, localized, and guarded while saving', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require('path');
    const appDir = p.join(p.resolve('.'), 'src', 'app');
    const routes = [
      ['settings', 'notifications.tsx'],
      ['settings', 'workplaces', '[id]', 'notifications.tsx'],
    ];

    for (const segments of routes) {
      const source = fs.readFileSync(p.join(appDir, ...segments), 'utf8');
      expect(source).toContain("t('common.loading')");
      expect(source).toContain("t('common.error')");
      expect(source).toMatch(/accessibilityRole="alert"/);
      expect(source).toMatch(/accessibilityRole="switch"/);
      expect(source).toMatch(/disabled=\{saving\}/);
    }

    const globalSource = fs.readFileSync(p.join(appDir, 'settings', 'notifications.tsx'), 'utf8');
    expect(globalSource).not.toContain('שמירת משמרת פעילה');
  });

  it('keeps template, suggestion, and picker controls screen-reader addressable', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require('path');
    const root = p.resolve('.');
    const templateCard = fs.readFileSync(p.join(root, 'src', 'features', 'templates', 'components', 'template-card.tsx'), 'utf8');
    const templateList = fs.readFileSync(p.join(root, 'src', 'app', 'settings', 'templates', 'index.tsx'), 'utf8');
    const suggestionCard = fs.readFileSync(p.join(root, 'src', 'features', 'shifts', 'components', 'smart-suggestion-card.tsx'), 'utf8');
    const applySuggestion = fs.readFileSync(p.join(root, 'src', 'app', 'shifts', 'apply-suggestion.tsx'), 'utf8');

    expect(templateCard).toMatch(/accessibilityRole="button"/);
    expect(templateList).toMatch(/accessibilityRole="switch"/);
    expect(suggestionCard.match(/accessibilityRole="button"/g)).toHaveLength(4);
    expect(applySuggestion.match(/accessibilityRole="switch"/g)).toHaveLength(2);
  });

  it('keeps per-workplace notification overrides reachable from workplace settings', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require('path');
    const source = fs.readFileSync(p.join(p.resolve('.'), 'src', 'app', 'settings', 'workplaces.tsx'), 'utf8');

    expect(source).toContain('settings.notificationWorkplace');
    expect(source).toContain('/notifications`');
  });
});
