import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/Chip';
import { CtaButton } from '@/components/CtaButton';
import { GenderBadge } from '@/components/GenderBadge';
import { MiniCard } from '@/components/MiniCard';
import { ProductImage } from '@/components/ProductImage';
import { useToast } from '@/components/ToastProvider';
import { TopBar } from '@/components/TopBar';
import { useCatalog, usePerfume } from '@/data/catalogStore';
import { similarTo } from '@/logic/filters';
import { formatPrice, stockLabel } from '@/logic/format';
import { colors, familyLabels, fonts, intensityLabels } from '@/theme/theme';

export default function PerfumeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { perfumes } = useCatalog();
  const perfume = usePerfume(id);
  const { showToast } = useToast();

  const similares = useMemo(
    () => (perfume ? similarTo(perfume, perfumes) : []),
    [perfume, perfumes],
  );

  if (!perfume) {
    return (
      <SafeAreaView style={styles.screen}>
        <TopBar title="Perfume" />
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle}>Este perfume não está mais disponível</Text>
          <CtaButton
            label="Voltar ao catálogo"
            variant="secondary"
            style={styles.notFoundButton}
            onPress={() => router.replace('/catalog')}
          />
        </View>
      </SafeAreaView>
    );
  }

  const stock = stockLabel(perfume);

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar title={perfume.marca} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ProductImage perfume={perfume} height={360} bottle="lg" />

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={styles.titleCol}>
              <Text style={styles.eyebrow}>{perfume.marca.toUpperCase()}</Text>
              <Text style={styles.name}>{perfume.nome}</Text>
            </View>
            <GenderBadge genero={perfume.genero} size={44} />
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(perfume.preco)}</Text>
            <View style={styles.stockRow}>
              <View
                style={[styles.dot, { backgroundColor: stock.low ? colors.stockLow : colors.stockOk }]}
              />
              <Text style={[styles.stockText, stock.low && { color: colors.gold }]}>
                {stock.label}
              </Text>
            </View>
          </View>

          <View style={styles.hairline} />

          {perfume.enriquecido && (
            <View style={styles.tagRow}>
              {perfume.familias.map((f) => (
                <Chip key={f} label={familyLabels[f]} />
              ))}
              {perfume.intensidade !== null && (
                <Chip label={intensityLabels[perfume.intensidade]} />
              )}
            </View>
          )}

          {!!perfume.descricao && <Text style={styles.description}>{perfume.descricao}</Text>}

          {similares.length > 0 && (
            <>
              <Text style={styles.similarLabel}>PERFUMES SIMILARES</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.similarRow}
              >
                {similares.map((s) => (
                  <MiniCard
                    key={s.id}
                    perfume={s}
                    width={170}
                    onPress={() =>
                      router.push({ pathname: '/perfume/[id]', params: { id: s.id } })
                    }
                  />
                ))}
              </ScrollView>
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.ctaBar}>
        <CtaButton
          label="Quero experimentar"
          style={styles.ctaButton}
          onPress={() => showToast('Um atendente foi avisado e já traz uma amostra para você.')}
        />
        <CtaButton
          label="Chamar atendente"
          variant="secondary"
          style={styles.ctaButton}
          onPress={() => showToast('Um atendente vem falar com você em instantes.')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 24 },
  body: { paddingHorizontal: 44, paddingTop: 36 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  titleCol: { flex: 1 },
  eyebrow: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 4,
    color: colors.gold,
  },
  name: {
    fontFamily: fonts.serif,
    fontSize: 52,
    lineHeight: 57,
    color: colors.ink,
    marginTop: 10,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 18 },
  price: { fontFamily: fonts.sansBold, fontSize: 30, color: colors.ink },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  stockText: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted },
  hairline: { width: 44, height: 1, backgroundColor: colors.gold, marginTop: 24 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24 },
  description: {
    fontFamily: fonts.sans,
    fontSize: 17.5,
    lineHeight: 30,
    color: colors.inkSoft,
    marginTop: 22,
    maxWidth: 640,
  },
  similarLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11.5,
    letterSpacing: 2.4,
    color: colors.muted,
    marginTop: 36,
    marginBottom: 12,
  },
  similarRow: { gap: 14, paddingBottom: 8 },
  ctaBar: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 36,
    paddingTop: 20,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.bg,
  },
  ctaButton: { flex: 1 },
  notFound: { alignItems: 'center', paddingTop: 120, paddingHorizontal: 40 },
  notFoundTitle: {
    fontFamily: fonts.serif,
    fontSize: 32,
    color: colors.ink,
    textAlign: 'center',
  },
  notFoundButton: { marginTop: 26, paddingHorizontal: 44 },
});
