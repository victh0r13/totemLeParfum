import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CtaButton } from '@/components/CtaButton';
import { PressableScale } from '@/components/PressableScale';
import { TopBar } from '@/components/TopBar';
import { useCatalog } from '@/data/catalogStore';
import { usePromotions } from '@/data/promotionsStore';
import { formatPrice } from '@/logic/format';
import { getMetrics, resetMetrics, type MetricsData } from '@/logic/metrics';
import { colors, familyLabels, fonts } from '@/theme/theme';
import type { Perfume } from '@/types/catalog';

const QUEM_LABELS: Record<string, string> = { mim: 'Para mim', presente: 'Presente' };
const OCASIAO_LABELS: Record<string, string> = {
  trabalho: 'Trabalho',
  dia: 'Dia a dia',
  noite: 'Noite & eventos',
  esporte: 'Esporte',
};
const INTENSIDADE_LABELS: Record<string, string> = {
  '1': 'Leve',
  '2': 'Moderada',
  '3': 'Marcante',
};
const ESTILO_LABELS: Record<string, string> = {
  classico: 'Clássico',
  moderno: 'Moderno',
  natural: 'Natural',
};

function topEntries(record: Record<string, number>, limit: number): [string, number][] {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children.toUpperCase()}</Text>;
}

function CountRow({ label, count, max }: { label: string; count: number; max: number }) {
  const width = max > 0 ? Math.max(6, (count / max) * 100) : 0;
  return (
    <View style={styles.countRow}>
      <Text style={styles.countLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.countBarTrack}>
        <View style={[styles.countBarFill, { width: `${width}%` }]} />
      </View>
      <Text style={styles.countValue}>{count}</Text>
    </View>
  );
}

