import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { colors, fonts } from '@/theme/theme';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** 'sm' = versão compacta usada na barra de filtros do catálogo. */
  size?: 'md' | 'sm';
}

/** Chip de filtro/seleção, com estado ativo em tinta escura. */
export function Chip({ label, selected = false, onPress, size = 'md' }: Props) {
  const small = size === 'sm';
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.94}
      style={[styles.chip, small && styles.chipSm, selected && styles.chipOn, !onPress && styles.chipStatic]}
    >
      <Text style={[styles.label, small && styles.labelSm, selected && styles.labelOn]}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.18)',
    backgroundColor: colors.surface,
  },
  chipSm: { paddingVertical: 10, paddingHorizontal: 18 },
  chipOn: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  chipStatic: { opacity: 0.9 },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.ink },
  labelSm: { fontSize: 14 },
  labelOn: { color: colors.cream },
});
