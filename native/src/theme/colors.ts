import { useColorScheme } from 'react-native';

import { useSettings } from '@/stores/settings';

// Palette officielle Wirdan (émeraude / or / ivoire / sauge / anthracite), reprise du site.
const light = {
  primary: '#123F35',
  primaryDark: '#0b2920',
  accent: '#C6A45C',
  accentStrong: '#8f6c28', // or foncé : boutons, texte doré lisible sur fond clair
  accentSoft: '#f3e7cf',
  background: '#F7F4EA',
  surface: '#FFFFFF',
  page: '#fffdf6', // fond de page du Mushaf
  text: '#252B28',
  muted: '#5f7268',
  line: '#e6e1d2',
  success: '#3d7a5c',
  danger: '#c0392b',
  playerBg: '#0b2920',
  playerText: '#FFFFFF',
  hero: '#0b2920', // cartes mises en avant (reprise de lecture, séance Hifdh…)
  highlight: 'rgba(198, 164, 92, 0.28)',
  following: 'rgba(61, 122, 92, 0.16)',
};

const dark: typeof light = {
  primary: '#ddc48c',
  primaryDark: '#04140d',
  accent: '#C6A45C',
  accentStrong: '#C6A45C',
  accentSoft: '#1d3328',
  background: '#06110c',
  surface: '#0e1d16',
  page: '#0e1d16',
  text: '#e9e3d1',
  muted: '#9fb3a7',
  line: '#22382d',
  success: '#5fa47f',
  danger: '#e0675a',
  playerBg: '#04140d',
  playerText: '#FFFFFF',
  hero: '#123b2b',
  highlight: 'rgba(198, 164, 92, 0.24)',
  following: 'rgba(130, 175, 145, 0.2)',
};

// Thème sépia, proposé seulement pour la page de lecture
const sepia: typeof light = {
  ...light,
  background: '#eadfc4',
  surface: '#f6ecd2',
  page: '#f6ecd2',
  text: '#3b2f1e',
  muted: '#7a6a4f',
  line: '#dccaa0',
  accentSoft: '#ecd9ad',
  primary: '#5b4318',
  accentStrong: '#8a6420',
};

export type Colors = typeof light;
export const PALETTES = { light, dark, sepia };

/** Couleurs de l'application : thème choisi dans les réglages, ou celui du téléphone. */
export function useColors(): Colors {
  const system = useColorScheme();
  const pref = useSettings(s => s.theme);
  const scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  return PALETTES[scheme];
}

export function useIsDark(): boolean {
  const system = useColorScheme();
  const pref = useSettings(s => s.theme);
  return pref === 'dark' || (pref === 'system' && system === 'dark');
}

export const FONTS = {
  arabic: 'Amiri_400Regular',
  arabicBold: 'Amiri_700Bold',
  ui: 'Changa_400Regular',
  uiMedium: 'Changa_500Medium',
  uiBold: 'Changa_600SemiBold',
};
