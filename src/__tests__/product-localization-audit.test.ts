import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

import { en, he } from '@/shared/i18n/translations';

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

describe('beta product naming and localization audit', () => {
  it('uses Shiftty / שיפטי on the public translation surface', () => {
    expect(en['app.name']).toBe('Shiftty');
    expect(he['app.name']).toBe('שיפטי');
    expect(en['bootstrap.loading']).toContain('Shiftty');
    expect(en['bootstrap.loading']).not.toMatch(/\bShifty\b/);

    const publicSourceRoots = ['src/app', 'src/features', 'src/shared'];
    const misspellings = publicSourceRoots.flatMap((root) => walk(join(process.cwd(), root)))
      .filter((path) => ['.ts', '.tsx'].includes(extname(path)) && !path.endsWith('.test.ts') && !path.endsWith('.test.tsx'))
      .filter((path) => /\bShifty\b/.test(readFileSync(path, 'utf8')))
      .map((path) => path.slice(process.cwd().length + 1));
    expect(misspellings).toEqual([]);
  });

  it('keeps all route modules free of embedded Hebrew copy', () => {
    const appDirectory = join(process.cwd(), 'src', 'app');
    const routeModules = walk(appDirectory).filter((path) => extname(path) === '.tsx');
    const findings = routeModules.flatMap((path) => {
      const lines = readFileSync(path, 'utf8').split(/\r?\n/);
      return lines.flatMap((line, index) => /[\u0590-\u05ff]/.test(line)
        ? [`${path.slice(process.cwd().length + 1)}:${index + 1}`]
        : []);
    });

    expect(routeModules).toHaveLength(36);
    expect(findings).toEqual([]);
  });

  it('preserves legacy technical identifiers while exposing the corrected display name', () => {
    const config = JSON.parse(readFileSync(join(process.cwd(), 'app.json'), 'utf8')).expo;
    const packageManifest = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    const infoPlist = readFileSync(join(process.cwd(), 'ios', 'Shifty', 'Info.plist'), 'utf8');
    const xcodeProject = readFileSync(join(process.cwd(), 'ios', 'Shifty.xcodeproj', 'project.pbxproj'), 'utf8');

    expect(config.name).toBe('Shiftty');
    expect(config.slug).toBe('shifty');
    expect(config.scheme).toBe('shifty');
    expect(config.ios.bundleIdentifier).toBe('com.omerportnoy.shifty');
    expect(config.android.package).toBe('com.shifty.app');
    expect(packageManifest.name).toBe('shifty');
    expect(infoPlist).toMatch(/<key>CFBundleDisplayName<\/key>\s*<string>Shiftty<\/string>/);
    expect(xcodeProject).toContain('PRODUCT_NAME = Shifty;');
  });

  it('does not disable font scaling on user-visible source surfaces', () => {
    const roots = ['src/app', 'src/features', 'src/shared/components'];
    const findings = roots.flatMap((root) => walk(join(process.cwd(), root)))
      .filter((path) => extname(path) === '.tsx' && !path.endsWith('.test.tsx'))
      .filter((path) => readFileSync(path, 'utf8').includes('allowFontScaling={false}'))
      .map((path) => path.slice(process.cwd().length + 1));

    expect(findings).toEqual([]);
  });
});
