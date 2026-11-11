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
export type Scheme = 'light' | 'dark';

const dark: ThemeColors = {
  ...light,
  // Near-black sliding into deep slate, with charcoal panels and the sky-blue accent. No purple anywhere.
  skyOnDark: '#A9D9F5',
  primary: '#2B95D6', // buttons: sky blue that carries white text
  primaryDark: '#1F7DB8',
  primaryLight: '#6EB9E8',
  secondary: '#8FD0F4',
  mint: '#17283A',
  mintBorder: '#234058',
  mintDark: '#27506F',

  background: '#12151A',
  page: 'transparent',
  canvas: 'transparent',
  card: '#191D23',
  subtle: '#222830',
  text: '#FFFFFF',
  textSecondary: '#C3CAD3',
  textMuted: '#8E97A3',
  border: '#2E353E',

  dangerBg: '#2B1B1D',
  dangerBorder: '#4A2A2D',
  dangerText: '#F0A8A8',
  warnBg: '#2B2418',
  warnBorder: '#4A3F20',
  warnText: '#E3C068',
  successBg: '#16261F',
  successBorder: '#1F4235',
  successText: '#7FD1AE',
  infoBg: '#15283A',
  infoBorder: '#244560',

  statusPending: '#E0A030',
  statusConfirmed: '#34B58A',
  statusCompleted: '#6EB9E8',
  statusCancelled: '#E26D6D',
  statusRejected: '#D95F5F',

  success: '#34B58A',
  warning: '#E0A030',
  danger: '#E26D6D',
  info: '#6EB9E8',
  star: '#E0A030',
  ink: '#FFFFFF',
  iconBorder: '#FFFFFF',
  white: '#F4F6F9',
};

/** The backdrop behind every screen in dark mode: near-black at the top, deep plum at the bottom. */
export const nightGradient = ['#07090C', '#0F1318', '#1A222C'] as const;

export const palettes: Record<Scheme, ThemeColors> = { light, dark };

/**
 * The colours in use right now. Screens read `colors.x` as before; switching the theme overwrites
 * these values in place and the screens are rebuilt (see ThemeProvider).
 */
export const colors: ThemeColors = { ...light };

let version = 0;
let current: Scheme = 'light';

export const applyScheme = (scheme: Scheme) => {
  if (scheme === current && version > 0) return;
  Object.assign(colors, palettes[scheme]);
  current = scheme;
  version += 1;
};
export const currentScheme = () => current;
export const themeVersion = () => version;
