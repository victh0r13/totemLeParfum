import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme/theme';
import type { Genero } from '@/types/catalog';

const palette: Record<Genero, { color: string; border: string; bg: string }> = {
  F: { color: colors.badgeF, border: 'rgba(176,106,95,0.4)', bg: 'rgba(176,106,95,0.07)' },
  M: { color: colors.ink, border: 'rgba(33,29,24,0.25)', bg: 'rgba(33,29,24,0.04)' },
  U: { color: colors.gold, border: 'rgba(168,130,63,0.4)', bg: 'rgba(168,130,63,0.08)' },
};

interface Props {
  genero: Genero | null;
  size?: number;
}

/** Badge circular F/M/U dos cards. Sem gênero atribuído, não renderiza nada. */
export function GenderBadge({ genero, size = 30 }: Props) {
  if (!genero) return null;
  const c = palette[genero];
  return (
    <View
      style={[
        styles.badge,
        {
          minWidth: size,
          height: size,
          borderRadius: size / 2,
          borderColor: c.border,
          backgroundColor: c.bg,
        },
      ]}
    >
      <Text style={[styles.text, { color: c.color, fontSize: size * 0.4 }]}>{genero}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.sansSemiBold },
});
