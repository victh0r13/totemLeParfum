import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CtaButton } from '@/components/CtaButton';
import { PerfumeCard } from '@/components/PerfumeCard';
import { TopBar } from '@/components/TopBar';
import { useCatalog } from '@/data/catalogStore';
import { colors, fonts } from '@/theme/theme';
import type { Perfume } from '@/types/catalog';

export default function QuizResultScreen() {
  const router = useRouter();
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const { perfumes } = useCatalog();

  const results = useMemo(() => {
    const wanted = (ids ?? '').split(',').filter(Boolean);
    return wanted
      .map((id) => perfumes.find((p) => p.id === id))
      .filter((p): p is Perfume => !!p);
  }, [ids, perfumes]);

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar title="Sua seleção" onBack={() => router.replace('/experience')} />

      <View style={styles.header}>
        <Text style={styles.eyebrow}>SELEÇÃO PARA VOCÊ</Text>
        <Text style={styles.title}>Encontramos estas fragrâncias</Text>
        <Text style={styles.subtitle}>
          Com base nas suas respostas, da maior para a menor afinidade.
        </Text>
      </View>

      {results.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            Ainda não temos sugestões suficientes para essas respostas
          </Text>
          <Text style={styles.emptySubtitle}>
            Explore o catálogo completo ou converse com nosso consultor virtual.
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <PerfumeCard
              perfume={item}
              delay={index * 90}
              onPress={() => router.push({ pathname: '/perfume/[id]', params: { id: item.id } })}
            />
          )}
        />
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
  header: { paddingHorizontal: 44, paddingTop: 36 },
  eyebrow: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 4,
    color: colors.gold,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 44,
    lineHeight: 50,
    color: colors.ink,
    marginTop: 12,
  },
  subtitle: { fontFamily: fonts.sans, fontSize: 16, color: colors.muted, marginTop: 10 },
  grid: { paddingHorizontal: 44, paddingTop: 28, paddingBottom: 20 },
  gridRow: { gap: 20, marginBottom: 20 },
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
