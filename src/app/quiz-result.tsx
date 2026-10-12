import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CtaButton } from '@/components/CtaButton';
import { FadeUp } from '@/components/FadeUp';
import { MiniCard } from '@/components/MiniCard';
import { PressableScale } from '@/components/PressableScale';
import { ProductImage } from '@/components/ProductImage';
import { TopBar } from '@/components/TopBar';
import { useCatalog } from '@/data/catalogStore';
import { combinaCom } from '@/logic/filters';
import { formatPrice } from '@/logic/format';
import { motivosDaEscolha, respostasDoParam } from '@/logic/quiz';
import { colors, fonts } from '@/theme/theme';
import type { Perfume } from '@/types/catalog';

function Preco({ p, grande = false }: { p: Perfume; grande?: boolean }) {
  const emOferta = p.precoPromocional !== null;
  return (
    <View style={styles.precoRow}>
      <Text style={[grande ? styles.precoGrande : styles.preco, emOferta && { color: colors.gold }]}>
        {formatPrice(p.precoPromocional ?? p.preco)}
      </Text>
      {emOferta && <Text style={styles.precoAntigo}>{formatPrice(p.preco)}</Text>}
    </View>
  );
}

/** Motivos em pílulas douradas: "Doce e Oriental · Para a noite · Marcante". */
function Motivos({ motivos }: { motivos: string[] }) {
  if (motivos.length === 0) return null;
  return (
    <View style={styles.motivos}>
      {motivos.map((m) => (
        <View key={m} style={styles.motivo}>
          <Text style={styles.motivoTexto}>{m}</Text>
        </View>
      ))}
    </View>
  );
}

