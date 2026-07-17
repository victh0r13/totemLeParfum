import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { NumericPad } from '@/components/NumericPad';
import { PressableScale } from '@/components/PressableScale';
import { ADMIN_PIN } from '@/config';
import { colors, fonts } from '@/theme/theme';

interface Props {
  visible: boolean;
  /** Contexto exibido acima dos pontos, ex.: "Editar oferta". */
  title?: string;
  onClose: () => void;
  onSuccess: () => void;
}

/** Trava de PIN da equipe para as áreas administrativas do totem. */
export function PinModal({ visible, title = 'Área da equipe', onClose, onSuccess }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!visible) {
      setPin('');
      setError(false);
    }
  }, [visible]);

  useEffect(() => {
    if (pin.length < 4) return;
    if (pin === ADMIN_PIN) {
      setPin('');
      onSuccess();
    } else {
      setError(true);
      setPin('');
    }
  }, [pin, onSuccess]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>{title.toUpperCase()}</Text>
          <Text style={styles.title}>Digite o PIN</Text>

          <View style={styles.dots}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.dot, i < pin.length && styles.dotOn]} />
            ))}
          </View>
          <Text style={[styles.error, !error && { opacity: 0 }]}>PIN incorreto — tente novamente</Text>

          <NumericPad
            onKey={(d) => {
              setError(false);
              setPin((p) => (p.length < 4 ? p + d : p));
            }}
            onBackspace={() => setPin((p) => p.slice(0, -1))}
          />

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
    width: 380,
    maxWidth: '100%',
    backgroundColor: colors.bg,
    borderRadius: 24,
    padding: 28,
  },
  eyebrow: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 3,
    color: colors.gold,
    textAlign: 'center',
  },
  title: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 30,
    color: colors.ink,
    textAlign: 'center',
    marginTop: 8,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 20,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(33,29,24,0.3)',
    backgroundColor: 'transparent',
  },
  dotOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  error: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: '#a4433a',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  cancel: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  cancelLabel: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.muted },
});
