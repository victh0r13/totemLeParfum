import { usePathname } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { useKiosk } from '@/kiosk/KioskProvider';
import { colors, fonts } from '@/theme/theme';

/**
 * Botão "Recomeçar" discreto, fixo no canto superior direito de todas as
 * telas exceto a inicial.
 */
export function RestartButton() {
  const { resetSession } = useKiosk();
  const pathname = usePathname();
  if (pathname === '/') return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <PressableScale scaleTo={0.94} onPress={resetSession} style={styles.button}>
        <View style={styles.dot} />
        <Text style={styles.label}>RECOMEÇAR</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 20, right: 24, zIndex: 50 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.14)',
    backgroundColor: 'rgba(250,247,242,0.92)',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.muted,
  },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 1.7,
    color: colors.muted,
  },
});
