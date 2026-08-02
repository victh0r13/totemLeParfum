import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { photoSources } from '@/data/images';
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
 * Foto do produto preenchendo todo o quadro sobre fundo branco — as fotos do
 * Bling já vêm com fundo branco, então o "contain" funde sem emenda.
 *
 * As origens são tentadas em ordem (APK → servidor da loja → URL do Bling);
 * se todas falharem, mantém o degradê da família olfativa com a garrafa
 * minimalista do design, que é o estado offline aceitável.
 */
export function ProductImage({ perfume, height, bottle = 'md' }: Props) {
  const sources = useMemo(() => photoSources(perfume), [perfume]);
  const [failed, setFailed] = useState(0);

  const family = perfume.familias[0];
  const tint = family ? familyTints[family] : neutralTint;
  const b = bottleSizes[bottle];
  const source = sources[failed];

  if (source !== undefined) {
    return (
      <View style={[styles.container, styles.photo, { height }]}>
        <Image
          // Ao trocar de produto numa lista reciclada, limpa a imagem anterior.
          recyclingKey={perfume.id}
          source={source}
          style={styles.photoImage}
          contentFit="contain"
          cachePolicy="disk"
          transition={200}
          onError={() => setFailed((i) => i + 1)}
        />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={tint}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[styles.container, { height }]}
    >
      <View style={styles.bottle}>
        <View style={[styles.cap, { width: b.capW, height: b.capH }]} />
        <View style={[styles.body, { width: b.bodyW, height: b.bodyH }]} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  // Respiro interno para a foto não encostar nas bordas do card.
  photo: { backgroundColor: '#ffffff', width: '100%', paddingVertical: 12, paddingHorizontal: 12 },
  photoImage: { width: '100%', height: '100%' },
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
