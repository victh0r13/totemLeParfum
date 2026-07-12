import type { Familia } from '@/types/catalog';

export const colors = {
  bg: '#faf7f2',
  surface: '#ffffff',
  ink: '#211d18',
  inkSoft: '#4a443c',
  muted: '#8c8478',
  gold: '#a8823f',
  goldSoft: '#c8a860',
  cream: '#f5efe4',
  creamGold: '#faf3e6',
  border: 'rgba(33,29,24,0.12)',
  borderSoft: 'rgba(33,29,24,0.08)',
  stockOk: '#7d9b7f',
  stockLow: '#c08a3f',
  badgeF: '#b06a5f',
} as const;

export const fonts = {
  serif: 'CormorantGaramond_500Medium',
  serifSemiBold: 'CormorantGaramond_600SemiBold',
  serifItalic: 'CormorantGaramond_500Medium_Italic',
  sans: 'Manrope_400Regular',
  sansMedium: 'Manrope_500Medium',
  sansSemiBold: 'Manrope_600SemiBold',
  sansBold: 'Manrope_700Bold',
} as const;

/** Gradientes de fundo por família olfativa (topo → base), fiéis ao design. */
export const familyTints: Record<Familia, [string, string]> = {
  doce: ['#ecd9bc', '#dfc09a'],
  citrico: ['#eee3bd', '#ded193'],
  amadeirado: ['#dcc4a8', '#c3a684'],
  floral: ['#eed4cc', '#dfb7ad'],
  oriental: ['#dfc19e', '#c49a6b'],
  fresco: ['#d4e0d2', '#b7c9b8'],
};

/** Tinta neutra para produtos ainda não enriquecidos. */
export const neutralTint: [string, string] = ['#e7e1d6', '#d6cdbd'];

export const familyLabels: Record<Familia, string> = {
  floral: 'Floral',
  citrico: 'Cítrico',
  amadeirado: 'Amadeirado',
  doce: 'Doce',
  oriental: 'Oriental',
  fresco: 'Fresco',
};

export const intensityLabels: Record<1 | 2 | 3, string> = {
  1: 'Intensidade leve',
  2: 'Intensidade moderada',
  3: 'Intensidade marcante',
};
