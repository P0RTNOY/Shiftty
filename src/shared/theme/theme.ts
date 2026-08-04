export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const typography = {
  caption: 13,
  body: 16,
  title: 20,
  heading: 28,
  display: 36,
} as const;

export const lightColors = {
  background: '#F5F8F6',
  surface: '#FFFFFF',
  surfaceMuted: '#E8F0EC',
  text: '#14231C',
  textMuted: '#53665C',
  primary: '#176B4D',
  primaryPressed: '#0F523A',
  onPrimary: '#FFFFFF',
  border: '#CBD9D1',
  success: '#176B4D',
  warning: '#8A4B08',
  danger: '#A93232',
  tabInactive: '#65776E',
  scrim: 'rgba(0, 0, 0, 0.52)',
} as const;

export const darkColors: ThemeColors = {
  background: '#0D1511',
  surface: '#16211B',
  surfaceMuted: '#223129',
  text: '#F0F6F2',
  textMuted: '#A9BBB1',
  primary: '#77D5AA',
  primaryPressed: '#9CE7C4',
  onPrimary: '#082017',
  border: '#34483E',
  success: '#77D5AA',
  warning: '#F0B66D',
  danger: '#FF9A9A',
  tabInactive: '#9AAEA3',
  scrim: 'rgba(0, 0, 0, 0.68)',
};

export type ThemeColors = { [Key in keyof typeof lightColors]: string };
