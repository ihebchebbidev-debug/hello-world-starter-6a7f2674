/**
 * EcoBus color system — professional, accessible, school-transport identity.
 *
 * Design rules:
 * - All foreground/background pairings meet WCAG AA (≥ 4.5:1).
 * - Never rely on color alone — always pair with an icon or label.
 * - Use semantic tokens (textPrimary, surface, border) in components,
 *   never raw hex values. Add new tokens here, not in components.
 * - Status colors (success/warning/danger) are reserved for state —
 *   do not use them for branding or decoration.
 */

// --- Brand: EcoBus website teal/cyan (matches the marketing site hero) ---
// Anchored on the bottom-bar accent (~#3DBFC9) with a darker shade for
// pressed/contrast states and lighter shades for surfaces & chips.
const brand = {
  50:  '#ECFBFC',
  100: '#CFF4F7',
  200: '#A3E8EE',
  300: '#6FD8E1',
  400: '#46C6D2',
  500: '#3DBFC9', // primary accent — site bottom-bar teal
  600: '#229BA6', // primary — used on buttons, focus, links
  700: '#177983',
  800: '#115C64',
  900: '#0B4046',
};

// --- Neutrals: warm-cool slate, tuned for long reading sessions ---
const neutral = {
  0:   '#FFFFFF',
  25:  '#FCFCFD',
  50:  '#F9FAFB',
  100: '#F2F4F7',
  200: '#EAECF0',
  300: '#D0D5DD',
  400: '#98A2B3',
  500: '#667085',
  600: '#475467',
  700: '#344054',
  800: '#1D2939',
  900: '#101828',
};

export const colors = {
  // Brand
  primary:       brand[600],
  primaryDark:   brand[700],
  primaryLight:  brand[100],
  primarySoft:   brand[50],
  primaryAccent: brand[500],

  // Secondary = dark navy bar from the website footer/header backdrop
  secondary:      '#0E1726',
  secondaryLight: neutral[100],

  // Status — success stays green so it can't be confused with the brand
  success:      '#039855',
  successLight: '#D1FADF',
  successDark:  '#054F31',
  danger:       '#D92D20',
  dangerLight:  '#FEE4E2',
  dangerDark:   '#7F1D1D',
  dangerSoft:   '#FCA5A5',  // light coral — for use ON dark/brand backgrounds
  warning:      '#DC6803',
  warningLight: '#FEF0C7',
  warningDark:  '#92400E',
  info:         '#0BA5EC',
  infoLight:    '#E0F2FE',
  neutralLight: '#F1F5F9',

  // Surface
  background:  neutral[50],
  surface:     neutral[0],
  surfaceAlt:  neutral[100],
  surfaceSunk: neutral[200],

  // Text — paired against surface (#FFF) and background (#F9FAFB)
  textPrimary:   neutral[900], // 16.94:1 on surface
  textSecondary: neutral[600], // 7.69:1
  textMuted:     neutral[500], // 5.21:1
  textDisabled:  neutral[400],
  textInverse:   neutral[0],
  textBrand:     brand[700],

  // Borders & dividers
  border:        neutral[200],
  borderStrong:  neutral[300],
  borderFocus:   brand[500],

  // Overlays
  overlay:      'rgba(16, 24, 40, 0.55)',
  overlayLight: 'rgba(16, 24, 40, 0.25)',
  scrim:        'rgba(16, 24, 40, 0.85)',
  modalBackdrop:'rgba(16, 24, 40, 0.45)',

  // On-brand surfaces — translucent whites used over primary/hero backgrounds
  onBrandHigh:  'rgba(255,255,255,0.18)',
  onBrandMid:   'rgba(255,255,255,0.15)',
  onBrandText:  'rgba(255,255,255,0.85)',
  onBrandMuted: 'rgba(255,255,255,0.75)',
  onBrandRipple:'rgba(255,255,255,0.20)',

  // Status pills (child status) — kept distinct from generic status
  statusOnBus:      brand[600],
  statusWaiting:    '#DC6803',
  statusNotBoarded: '#D92D20',
  statusArrived:    brand[500],

  // Internal palettes (escape hatch — prefer semantic tokens above)
  _brand: brand,
  _neutral: neutral,
};

export default colors;
