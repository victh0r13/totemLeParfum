import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AttractMode } from '@/components/AttractMode';
import { FadeUp } from '@/components/FadeUp';
import { PressableScale } from '@/components/PressableScale';
import { ProductImage } from '@/components/ProductImage';
import { Vitrine } from '@/components/Vitrine';
import { ATTRACT_IDLE_SECONDS } from '@/config';
import { useCatalog } from '@/data/catalogStore';
import { temFotoOffline } from '@/data/images';
import { contarPorTipo, marcasPorContagem } from '@/logic/filters';
import { capaDoTipo, destaques } from '@/logic/vitrine';
import { colors, fonts, TIPOS, tipoLabels } from '@/theme/theme';
import type { Perfume, TipoProduto } from '@/types/catalog';

/** Quantas marcas aparecem na faixa da tela inicial; o resto está no catálogo. */
const MARCAS_NA_HOME = 14;

/**
 * Relógio do modo atração: zera a cada toque e liga o modo depois de
 * ATTRACT_IDLE_SECONDS sem ninguém mexer na tela inicial.
 */
function useOcioso(segundos: number) {
  const [ocioso, setOcioso] = useState(false);
  const [ultimoToque, setUltimoToque] = useState(() => Date.now());

  useEffect(() => {
    if (ocioso) return;
    const timer = setTimeout(() => setOcioso(true), segundos * 1000);
    return () => clearTimeout(timer);
  }, [ocioso, segundos, ultimoToque]);

  const tocar = useCallback(() => {
    setUltimoToque(Date.now());
    setOcioso(false);
  }, []);

  return { ocioso, tocar };
}

