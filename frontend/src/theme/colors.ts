const light = {
  primary: '#0F1115', // Ink: buttons, headings, active icons
  primaryDark: '#000000',
  primaryLight: '#2B95D6', // Sky blue for links and accents that must be readable on white
  secondary: '#8FD0F4', // Soft sky
  mint: '#E8F5FD', // Pale sky background
  mintBorder: '#D3ECFA',
  mintDark: '#A9D9F5', // The big sky shapes
  iconBorder: '#D3ECFA', // outline of the round icon buttons and tiles
  skyOnDark: '#A9D9F5', // pale sky text on the always-dark hero cards

  background: '#F8FAFC',
  canvas: '#FFFFFF', // the backdrop of the white sign-in and home screens
  page: '#F8FAFC', // the backdrop of whole screens (see-through in dark mode, where a gradient sits behind)
  card: '#FFFFFF',
  subtle: '#F1F5F9', // quiet grey fills
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',

  dangerBg: '#FEF2F2',
  dangerBorder: '#FECACA',
  dangerText: '#B91C1C',
  warnBg: '#FFFBEB',
  warnBorder: '#FDE68A',
  warnText: '#92400E',
  successBg: '#ECFDF5',
  successBorder: '#A7F3D0',
  successText: '#047857',
  infoBg: '#EFF6FF',
  infoBorder: '#DBEAFE',

  statusPending: '#F59E0B',
  statusConfirmed: '#10B981',
  statusCompleted: '#2B95D6',
  statusCancelled: '#EF4444',
  statusRejected: '#DC2626',

  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#2B95D6',

  ink: '#0F1115', // headings and dark-on-light text (white in dark mode)
  white: '#FFFFFF',
  black: '#000000',
  star: '#F59E0B',
};

export type ThemeColors = typeof light;
export type Scheme = 'light';

export const palettes: Record<Scheme, ThemeColors> = { light };

/** The colours in use. Jenni has a single, light look. */
export const colors: ThemeColors = { ...light };

export const applyScheme = (_scheme: Scheme) => {};
export const currentScheme = (): Scheme => 'light';
export const themeVersion = () => 0;
