import { darkColors, lightColors, type ThemeColors } from '@/shared/theme/theme';

function luminance(hex: string): number {
  const channel = (index: number) => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const red = channel(1);
  const green = channel(3);
  const blue = channel(5);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string): number {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
] as const)('%s theme contrast', (_name, colors: ThemeColors) => {
  it.each([
    ['text/background', colors.text, colors.background],
    ['text/surface', colors.text, colors.surface],
    ['muted text/background', colors.textMuted, colors.background],
    ['muted text/surface', colors.textMuted, colors.surface],
    ['primary/background', colors.primary, colors.background],
    ['danger/background', colors.danger, colors.background],
    ['warning/background', colors.warning, colors.background],
    ['button text/primary', colors.onPrimary, colors.primary],
  ])('keeps %s at WCAG AA text contrast', (_pair, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});
