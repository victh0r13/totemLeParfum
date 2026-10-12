import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ProductImage } from '@/components/ProductImage';
import { useRodizio } from '@/components/Vitrine';
import { formatPrice } from '@/logic/format';
import { colors, fonts, tipoLabels } from '@/theme/theme';
import type { Perfume } from '@/types/catalog';

interface Props {
  produtos: Perfume[];
  onAcordar: () => void;
}

/**
 * Modo atração: com o totem parado na tela inicial, a vitrine ocupa a tela
 * inteira em fundo escuro e os produtos se revezam devagar. Qualquer toque
 * devolve a tela inicial — o cliente nunca "cai" num produto sem querer.
 */
export function AttractMode({ produtos, onAcordar }: Props) {
  const { width, height } = useWindowDimensions();
  // Mais lento que a vitrine normal: aqui ninguém está lendo, só passando.
  const { indice } = useRodizio(produtos.length, 6000);
  const atual = produtos[indice];

  const pulso = useSharedValue(0.45);
  useEffect(() => {
    pulso.value = withRepeat(
      withSequence(withTiming(1, { duration: 1400 }), withTiming(0.45, { duration: 1400 })),
      -1,
    );
  }, [pulso]);
  const chamada = useAnimatedStyle(() => ({ opacity: pulso.value }));

  const lado = Math.min(width - 120, height * 0.46, 560);

  return (
    <Animated.View
      entering={FadeIn.duration(900)}
      exiting={FadeOut.duration(300)}
      style={styles.overlay}
    >
      <Pressable style={styles.toque} onPress={onAcordar}>
        <Text style={styles.eyebrow}>PERFUMARIA</Text>
        <Text style={styles.logo}>Le Parfum</Text>

        <View style={[styles.palco, { width: lado, height: lado + 120 }]}>
          {atual && (
            <Animated.View
              key={atual.id}
              entering={FadeIn.duration(1200)}
              exiting={FadeOut.duration(800)}
              style={StyleSheet.absoluteFill}
            >
              <View style={styles.moldura}>
                <ProductImage perfume={atual} height={lado - 24} bottle="lg" />
              </View>
              <Text style={styles.tipo} numberOfLines={1}>
                {[tipoLabels[atual.tipo], atual.marca].filter(Boolean).join('  ·  ').toUpperCase()}
              </Text>
              <Text style={styles.nome} numberOfLines={1}>
                {atual.nome}
              </Text>
              <Text style={styles.preco}>
                {formatPrice(atual.precoPromocional ?? atual.preco)}
              </Text>
            </Animated.View>
          )}
        </View>

        <Animated.Text style={[styles.chamada, chamada]}>
          Toque para descobrir sua fragrância
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.ink, zIndex: 50 },
  toque: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  eyebrow: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 4.2,
    color: colors.goldSoft,
  },
  logo: {
    fontFamily: fonts.serif,
    fontSize: 72,
    lineHeight: 80,
    color: colors.cream,
    marginTop: 10,
  },
  palco: { marginTop: 44 },
  moldura: { borderRadius: 28, overflow: 'hidden', padding: 12, backgroundColor: '#ffffff' },
  tipo: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 2.4,
    color: colors.goldSoft,
    textAlign: 'center',
    marginTop: 24,
  },
  nome: {
    fontFamily: fonts.serif,
    fontSize: 30,
    lineHeight: 36,
    color: colors.cream,
    textAlign: 'center',
    marginTop: 6,
  },
  preco: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 18,
    color: 'rgba(245,239,228,0.75)',
    textAlign: 'center',
    marginTop: 4,
  },
  chamada: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    letterSpacing: 2.6,
    color: colors.cream,
    textTransform: 'uppercase',
    marginTop: 48,
  },
});
