import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/Chip';
import { CtaButton } from '@/components/CtaButton';
import { GenderBadge } from '@/components/GenderBadge';
import { MiniCard } from '@/components/MiniCard';
import { PinModal } from '@/components/PinModal';
import { PressableScale } from '@/components/PressableScale';
import { ProductImage } from '@/components/ProductImage';
import { PromoModal } from '@/components/PromoModal';
import { useToast } from '@/components/ToastProvider';
import { TopBar } from '@/components/TopBar';
import { useCatalog, usePerfume } from '@/data/catalogStore';
import { similarTo } from '@/logic/filters';
import { formatPrice, stockLabel } from '@/logic/format';
import { trackAmostraPedida, trackAtendenteChamado, trackProdutoVisto } from '@/logic/metrics';
import { splitNotes, type OlfactoryNotes } from '@/logic/notes';
import { colors, familyLabels, fonts, intensityLabels } from '@/theme/theme';

const NOTE_LABELS: Record<keyof OlfactoryNotes, string> = {
  topo: 'TOPO',
  coracao: 'CORAÇÃO',
  fundo: 'FUNDO',
};

function NoteRow({ section, items }: { section: keyof OlfactoryNotes; items: string[] }) {
  return (
    <View style={styles.noteRow}>
      <Text style={styles.noteLabel}>{NOTE_LABELS[section]}</Text>
      <Text style={styles.noteItems}>{items.join('  ·  ')}</Text>
    </View>
  );
}

export default function PerfumeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { perfumes } = useCatalog();
  const perfume = usePerfume(id);
  const { showToast } = useToast();
  const [pinVisible, setPinVisible] = useState(false);
  const [promoVisible, setPromoVisible] = useState(false);

  const similares = useMemo(
    () => (perfume ? similarTo(perfume, perfumes) : []),
    [perfume, perfumes],
  );

  const { notas, resto } = useMemo(() => splitNotes(perfume?.descricao), [perfume?.descricao]);

  useEffect(() => {
    if (perfume?.id) trackProdutoVisto(perfume.id);
  }, [perfume?.id]);

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
            {perfume.precoPromocional !== null ? (
              <View style={styles.promoCol}>
                <Text style={styles.priceOld}>{formatPrice(perfume.preco)}</Text>
                <View style={styles.promoRow}>
                  <Text style={[styles.price, { color: colors.gold }]}>
                    {formatPrice(perfume.precoPromocional)}
                  </Text>
                  <View style={styles.offerPill}>
                    <Text style={styles.offerPillText}>OFERTA</Text>
                  </View>
                </View>
              </View>
            ) : (
              <Text style={styles.price}>{formatPrice(perfume.preco)}</Text>
            )}
            <View style={styles.stockRow}>
              <View
                style={[styles.dot, { backgroundColor: stock.low ? colors.stockLow : colors.stockOk }]}
              />
              <Text style={[styles.stockText, stock.low && { color: colors.gold }]}>
                {stock.label}
              </Text>
            </View>
            <PressableScale
              scaleTo={0.9}
              onPress={() => setPinVisible(true)}
              style={styles.editButton}
            >
              <Text style={styles.editButtonLabel}>✎</Text>
            </PressableScale>
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

          {notas && (
            <View style={styles.pyramid}>
              <Text style={styles.pyramidLabel}>PIRÂMIDE OLFATIVA</Text>
              {(['topo', 'coracao', 'fundo'] as const).map(
                (s) => notas[s] && <NoteRow key={s} section={s} items={notas[s]} />,
              )}
            </View>
          )}

          {!!resto && <Text style={styles.description}>{resto}</Text>}

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
          onPress={() => {
            trackAmostraPedida(perfume.id);
            showToast('Um atendente foi avisado e já traz uma amostra para você.');
          }}
        />
        <CtaButton
          label="Chamar atendente"
          variant="secondary"
          style={styles.ctaButton}
          onPress={() => {
            trackAtendenteChamado();
            showToast('Um atendente vem falar com você em instantes.');
          }}
        />
      </View>

      <PinModal
        visible={pinVisible}
        title="Editar oferta"
        onClose={() => setPinVisible(false)}
        onSuccess={() => {
          setPinVisible(false);
          setPromoVisible(true);
        }}
      />
      <PromoModal
        visible={promoVisible}
        perfume={perfume}
        onClose={() => setPromoVisible(false)}
      />
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
  promoCol: {},
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  priceOld: {
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  offerPill: {
    backgroundColor: colors.gold,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  offerPillText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: '#ffffff',
  },
  editButton: {
    marginLeft: 'auto',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonLabel: { fontSize: 16, color: colors.muted },
  pyramid: { marginTop: 26 },
  pyramidLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11.5,
    letterSpacing: 2.4,
    color: colors.muted,
    marginBottom: 12,
  },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginTop: 8 },
  noteLabel: {
    width: 86,
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.gold,
    marginTop: 3,
  },
  noteItems: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 16.5,
    lineHeight: 26,
    color: colors.inkSoft,
  },
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
