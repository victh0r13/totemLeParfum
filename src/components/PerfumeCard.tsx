import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FadeUp } from '@/components/FadeUp';
import { GenderBadge } from '@/components/GenderBadge';
import { PressableScale } from '@/components/PressableScale';
import { ProductImage } from '@/components/ProductImage';
import { formatPrice, stockLabel } from '@/logic/format';
import { colors, fonts } from '@/theme/theme';
import type { Perfume } from '@/types/catalog';

interface Props {
  perfume: Perfume;
  onPress: () => void;
  delay?: number;
}

/** Card do grid do catálogo e dos resultados do quiz. */
export function PerfumeCard({ perfume, onPress, delay = 0 }: Props) {
  const stock = stockLabel(perfume);
  return (
    <FadeUp delay={delay} style={styles.wrapper}>
      <PressableScale onPress={onPress} scaleTo={0.97} style={styles.card}>
        <View>
          <ProductImage perfume={perfume} height={190} bottle="md" />
          {perfume.precoPromocional !== null && (
            <View style={styles.offerBadge}>
              <Text style={styles.offerBadgeText}>OFERTA</Text>
            </View>
          )}
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={styles.titleCol}>
              {!!perfume.marca && (
                <Text style={styles.brand} numberOfLines={1}>
                  {perfume.marca.toUpperCase()}
                </Text>
              )}
              <Text style={styles.name} numberOfLines={2}>
                {perfume.nome}
              </Text>
            </View>
            <GenderBadge genero={perfume.genero} />
          </View>
          <View style={styles.footer}>
            {perfume.precoPromocional !== null ? (
              <View>
                <Text style={styles.priceOld}>{formatPrice(perfume.preco)}</Text>
                <Text style={[styles.price, styles.pricePromo]}>
                  {formatPrice(perfume.precoPromocional)}
                </Text>
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
          </View>
        </View>
      </PressableScale>
    </FadeUp>
  );
}

const styles = StyleSheet.create({
  // maxWidth evita que um card sozinho na última linha ocupe a largura toda.
  wrapper: { flex: 1, maxWidth: '48.6%' },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.09)',
    borderRadius: 18,
    overflow: 'hidden',
  },
  body: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  titleCol: { flex: 1 },
  brand: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.muted,
  },
  name: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 27,
    lineHeight: 30,
    color: colors.ink,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  price: { fontFamily: fonts.sansBold, fontSize: 19, color: colors.ink },
  priceOld: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  pricePromo: { color: colors.gold },
  offerBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: colors.gold,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  offerBadgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: '#ffffff',
  },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  stockText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted },
});
