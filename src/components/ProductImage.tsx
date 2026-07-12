import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { familyTints, neutralTint } from '@/theme/theme';
import type { Perfume } from '@/types/catalog';

type BottleSize = 'sm' | 'md' | 'lg';

const bottleSizes: Record<BottleSize, { capW: number; capH: number; bodyW: number; bodyH: number }> = {
  sm: { capW: 10, capH: 12, bodyW: 42, bodyH: 60 },
  md: { capW: 14, capH: 18, bodyW: 64, bodyH: 92 },
  lg: { capW: 26, capH: 32, bodyW: 118, bodyH: 172 },
};

interface Props {
  perfume: Perfume;
  height: number;
  bottle?: BottleSize;
}

/**
 * Foto do produto (do Bling) sobre fundo com o degradê da família olfativa.
 * Sem foto, exibe a garrafa minimalista do design.
 */
export function ProductImage({ perfume, height, bottle = 'md' }: Props) {
  const family = perfume.familias[0];
  const tint = family ? familyTints[family] : neutralTint;
  const b = bottleSizes[bottle];

  return (
    <LinearGradient
      colors={tint}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[styles.container, { height }]}
    >
      {perfume.imagem ? (
        <Image
          source={{ uri: perfume.imagem }}
          style={{ width: '70%', height: height * 0.82 }}
          contentFit="contain"
          transition={200}
        />
      ) : (
        <View style={styles.bottle}>
          <View style={[styles.cap, { width: b.capW, height: b.capH }]} />
          <View style={[styles.body, { width: b.bodyW, height: b.bodyH }]} />
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  bottle: { alignItems: 'center' },
  cap: { backgroundColor: 'rgba(33,29,24,0.75)', borderRadius: 2 },
  body: {
    marginTop: 4,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },
});
