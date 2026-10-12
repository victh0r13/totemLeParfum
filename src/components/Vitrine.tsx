import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { ProductImage } from '@/components/ProductImage';
import { VITRINE_INTERVALO_SECONDS } from '@/config';
import { formatPrice } from '@/logic/format';
import { colors, fonts, tipoLabels } from '@/theme/theme';
import type { Perfume } from '@/types/catalog';

/**
 * Índice que avança sozinho a cada `intervaloMs`. Tocar num ponto pula para
 * aquele item e o relógio recomeça — quem escolheu um destaque não quer vê-lo
 * sumir no segundo seguinte.
 */
export function useRodizio(total: number, intervaloMs: number) {
  const [indice, setIndice] = useState(0);
  // Muda a cada escolha manual, só para reiniciar o efeito abaixo.
  const [rodada, setRodada] = useState(0);

  useEffect(() => {
    if (total < 2) return;
    const timer = setInterval(() => setIndice((i) => (i + 1) % total), intervaloMs);
    return () => clearInterval(timer);
  }, [total, intervaloMs, rodada]);

  const ir = (i: number) => {
    setIndice(i);
    setRodada((r) => r + 1);
  };
  // Se o catálogo encolheu, o índice antigo pode ter ficado fora da lista.
  return { indice: total > 0 ? indice % total : 0, ir };
}

interface Props {
  produtos: Perfume[];
  altura: number;
  onAbrir: (p: Perfume) => void;
}

/**
 * Carrossel de destaques da tela inicial: foto grande com troca em fade,
 * tipo + marca + nome + preço por baixo. Tocar abre o produto.
 */
export function Vitrine({ produtos, altura, onAbrir }: Props) {
  const { indice, ir } = useRodizio(produtos.length, VITRINE_INTERVALO_SECONDS * 1000);
  const atual = produtos[indice];
  if (!atual) return null;

  const emOferta = atual.precoPromocional !== null;

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => onAbrir(atual)} style={[styles.card, { height: altura }]}>
        {/* A chave troca a cada produto: o anterior sai em fade enquanto o novo entra. */}
        <Animated.View
          key={atual.id}
          entering={FadeIn.duration(700)}
          exiting={FadeOut.duration(500)}
          style={StyleSheet.absoluteFill}
        >
          <View style={styles.foto}>
            <ProductImage perfume={atual} height={altura - 150} bottle="lg" />
          </View>
          <View style={styles.info}>
            <Text style={styles.eyebrow} numberOfLines={1}>
              {[tipoLabels[atual.tipo], atual.marca].filter(Boolean).join('  ·  ').toUpperCase()}
            </Text>
            <Text style={styles.nome} numberOfLines={1}>
              {atual.nome}
            </Text>
            <View style={styles.precoRow}>
              {emOferta && (
                <Text style={styles.precoAntigo}>{formatPrice(atual.preco)}</Text>
              )}
              <Text style={[styles.preco, emOferta && { color: colors.gold }]}>
                {formatPrice(atual.precoPromocional ?? atual.preco)}
              </Text>
              {emOferta && (
                <View style={styles.ofertaPill}>
                  <Text style={styles.ofertaTexto}>OFERTA</Text>
                </View>
              )}
              <Text style={styles.ver}>Ver detalhes →</Text>
            </View>
          </View>
        </Animated.View>
      </Pressable>

      {produtos.length > 1 && (
        <View style={styles.pontos}>
          {produtos.map((p, i) => (
            <Pressable key={p.id} onPress={() => ir(i)} hitSlop={10}>
              <View style={[styles.ponto, i === indice && styles.pontoAtivo]} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.08)',
    overflow: 'hidden',
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  foto: { paddingTop: 18 },
  info: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 132,
    paddingHorizontal: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  eyebrow: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 2.4,
    color: colors.gold,
  },
  nome: {
    fontFamily: fonts.serif,
    fontSize: 30,
    lineHeight: 36,
    color: colors.ink,
    marginTop: 6,
  },
  precoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  precoAntigo: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  preco: { fontFamily: fonts.sansBold, fontSize: 21, color: colors.ink },
  ofertaPill: {
    backgroundColor: colors.gold,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  ofertaTexto: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.4, color: '#fff' },
  ver: {
    marginLeft: 'auto',
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.inkSoft,
  },
  pontos: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  ponto: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(33,29,24,0.16)' },
  pontoAtivo: { width: 22, backgroundColor: colors.gold },
});
