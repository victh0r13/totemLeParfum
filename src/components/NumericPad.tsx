import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { colors, fonts } from '@/theme/theme';

interface Props {
  onKey: (digit: string) => void;
  onBackspace: () => void;
  /** Exibe a tecla de vírgula (para digitar preços com centavos). */
  showComma?: boolean;
}

/** Teclado numérico do totem (não usamos o teclado do sistema no quiosque). */
export function NumericPad({ onKey, onBackspace, showComma = false }: Props) {
  const rows: string[][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [showComma ? ',' : '', '0', '⌫'],
  ];

  return (
    <View style={styles.pad}>
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((key, j) =>
            key === '' ? (
              <View key={j} style={styles.keyGhost} />
            ) : (
              <PressableScale
                key={j}
                scaleTo={0.92}
                onPress={() => (key === '⌫' ? onBackspace() : onKey(key))}
                containerStyle={styles.keyCell}
                style={[styles.key, key === '⌫' && styles.keyMuted]}
              >
                <Text style={styles.keyLabel}>{key}</Text>
              </PressableScale>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  keyCell: { flex: 1 },
  key: {
    height: 62,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.14)',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyMuted: { backgroundColor: colors.cream },
  keyGhost: { flex: 1, height: 62 },
  keyLabel: { fontFamily: fonts.sansSemiBold, fontSize: 24, color: colors.ink },
});
