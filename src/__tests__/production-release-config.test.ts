import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('production iOS release configuration', () => {
  it('passes the deterministic source and resolved-config audit', () => {
    const output = execFileSync(
      process.execPath,
      [resolve(process.cwd(), 'scripts', 'validate-production-ios-config.cjs')],
      { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production' } },
    );

    expect(output).toContain('PRODUCTION_CONFIG_READY');
  });
});
