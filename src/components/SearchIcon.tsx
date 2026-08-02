import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/theme';

interface Props {
  size?: number;
  color?: string;
}

/**
 * Lupa desenhada com Views — círculo + cabo inclinado.
 *
 * Preferida a um glifo tipográfico ("⌕", "🔍") porque estes renderizam com
 * peso e alinhamento diferentes em cada plataforma, e o emoji ainda entra
 * colorido no meio de uma interface que é toda em tinta e dourado.
 */
export function SearchIcon({ size = 20, color = colors.ink }: Props) {
  const lente = size * 0.68;
  const cabo = size * 0.34;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: lente,
          height: lente,
          borderRadius: lente / 2,
          borderWidth: 1.8,
          borderColor: color,
        }}
      />
      <View
        style={[
          styles.cabo,
          {
            width: cabo,
            backgroundColor: color,
            // Sai da borda inferior direita da lente, a 45°.
            right: size * 0.02,
            bottom: size * 0.1,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  cabo: {
    position: 'absolute',
    height: 1.8,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
});
