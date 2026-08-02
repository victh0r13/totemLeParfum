import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { ProductImage } from '@/components/ProductImage';
import { formatPrice } from '@/logic/format';
import { colors, fonts } from '@/theme/theme';
import type { Perfume } from '@/types/catalog';

interface Props {
  perfume: Perfume;
  onPress: () => void;
  width?: number;
  showBrand?: boolean;
}

/** Card compacto: perfumes similares na tela de detalhe. */
export function MiniCard({ perfume, onPress, width = 180, showBrand = false }: Props) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.96} style={[styles.card, { width }]}>
      <ProductImage perfume={perfume} height={116} bottle="sm" />
      <View style={styles.body}>
        {showBrand && !!perfume.marca && (
          <Text style={styles.brand} numberOfLines={1}>
            {perfume.marca.toUpperCase()}
          </Text>
        )}
        <Text style={styles.name} numberOfLines={2}>
          {perfume.nome}
        </Text>
        {perfume.precoPromocional !== null ? (
          <View style={styles.priceRow}>
            <Text style={[styles.price, styles.pricePromo]}>
              {formatPrice(perfume.precoPromocional)}
            </Text>
            <Text style={styles.priceOld}>{formatPrice(perfume.preco)}</Text>
          </View>
        ) : (
          <Text style={styles.price}>{formatPrice(perfume.preco)}</Text>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.1)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  body: { paddingHorizontal: 14, paddingVertical: 12 },
  brand: { fontFamily: fonts.sans, fontSize: 10, letterSpacing: 1.6, color: colors.muted },
  name: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 19,
    lineHeight: 22,
    color: colors.ink,
    marginTop: 3,
  },
  price: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.inkSoft, marginTop: 5 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  pricePromo: { color: colors.gold },
  priceOld: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
});