/** Painel da loja: ofertas ativas + métricas de uso do totem (atrás do PIN). */
export default function AdminScreen() {
  const router = useRouter();
  const { perfumes } = useCatalog();
  const { promocoes, setPromocao } = usePromotions();
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const reload = useCallback(() => {
    getMetrics().then(setMetrics);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const byId = useMemo(() => {
    const map = new Map<string, Perfume>();
    for (const p of perfumes) map.set(p.id, p);
    return map;
  }, [perfumes]);

  const ofertas = useMemo(
    () =>
      Object.entries(promocoes)
        .map(([id, preco]) => ({ perfume: byId.get(id), id, preco }))
        .filter((o) => o.perfume),
    [promocoes, byId],
  );

  const nomeDe = (id: string) => byId.get(id)?.nome ?? `(fora do catálogo: ${id})`;
  const desde = metrics ? new Date(metrics.desde).toLocaleDateString('pt-BR') : '';

  const vistos = metrics ? topEntries(metrics.produtoVisto, 8) : [];
  const amostras = metrics ? topEntries(metrics.amostraPedida, 5) : [];
  const maxVisto = vistos[0]?.[1] ?? 0;
  const maxAmostra = amostras[0]?.[1] ?? 0;

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar title="Painel da loja" onBack={() => router.replace('/')} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Painel da loja</Text>
        {!!desde && <Text style={styles.subtitle}>Dados coletados neste totem desde {desde}.</Text>}

        <SectionTitle>Ofertas ativas</SectionTitle>
        {ofertas.length === 0 ? (
          <Text style={styles.empty}>
            Nenhuma oferta ativa. Para criar uma, abra a página do perfume e toque no ícone ✎ ao
            lado do preço.
          </Text>
        ) : (
          ofertas.map(({ id, preco, perfume }) => (
            <View key={id} style={styles.offerRow}>
              <View style={styles.offerInfo}>
                <Text style={styles.offerName} numberOfLines={1}>
                  {perfume!.nome}
                </Text>
                <Text style={styles.offerPrices}>
                  <Text style={styles.offerOld}>{formatPrice(perfume!.preco)}</Text>
                  {'   '}
                  <Text style={styles.offerNew}>{formatPrice(preco)}</Text>
                </Text>
              </View>
              <PressableScale
                scaleTo={0.94}
                onPress={() => setPromocao(id, null)}
                style={styles.removeButton}
              >
                <Text style={styles.removeLabel}>Remover</Text>
              </PressableScale>
            </View>
          ))
        )}

        <SectionTitle>Perfumes mais vistos</SectionTitle>
        {vistos.length === 0 ? (
          <Text style={styles.empty}>Ainda sem visualizações registradas.</Text>
        ) : (
          vistos.map(([id, n]) => <CountRow key={id} label={nomeDe(id)} count={n} max={maxVisto} />)
        )}

        <SectionTitle>Pedidos de amostra</SectionTitle>
        {amostras.length === 0 ? (
          <Text style={styles.empty}>Ainda sem pedidos de amostra.</Text>
        ) : (
          amostras.map(([id, n]) => (
            <CountRow key={id} label={nomeDe(id)} count={n} max={maxAmostra} />
          ))
        )}

        {metrics && (
          <>
            <SectionTitle>Quiz</SectionTitle>
            <Text style={styles.statLine}>
              {metrics.quizConcluidos} quiz concluído{metrics.quizConcluidos === 1 ? '' : 's'} ·
              atendente chamado {metrics.atendenteChamado}x
            </Text>
            {metrics.quizConcluidos > 0 && (
              <View style={styles.quizGrid}>
                {(
                  [
                    ['Para quem', metrics.quiz.quem, QUEM_LABELS],
                    ['Ocasião', metrics.quiz.ocasiao, OCASIAO_LABELS],
                    ['Intensidade', metrics.quiz.intensidade, INTENSIDADE_LABELS],
                    ['Famílias', metrics.quiz.familias, familyLabels as Record<string, string>],
                    ['Estilo', metrics.quiz.estilo, ESTILO_LABELS],
                  ] as const
                ).map(([titulo, dados, labels]) => {
                  const rows = topEntries(dados, 6);
                  if (rows.length === 0) return null;
                  const max = rows[0][1];
                  return (
                    <View key={titulo} style={styles.quizBlock}>
                      <Text style={styles.quizBlockTitle}>{titulo}</Text>
                      {rows.map(([k, n]) => (
                        <CountRow key={k} label={labels[k] ?? k} count={n} max={max} />
                      ))}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        <View style={styles.resetArea}>
          {confirmReset ? (
            <View style={styles.resetConfirm}>
              <Text style={styles.resetWarn}>Zerar todas as métricas deste totem?</Text>
              <View style={styles.resetButtons}>
                <CtaButton
                  label="Sim, zerar"
                  style={styles.resetButton}
                  onPress={async () => {
                    await resetMetrics();
                    setConfirmReset(false);
                    reload();
                  }}
                />
                <CtaButton
                  label="Cancelar"
                  variant="secondary"
                  style={styles.resetButton}
                  onPress={() => setConfirmReset(false)}
                />
              </View>
            </View>
          ) : (
            <CtaButton
              label="Zerar métricas"
              variant="secondary"
              onPress={() => setConfirmReset(true)}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 44, paddingBottom: 48 },
  title: { fontFamily: fonts.serif, fontSize: 44, color: colors.ink, marginTop: 28 },
  subtitle: { fontFamily: fonts.sans, fontSize: 15, color: colors.muted, marginTop: 8 },
  sectionTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 2.6,
    color: colors.gold,
    marginTop: 36,
    marginBottom: 12,
  },
  empty: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23, color: colors.muted },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  offerInfo: { flex: 1 },
  offerName: { fontFamily: fonts.serifSemiBold, fontSize: 20, color: colors.ink },
  offerPrices: { marginTop: 3 },
  offerOld: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  offerNew: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.gold },
  removeButton: {
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.2)',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  removeLabel: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.ink },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  countLabel: {
    width: '40%',
    maxWidth: 240,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.inkSoft,
  },
  countBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(33,29,24,0.07)',
    overflow: 'hidden',
  },
  countBarFill: { height: '100%', borderRadius: 4, backgroundColor: colors.goldSoft },
  countValue: {
    width: 34,
    textAlign: 'right',
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.ink,
  },
  statLine: { fontFamily: fonts.sans, fontSize: 15, color: colors.inkSoft },
  quizGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 26, marginTop: 18 },
  quizBlock: { flexBasis: '46%', flexGrow: 1 },
  quizBlockTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.ink,
    marginBottom: 8,
  },
  resetArea: { marginTop: 44 },
  resetConfirm: { gap: 12 },
  resetWarn: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: '#a4433a' },
  resetButtons: { gap: 12 },
  resetButton: { width: '100%' },
});
