import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/Chip';
import { CtaButton } from '@/components/CtaButton';
import { PerfumeCard } from '@/components/PerfumeCard';
import { TopBar } from '@/components/TopBar';
import { PRICE_BUCKETS } from '@/config';
import { useCatalog } from '@/data/catalogStore';
import { applyFilters, emptyFilters, hasActiveFilters, type CatalogFilters } from '@/logic/filters';
import { colors, familyLabels, fonts } from '@/theme/theme';
import type { Familia, Genero, Ocasiao, Perfume } from '@/types/catalog';

const FAMILIES = Object.keys(familyLabels) as Familia[];
const GENDERS: { key: Genero; label: string }[] = [
  { key: 'F', label: 'Feminino' },
  { key: 'M', label: 'Masculino' },
  { key: 'U', label: 'Unissex' },
];
const OCCASIONS: { key: Ocasiao; label: string }[] = [
  { key: 'trabalho', label: 'Trabalho' },
  { key: 'dia', label: 'Dia a dia' },
  { key: 'noite', label: 'Noite & eventos' },
  { key: 'esporte', label: 'Esporte' },
];

/** Linha compacta de filtro: rótulo fixo à esquerda, chips deslizando na horizontal. */
function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChips}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export default function CatalogScreen() {
  const router = useRouter();
  const { perfumes } = useCatalog();
  const [filters, setFilters] = useState<CatalogFilters>(emptyFilters);

  const results = useMemo(() => applyFilters(perfumes, filters), [perfumes, filters]);
  const active = hasActiveFilters(filters);

  const toggleFamily = (f: Familia) =>
    setFilters((prev) => ({
      ...prev,
      familias: prev.familias.includes(f)
        ? prev.familias.filter((x) => x !== f)
        : [...prev.familias, f],
    }));

  const renderCard = ({ item, index }: { item: Perfume; index: number }) => (
    <PerfumeCard
      perfume={item}
      delay={Math.min(index, 6) * 60}
      onPress={() => router.push({ pathname: '/perfume/[id]', params: { id: item.id } })}
    />
  );

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar title="Catálogo" onBack={() => router.replace('/')} />

      <View style={styles.filters}>
        <FilterRow label="FAMÍLIA">
          {FAMILIES.map((f) => (
            <Chip
              key={f}
              size="sm"
              label={familyLabels[f]}
              selected={filters.familias.includes(f)}
              onPress={() => toggleFamily(f)}
            />
          ))}
        </FilterRow>

        <FilterRow label="GÊNERO">
          {GENDERS.map((g) => (
            <Chip
              key={g.key}
              size="sm"
              label={g.label}
              selected={filters.genero === g.key}
              onPress={() =>
                setFilters((prev) => ({
                  ...prev,
                  genero: prev.genero === g.key ? null : g.key,
                }))
              }
            />
          ))}
        </FilterRow>

        <FilterRow label="OCASIÃO">
          {OCCASIONS.map((o) => (
            <Chip
              key={o.key}
              size="sm"
              label={o.label}
              selected={filters.ocasiao === o.key}
              onPress={() =>
                setFilters((prev) => ({
                  ...prev,
                  ocasiao: prev.ocasiao === o.key ? null : o.key,
                }))
              }
            />
          ))}
        </FilterRow>

        <FilterRow label="PREÇO">
          {PRICE_BUCKETS.map((b) => (
            <Chip
              key={b.key}
              size="sm"
              label={b.label}
              selected={filters.priceBucket === b.key}
              onPress={() =>
                setFilters((prev) => ({
                  ...prev,
                  priceBucket: prev.priceBucket === b.key ? null : b.key,
                }))
              }
            />
          ))}
        </FilterRow>
      </View>

      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {results.length === 1 ? '1 perfume encontrado' : `${results.length} perfumes encontrados`}
        </Text>
        {active && (
          <Pressable onPress={() => setFilters(emptyFilters)} hitSlop={12}>
            <Text style={styles.clearText}>Limpar filtros ✕</Text>
          </Pressable>
        )}
      </View>

      {results.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nenhum perfume com esses filtros</Text>
          <Text style={styles.emptySubtitle}>
            Experimente remover algum filtro para ver mais opções.
          </Text>
          <CtaButton
            label="Limpar filtros"
            variant="secondary"
            onPress={() => setFilters(emptyFilters)}
            style={styles.emptyButton}
          />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  filters: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filterLabel: {
    width: 74,
    fontFamily: fonts.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    color: colors.muted,
  },
  filterChips: { flexDirection: 'row', gap: 8, paddingRight: 12 },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  countText: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink },
  clearText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    letterSpacing: 0.8,
    color: colors.gold,
  },
  grid: { paddingHorizontal: 28, paddingBottom: 40 },
  gridRow: { gap: 20, marginBottom: 20 },
  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 40 },
  emptyTitle: {
    fontFamily: fonts.serif,
    fontSize: 32,
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
  emptyButton: { marginTop: 26, alignSelf: 'center', paddingHorizontal: 44 },
});
