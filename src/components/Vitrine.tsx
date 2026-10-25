import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ProductImage } from '@/components/ProductImage';
import { VITRINE_INTERVALO_SECONDS } from '@/config';
import { formatPrice } from '@/logic/format';
import { colors, fonts } from '@/theme/theme';
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

const DESLIZE = { duration: 900, easing: Easing.bezier(0.22, 0.8, 0.24, 1) };
const ESCALA_VIZINHO = 0.8;

const pad = (n: number) => String(n).padStart(2, '0');

/** Onde cada card fica conforme a distância até o destaque atual. */
function posicao(rel: number, total: number, passo: number) {
  if (rel === 0) return { x: 0, escala: 1, opacidade: 1, anima: true };
  if (rel === 1) return { x: passo, escala: ESCALA_VIZINHO, opacidade: 0.45, anima: true };
  if (rel === total - 1) return { x: -passo, escala: ESCALA_VIZINHO, opacidade: 0.45, anima: true };
  if (rel === total - 2) return { x: -passo * 2, escala: ESCALA_VIZINHO, opacidade: 0, anima: true };
  // Fora de cena: espera à direita sem animar, para entrar como próximo vizinho.
  return { x: passo * 2, escala: ESCALA_VIZINHO, opacidade: 0, anima: false };
}

interface CardProps {
  perfume: Perfume;
  rel: number;
  total: number;
  largura: number;
  altura: number;
  esquerda: number;
  onPress: () => void;
}

function Card({ perfume, rel, total, largura, altura, esquerda, onPress }: CardProps) {
  const alvo = posicao(rel, total, largura * 1.03);
  const x = useSharedValue(alvo.x);
  const escala = useSharedValue(alvo.escala);
  const opacidade = useSharedValue(alvo.opacidade);

  useEffect(() => {
    const destino = posicao(rel, total, largura * 1.03);
    if (destino.anima) {
      x.value = withTiming(destino.x, DESLIZE);
      escala.value = withTiming(destino.escala, DESLIZE);
      opacidade.value = withTiming(destino.opacidade, DESLIZE);
      return;
    }
    x.value = destino.x;
    escala.value = destino.escala;
    opacidade.value = destino.opacidade;
  }, [rel, total, largura, x, escala, opacidade]);

  const estilo = useAnimatedStyle(() => ({
    opacity: opacidade.value,
    transform: [{ translateX: x.value }, { scale: escala.value }],
  }));

  return (
    <Animated.View
      style={[styles.card, { left: esquerda, width: largura, height: altura, zIndex: rel === 0 ? 3 : 1 }, estilo]}
    >
      <Pressable onPress={onPress} style={styles.cardToque}>
        <ProductImage perfume={perfume} height={altura - 48} bottle="lg" />
      </Pressable>
    </Animated.View>
  );
}

/** Linha fina que enche durante o tempo de cada destaque. */
function Progresso({ indice, total, duracao }: { indice: number; total: number; duracao: number }) {
  const cheio = useSharedValue(0);
  useEffect(() => {
    cheio.value = 0;
    cheio.value = withTiming(1, { duration: duracao, easing: Easing.linear });
  }, [indice, duracao, cheio]);
  const barra = useAnimatedStyle(() => ({ width: `${cheio.value * 100}%` }));

  return (
    <View style={styles.progresso}>
      <Text style={[styles.progressoNum, { textAlign: 'right' }]}>{pad(indice + 1)}</Text>
      <View style={styles.trilho}>
        <Animated.View style={[styles.barra, barra]} />
      </View>
      <Text style={styles.progressoNum}>{pad(total)}</Text>
    </View>
  );
}

interface Props {
  produtos: Perfume[];
  altura: number;
  largura: number;
  onAbrir: (p: Perfume) => void;
}

/**
 * Carrossel de destaques da tela inicial: o produto da vez no centro, os
 * vizinhos menores aparecendo dos lados. Tocar no centro abre o produto;
 * tocar num vizinho traz ele para o centro.
 */
export function Vitrine({ produtos, altura, largura, onAbrir }: Props) {
  const duracao = VITRINE_INTERVALO_SECONDS * 1000;
  const { indice, ir } = useRodizio(produtos.length, duracao);
  const atual = produtos[indice];
  if (!atual) return null;

  const total = produtos.length;
  const larguraCard = Math.min(largura * 0.58, 460);
  const emOferta = atual.precoPromocional !== null;

  return (
    <View style={styles.wrap}>
      <View style={{ height: altura }}>
        {produtos.map((p, k) => (
          <Card
            key={p.id}
            perfume={p}
            rel={(k - indice + total) % total}
            total={total}
            largura={larguraCard}
            altura={altura}
            esquerda={(largura - larguraCard) / 2}
            onPress={() => (k === indice ? onAbrir(p) : ir(k))}
          />
        ))}
      </View>

      <View style={styles.info}>
        {/* A chave troca a cada produto: o texto anterior sai enquanto o novo entra. */}
        <Animated.View
          key={atual.id}
          entering={FadeIn.duration(600).delay(350)}
          exiting={FadeOut.duration(300)}
          style={styles.infoConteudo}
        >
          <Text style={styles.nome} numberOfLines={1}>
            {atual.nome}
          </Text>
          <View style={styles.precoRow}>
            {!!atual.marca && <Text style={styles.marca}>{atual.marca}  ·</Text>}
            {emOferta && <Text style={styles.precoAntigo}>{formatPrice(atual.preco)}</Text>}
            <Text style={[styles.preco, emOferta && { color: colors.gold }]}>
              {formatPrice(atual.precoPromocional ?? atual.preco)}
            </Text>
          </View>
        </Animated.View>
      </View>

      {total > 1 && <Progresso indice={indice} total={total} duracao={duracao} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 18 },
  card: {
    position: 'absolute',
    top: 0,
    backgroundColor: colors.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.06)',
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  cardToque: { flex: 1, borderRadius: 26, overflow: 'hidden', padding: 12, justifyContent: 'center' },
  info: { height: 76 },
  infoConteudo: { ...StyleSheet.absoluteFill, alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  nome: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 38, color: colors.ink, textAlign: 'center' },
  precoRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  marca: { fontFamily: fonts.sans, fontSize: 16, color: colors.muted },
  precoAntigo: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  preco: { fontFamily: fonts.sansSemiBold, fontSize: 17, color: colors.ink },
  progresso: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  progressoNum: { width: 24, fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.muted },
  trilho: {
    width: 140,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(33,29,24,0.12)',
    overflow: 'hidden',
  },
  barra: { height: '100%', backgroundColor: colors.gold },
});
