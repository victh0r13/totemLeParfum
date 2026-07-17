import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { CtaButton } from '@/components/CtaButton';
import { NumericPad } from '@/components/NumericPad';
import { PressableScale } from '@/components/PressableScale';
import { useToast } from '@/components/ToastProvider';
import { usePromotions } from '@/data/promotionsStore';
import { formatPrice } from '@/logic/format';
import { colors, fonts } from '@/theme/theme';
import type { Perfume } from '@/types/catalog';

interface Props {
  visible: boolean;
  perfume: Perfume;
  onClose: () => void;
}

function parsePrice(text: string): number | null {
  if (!text) return null;
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/** Editor do preço de oferta (aberto somente após o PIN da equipe). */
export function PromoModal({ visible, perfume, onClose }: Props) {
  const { setPromocao } = usePromotions();
  const { showToast } = useToast();
  const [text, setText] = useState('');

  useEffect(() => {
    if (!visible) setText('');
  }, [visible]);

  const parsed = useMemo(() => parsePrice(text), [text]);
  const valido = parsed !== null && parsed > 0 && parsed < perfume.preco;

  const digit = (d: string) => {
    setText((t) => {
      if (d === ',' && (t.includes(',') || t.length === 0)) return t;
      const [, decimais] = t.split(',');
      if (decimais !== undefined && decimais.length >= 2) return t;
      if (t.replace(',', '').length >= 6) return t;
      return t + d;
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>OFERTA</Text>
          <Text style={styles.title} numberOfLines={2}>
            {perfume.nome}
          </Text>
          <Text style={styles.current}>
            Preço normal: {formatPrice(perfume.preco)}
            {perfume.precoPromocional !== null &&
              `   ·   Oferta atual: ${formatPrice(perfume.precoPromocional)}`}
          </Text>

          <View style={styles.display}>
            <Text style={styles.displayCurrency}>R$</Text>
            <Text style={[styles.displayValue, !text && styles.displayPlaceholder]}>
              {text || '0,00'}
            </Text>
          </View>
          <Text style={[styles.hint, (valido || !text) && { opacity: 0 }]}>
            A oferta precisa ser menor que {formatPrice(perfume.preco)}
          </Text>

          <NumericPad showComma onKey={digit} onBackspace={() => setText((t) => t.slice(0, -1))} />

          <View style={styles.actions}>
            <CtaButton
              label="Salvar oferta"
              disabled={!valido}
              style={styles.action}
              onPress={() => {
                if (parsed === null) return;
                setPromocao(perfume.id, parsed);
                showToast(`Oferta ativada: ${formatPrice(parsed)}`);
                onClose();
              }}
            />
            {perfume.precoPromocional !== null && (
              <CtaButton
                label="Remover oferta"
                variant="secondary"
                style={styles.action}
                onPress={() => {
                  setPromocao(perfume.id, null);
                  showToast('Oferta removida.');
                  onClose();
                }}
              />
            )}
          </View>

          <PressableScale scaleTo={0.96} onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelLabel}>Cancelar</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(33,29,24,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: 420,
    maxWidth: '100%',
    backgroundColor: colors.bg,
    borderRadius: 24,
    padding: 28,
  },
  eyebrow: { fontFamily: fonts.sansSemiBold, fontSize: 12, letterSpacing: 3, color: colors.gold },
  title: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 26,
    lineHeight: 31,
    color: colors.ink,
    marginTop: 8,
  },
  current: { fontFamily: fonts.sans, fontSize: 14, color: colors.muted, marginTop: 8 },
  display: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.16)',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 18,
  },
  displayCurrency: { fontFamily: fonts.sansSemiBold, fontSize: 18, color: colors.muted },
  displayValue: { fontFamily: fonts.sansBold, fontSize: 32, color: colors.ink },
  displayPlaceholder: { color: 'rgba(33,29,24,0.25)' },
  hint: { fontFamily: fonts.sans, fontSize: 13, color: '#a4433a', marginTop: 8, marginBottom: 12 },
  actions: { gap: 10, marginTop: 6 },
  action: { width: '100%' },
  cancel: { alignItems: 'center', paddingVertical: 14, marginTop: 6 },
  cancelLabel: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.muted },
});
