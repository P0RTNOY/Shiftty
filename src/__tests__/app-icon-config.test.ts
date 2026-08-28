import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const config = JSON.parse(readFileSync(resolve(process.cwd(), 'app.json'), 'utf8')).expo;

function readPngMetadata(path: string) {
  const bytes = readFileSync(resolve(process.cwd(), path));
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes.readUInt8(25),
  };
}

describe('native icon configuration', () => {
  it('uses an opaque 1024-square source icon for iOS', () => {
    expect(config.icon).toBe('./assets/icon.png');
    expect(config.ios.icon).toBe('./assets/icon.png');
    expect(readPngMetadata('assets/icon.png')).toEqual({ width: 1024, height: 1024, colorType: 2 });
  });

  it('keeps the tracked native icon synchronized with the configured Expo icon', () => {
    const expoIcon = readFileSync(resolve(process.cwd(), 'assets/icon.png'));
    const nativeIcon = readFileSync(resolve(
      process.cwd(),
      'ios/Shifty/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png',
    ));

    expect(nativeIcon.equals(expoIcon)).toBe(true);
  });

  it('uses an intentionally image-free native launch storyboard', () => {
    const storyboard = readFileSync(resolve(process.cwd(), 'ios/Shifty/SplashScreen.storyboard'), 'utf8');

    expect(storyboard).not.toContain('<imageView');
    expect(storyboard).not.toContain('<image name=');
  });

  it('configures consistent Android adaptive and web icons', () => {
    expect(config.android.adaptiveIcon).toEqual(expect.objectContaining({
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0D1511',
    }));
    expect(config.web.favicon).toBe('./assets/favicon.png');
  });
});