export default function QuizResultScreen() {
  const router = useRouter();
  const { ids, respostas } = useLocalSearchParams<{ ids?: string; respostas?: string }>();
  const { perfumes } = useCatalog();
  const answers = useMemo(() => respostasDoParam(respostas), [respostas]);

  const results = useMemo(() => {
    const wanted = (ids ?? '').split(',').filter(Boolean);
    return wanted
      .map((id) => perfumes.find((p) => p.id === id))
      .filter((p): p is Perfume => !!p);
  }, [ids, perfumes]);

  const [melhor, ...outros] = results;
  // Fecha a venda: o body splash e o hidratante da mesma linha da melhor escolha.
  const completar = useMemo(
    () => (melhor ? combinaCom(melhor, perfumes, 6) : []),
    [melhor, perfumes],
  );

  const abrir = (p: Perfume) => router.push({ pathname: '/perfume/[id]', params: { id: p.id } });

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar title="Sua seleção" onBack={() => router.replace('/')} />

      {!melhor ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            Ainda não temos sugestões suficientes para essas respostas
          </Text>
          <Text style={styles.emptySubtitle}>
            Explore o catálogo completo ou refaça o quiz com outras respostas.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>SELEÇÃO PARA VOCÊ</Text>
          <Text style={styles.title}>Encontramos estas fragrâncias</Text>

          <FadeUp delay={60}>
            <PressableScale onPress={() => abrir(melhor)} scaleTo={0.99} style={styles.destaque}>
              <View style={styles.destaqueFoto}>
                <ProductImage perfume={melhor} height={320} bottle="lg" />
              </View>
              <View style={styles.destaqueInfo}>
                <View style={styles.selo}>
                  <Text style={styles.seloTexto}>MELHOR ESCOLHA</Text>
                </View>
                {!!melhor.marca && <Text style={styles.marca}>{melhor.marca.toUpperCase()}</Text>}
                <Text style={styles.destaqueNome} numberOfLines={3}>
                  {melhor.nome}
                </Text>
                <Preco p={melhor} grande />
                <Motivos motivos={motivosDaEscolha(melhor, answers)} />
                <Text style={styles.ver}>Ver detalhes →</Text>
              </View>
            </PressableScale>
          </FadeUp>

          {outros.length > 0 && (
            <>
              <Text style={styles.secao}>TAMBÉM COMBINAM COM VOCÊ</Text>
              {outros.map((p, i) => (
                <FadeUp key={p.id} delay={140 + i * 70}>
                  <PressableScale onPress={() => abrir(p)} scaleTo={0.99} style={styles.linha}>
                    <View style={styles.linhaFoto}>
                      <ProductImage perfume={p} height={128} bottle="sm" />
                    </View>
                    <View style={styles.linhaInfo}>
                      {!!p.marca && <Text style={styles.marca}>{p.marca.toUpperCase()}</Text>}
                      <Text style={styles.linhaNome} numberOfLines={2}>
                        {p.nome}
                      </Text>
                      <Preco p={p} />
                      <Motivos motivos={motivosDaEscolha(p, answers)} />
                    </View>
                  </PressableScale>
                </FadeUp>
              ))}
            </>
          )}

          {completar.length > 0 && (
            <>
              <Text style={styles.secao}>PARA COMPLETAR</Text>
              <Text style={styles.secaoSub}>Da mesma linha da sua melhor escolha</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.completarRow}
              >
                {completar.map((p) => (
                  <MiniCard key={p.id} perfume={p} width={180} onPress={() => abrir(p)} />
                ))}
              </ScrollView>
            </>
          )}
        </ScrollView>
      )}

      <View style={styles.ctaBar}>
        <CtaButton
          label="Refazer quiz"
          variant="secondary"
          style={styles.ctaButton}
          onPress={() => router.replace('/quiz')}
        />
        <CtaButton
          label="Explorar catálogo"
          style={styles.ctaButton}
          onPress={() => router.replace('/catalog')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 44, paddingTop: 32, paddingBottom: 32 },
  eyebrow: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 4,
    color: colors.gold,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 42,
    lineHeight: 48,
    color: colors.ink,
    marginTop: 10,
    marginBottom: 26,
  },
  destaque: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.goldSoft,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  destaqueFoto: { width: '44%', justifyContent: 'center' },
  destaqueInfo: { flex: 1, padding: 28, justifyContent: 'center' },
  selo: {
    alignSelf: 'flex-start',
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 14,
  },
  seloTexto: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.8, color: colors.goldSoft },
  marca: { fontFamily: fonts.sansSemiBold, fontSize: 12, letterSpacing: 2.2, color: colors.gold },
  destaqueNome: {
    fontFamily: fonts.serif,
    fontSize: 30,
    lineHeight: 35,
    color: colors.ink,
    marginTop: 6,
  },
  precoRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 10 },
  precoGrande: { fontFamily: fonts.sansBold, fontSize: 24, color: colors.ink },
  preco: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.ink },
  precoAntigo: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  motivos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  motivo: {
    backgroundColor: colors.creamGold,
    borderWidth: 1,
    borderColor: 'rgba(168,130,63,0.3)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  motivoTexto: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.gold },
  ver: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.inkSoft, marginTop: 18 },
  secao: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 2.6,
    color: colors.inkSoft,
    marginTop: 38,
    marginBottom: 14,
  },
  secaoSub: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.muted,
    marginTop: -8,
    marginBottom: 14,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.08)',
    overflow: 'hidden',
    marginBottom: 14,
  },
  linhaFoto: { width: 150 },
  linhaInfo: { flex: 1, paddingVertical: 18, paddingHorizontal: 22 },
  linhaNome: {
    fontFamily: fonts.serif,
    fontSize: 23,
    lineHeight: 28,
    color: colors.ink,
    marginTop: 4,
  },
  completarRow: { gap: 14, paddingBottom: 6 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 60 },
  emptyTitle: {
    fontFamily: fonts.serif,
    fontSize: 30,
    lineHeight: 37,
    color: colors.ink,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 12,
  },
  ctaBar: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 36,
    paddingTop: 20,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  ctaButton: { flex: 1 },
});
