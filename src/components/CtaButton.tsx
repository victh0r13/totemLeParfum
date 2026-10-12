import React from 'react';
import { StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { colors, fonts } from '@/theme/theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Propriedades que decidem o tamanho do botão NO PAI. O PressableScale aplica
 * `style` numa view interna; sem levar estas para o Pressable de fora, um
 * `flex: 1` não divide a barra entre dois botões.
 */
const LAYOUT_EXTERNO = ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'width', 'alignSelf'] as const;

function separarLayout(style: StyleProp<ViewStyle>) {
  const plano = { ...(StyleSheet.flatten(style) ?? {}) } as Record<string, unknown>;
  const externo: Record<string, unknown> = {};
  for (const k of LAYOUT_EXTERNO) {
    if (k in plano) {
      externo[k] = plano[k];
      delete plano[k];
    }
  }
  return { externo: externo as ViewStyle, interno: plano as ViewStyle };
}

/** Botão de ação em pílula: primário (tinta escura) ou secundário (contorno). */
export function CtaButton({ label, onPress, variant = 'primary', disabled, style }: Props) {
  const primary = variant === 'primary';
  const { externo, interno } = separarLayout(style);
  return (
    <PressableScale
      onPress={disabled ? undefined : onPress}
      scaleTo={0.97}
      containerStyle={externo}
      style={[
        styles.base,
        primary ? styles.primary : styles.secondary,
        disabled && styles.disabled,
        interno,
      ]}
    >
      <Text style={[styles.label, primary ? styles.labelPrimary : styles.labelSecondary]}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    paddingVertical: 22,
    paddingHorizontal: 34,
    alignItems: 'center',
  },
  primary: { backgroundColor: colors.ink },
  secondary: { borderWidth: 1, borderColor: 'rgba(33,29,24,0.25)' },
  disabled: { opacity: 0.35 },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 17, letterSpacing: 0.5 },
  labelPrimary: { color: colors.cream },
  labelSecondary: { color: colors.ink },
});
