import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeOut,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ProductImage } from '@/components/ProductImage';
import { useRodizio } from '@/components/Vitrine';
import { formatPrice } from '@/logic/format';
import { colors, fonts } from '@/theme/theme';
import type { Perfume } from '@/types/catalog';

interface Props {
  produtos: Perfume[];
  onAcordar: () => void;
}

// Mais lento que a vitrine normal: aqui ninguém está lendo, só passando.
const INTERVALO_MS = 6000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Foto do destaque: sobe ao entrar e cresce bem devagar enquanto está na tela. */
function Foto({ perfume, lado }: { perfume: Perfume; lado: number }) {
  const escala = useSharedValue(1);
  useEffect(() => {
    escala.value = withTiming(1.04, { duration: INTERVALO_MS + 1200, easing: Easing.out(Easing.quad) });
  }, [escala]);
  const zoom = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));

  return (
    <Animated.View
      entering={FadeInDown.duration(1200).delay(200)}
      exiting={FadeOutDown.duration(800)}
      style={StyleSheet.absoluteFill}
    >
      <Animated.View style={zoom}>
        <ProductImage perfume={perfume} height={lado} bottle="lg" />
      </Animated.View>
    </Animated.View>
  );
}

/** Círculo que pulsa ao lado do "Toque na tela". */
function Pulso() {
  const onda = useSharedValue(0);
  useEffect(() => {
    onda.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1);
  }, [onda]);
  const anel = useAnimatedStyle(() => ({
    opacity: 0.7 * (1 - onda.value),
    transform: [{ scale: 0.6 + onda.value * 1.2 }],
  }));

  return (
    <View style={styles.pulso}>
      <Animated.View style={[styles.anel, anel]} />
      <View style={styles.ponto} />
    </View>
  );
}

/**
 * Modo atração: com o totem parado na tela inicial, a vitrine ocupa a tela
 * inteira em fundo branco e os produtos se revezam devagar. Qualquer toque
 * devolve a tela inicial — o cliente nunca "cai" num produto sem querer.
 */
export function AttractMode({ produtos, onAcordar }: Props) {
  const { width, height } = useWindowDimensions();
  const { indice } = useRodizio(produtos.length, INTERVALO_MS);
  const atual = produtos[indice];

  const lado = Math.min(width - 112, height * 0.5, 640);

  return (
    <Animated.View
      entering={FadeIn.duration(900)}
      exiting={FadeOut.duration(300)}
      style={styles.overlay}
    >
      <Pressable style={styles.toque} onPress={onAcordar}>
        <View style={styles.topo}>
          <Text style={styles.logo}>Le Parfum</Text>
          <Text style={styles.contador}>
            {pad(indice + 1)} — {pad(produtos.length)}
          </Text>
        </View>

        <View style={styles.centro}>
          <View style={{ width: lado, height: lado }}>
            {atual && <Foto key={atual.id} perfume={atual} lado={lado} />}
          </View>

          <View style={[styles.info, { width: Math.min(width - 112, 720) }]}>
            {atual && (
              <Animated.View
                key={atual.id}
                entering={FadeInLeft.duration(800).delay(500)}
                exiting={FadeOut.duration(500)}
                style={styles.infoLinha}
              >
                <View style={styles.infoTexto}>
                  {!!atual.marca && (
                    <Text style={styles.marca} numberOfLines={1}>
                      {atual.marca.toUpperCase()}
                    </Text>
                  )}
                  <Text style={styles.nome} numberOfLines={2}>
                    {atual.nome}
                  </Text>
                </View>
                <Text style={styles.preco}>
                  {formatPrice(atual.precoPromocional ?? atual.preco)}
                </Text>
              </Animated.View>
            )}
          </View>
        </View>

        <View style={styles.rodape}>
          <Text style={styles.chamada}>TOQUE NA TELA</Text>
          <Pulso />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, zIndex: 50 },
  toque: { flex: 1, paddingHorizontal: 56, paddingTop: 48, paddingBottom: 48 },
  topo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  logo: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 48, color: colors.ink },
  contador: { fontFamily: fonts.sansSemiBold, fontSize: 14, letterSpacing: 2, color: colors.muted },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  info: { height: 120, marginTop: 36 },
  infoLinha: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 24,
  },
  infoTexto: { flex: 1, gap: 6 },
  marca: { fontFamily: fonts.sansSemiBold, fontSize: 13, letterSpacing: 3, color: colors.gold },
  nome: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 44, color: colors.ink },
  preco: { fontFamily: fonts.sansSemiBold, fontSize: 22, color: colors.ink, paddingBottom: 6 },
  rodape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16 },
  chamada: { fontFamily: fonts.sansSemiBold, fontSize: 14, letterSpacing: 3.2, color: colors.ink },
  pulso: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  anel: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  ponto: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ink },
});
