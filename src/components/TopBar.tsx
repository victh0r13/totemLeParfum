import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { colors, fonts } from '@/theme/theme';

interface Props {
  title: string;
  onBack?: () => void;
}

/** Barra superior com botão de voltar circular e título em caixa alta. */
export function TopBar({ title, onBack }: Props) {
  const router = useRouter();
  return (
    <View style={styles.bar}>
      <PressableScale
        scaleTo={0.92}
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        style={styles.backButton}
      >
        <Text style={styles.backArrow}>←</Text>
      </PressableScale>
      <Text style={styles.title} numberOfLines={1}>
        {title.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingLeft: 24,
    paddingRight: 150,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  backButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.16)',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { fontSize: 20, color: colors.ink },
  title: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 3,
    color: colors.muted,
  },
});
