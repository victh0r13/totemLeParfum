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

/** Botão de ação em pílula: primário (tinta escura) ou secundário (contorno). */
export function CtaButton({ label, onPress, variant = 'primary', disabled, style }: Props) {
  const primary = variant === 'primary';
  return (
    <PressableScale
      onPress={disabled ? undefined : onPress}
      scaleTo={0.97}
      style={[
        styles.base,
        primary ? styles.primary : styles.secondary,
        disabled && styles.disabled,
        style,
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