function Secao({ titulo, acao, onAcao }: { titulo: string; acao?: string; onAcao?: () => void }) {
  return (
    <View style={styles.secao}>
      <Text style={styles.secaoTitulo}>{titulo}</Text>
      {!!acao && (
        <Pressable onPress={onAcao} hitSlop={12}>
          <Text style={styles.secaoAcao}>{acao}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Ladrilho({
  tipo,
  total,
  capa,
  largura,
  onPress,
}: {
  tipo: TipoProduto;
  total: number;
  capa: Perfume | null;
  largura: number;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.97} style={[styles.ladrilho, { width: largura }]}>
      {capa ? (
        <ProductImage perfume={capa} height={150} bottle="md" />
      ) : (
        <View style={{ height: 150 }} />
      )}
      <View style={styles.ladrilhoInfo}>
        <Text style={styles.ladrilhoTitulo}>{tipoLabels[tipo]}</Text>
        <Text style={styles.ladrilhoConta}>{total}</Text>
      </View>
    </PressableScale>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { perfumes } = useCatalog();
  const { height, width } = useWindowDimensions();
  // Telas mais baixas (janela de navegador, tablets menores) encolhem a vitrine.
  const compact = height < 1000;
  const lateral = Math.min(48, Math.max(20, width * 0.05));
  const larguraUtil = Math.min(width, 900) - lateral * 2;

  const { ocioso, tocar } = useOcioso(ATTRACT_IDLE_SECONDS);

  const vitrine = useMemo(() => destaques(perfumes, temFotoOffline), [perfumes]);
  const porTipo = useMemo(() => contarPorTipo(perfumes), [perfumes]);
  const tipos = TIPOS.filter((t) => porTipo[t] > 0);
  const capas = useMemo(
    () => Object.fromEntries(TIPOS.map((t) => [t, capaDoTipo(perfumes, t, temFotoOffline)])),
    [perfumes],
  ) as Record<TipoProduto, Perfume | null>;
  const marcas = useMemo(() => marcasPorContagem(perfumes).slice(0, MARCAS_NA_HOME), [perfumes]);

  // Dois ladrilhos por linha; com um tipo só não há o que navegar.
  const larguraLadrilho = (larguraUtil - 16) / 2;

  return (
    <SafeAreaView style={styles.screen}>
      <View
        style={styles.screen}
        onStartShouldSetResponderCapture={() => {
          tocar();
          return false;
        }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: lateral }]}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={tocar}
        >
          <View style={[styles.hero, compact && { paddingTop: 20 }]}>
            <Text style={styles.eyebrow}>PERFUMARIA</Text>
            {/* Toque longo (equipe): o PIN é pedido pela própria tela do painel. */}
            <Pressable delayLongPress={1200} onLongPress={() => router.push('/admin')}>
              <Text style={[styles.logo, compact && styles.logoCompact]}>Le Parfum</Text>
            </Pressable>
          </View>

          {vitrine.length > 0 && (
            <FadeUp delay={60}>
              <Vitrine
                produtos={vitrine}
                altura={compact ? 420 : 560}
                onAbrir={(p) => router.push({ pathname: '/perfume/[id]', params: { id: p.id } })}
              />
            </FadeUp>
          )}

          <FadeUp delay={140}>
            <View style={styles.ctas}>
              <PressableScale
                onPress={() => router.push('/quiz')}
                scaleTo={0.98}
                containerStyle={styles.ctaCaixa}
                style={[styles.cta, styles.ctaOuro]}
              >
                <Text style={[styles.ctaTitulo, styles.ctaTituloClaro]}>Descobrir meu perfume</Text>
                <Text style={[styles.ctaSub, styles.ctaSubClaro]}>
                  Seis perguntas rápidas e uma seleção feita para você
                </Text>
              </PressableScale>
              <PressableScale
                onPress={() => router.push('/catalog')}
                scaleTo={0.98}
                containerStyle={styles.ctaCaixa}
                style={styles.cta}
              >
                <Text style={styles.ctaTitulo}>Ver catálogo</Text>
                <Text style={styles.ctaSub}>
                  {perfumes.length} produtos com filtros por família, gênero e preço
                </Text>
              </PressableScale>
            </View>
          </FadeUp>

          {tipos.length > 1 && (
            <FadeUp delay={220}>
              <Secao titulo="NAVEGUE POR CATEGORIA" />
              <View style={styles.grade}>
                {tipos.map((t) => (
                  <Ladrilho
                    key={t}
                    tipo={t}
                    total={porTipo[t]}
                    capa={capas[t]}
                    largura={larguraLadrilho}
                    onPress={() => router.push({ pathname: '/catalog', params: { tipo: t } })}
                  />
                ))}
              </View>
            </FadeUp>
          )}

          {marcas.length > 0 && (
            <FadeUp delay={300}>
              <Secao
                titulo="MARCAS"
                acao="Ver todas →"
                onAcao={() => router.push('/catalog')}
              />
              <View style={styles.marcas}>
                {marcas.map(({ marca, total }) => (
                  <PressableScale
                    key={marca}
                    scaleTo={0.95}
                    onPress={() => router.push({ pathname: '/catalog', params: { marca } })}
                    style={styles.marca}
                  >
                    <Text style={styles.marcaNome}>{marca}</Text>
                    <Text style={styles.marcaConta}>{total}</Text>
                  </PressableScale>
                ))}
              </View>
            </FadeUp>
          )}
        </ScrollView>

        {ocioso && vitrine.length > 0 && <AttractMode produtos={vitrine} onAcordar={tocar} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingBottom: 48, maxWidth: 900, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', paddingTop: 36, paddingBottom: 26 },
  eyebrow: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 4.2,
    color: colors.gold,
  },
  logo: {
    fontFamily: fonts.serif,
    fontSize: 64,
    lineHeight: 72,
    color: colors.ink,
    marginTop: 6,
  },
  logoCompact: { fontSize: 50, lineHeight: 58 },
  ctas: { flexDirection: 'row', gap: 16, marginTop: 26 },
  ctaCaixa: { flex: 1 },
  cta: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.09)',
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 26,
  },
  ctaOuro: { backgroundColor: colors.ink, borderColor: colors.ink },
  ctaTitulo: { fontFamily: fonts.serifSemiBold, fontSize: 28, lineHeight: 32, color: colors.ink },
  ctaTituloClaro: { color: colors.cream },
  ctaSub: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 21,
    color: colors.inkSoft,
    marginTop: 8,
  },
  ctaSubClaro: { color: colors.goldSoft },
  secao: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 40,
    marginBottom: 16,
  },
  secaoTitulo: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 2.6,
    color: colors.inkSoft,
  },
  secaoAcao: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.gold },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  ladrilho: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.08)',
    overflow: 'hidden',
  },
  ladrilhoInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  ladrilhoTitulo: { fontFamily: fonts.serifSemiBold, fontSize: 24, color: colors.ink },
  ladrilhoConta: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.muted },
  marcas: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  marca: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.14)',
    backgroundColor: colors.surface,
  },
  marcaNome: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink },
  marcaConta: { fontFamily: fonts.sans, fontSize: 13, color: colors.muted },
});
