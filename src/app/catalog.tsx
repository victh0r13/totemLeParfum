import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/Chip';
import { CtaButton } from '@/components/CtaButton';
import { PerfumeCard } from '@/components/PerfumeCard';
import { PressableScale } from '@/components/PressableScale';
import { SearchIcon } from '@/components/SearchIcon';
import { TopBar } from '@/components/TopBar';
import { PRICE_BUCKETS } from '@/config';
import { useCatalog } from '@/data/catalogStore';
import { applyFilters, emptyFilters, hasActiveFilters, type CatalogFilters } from '@/logic/filters';
import { colors, familyLabels, fonts } from '@/theme/theme';
import type { Familia, Genero, Perfume } from '@/types/catalog';

const FAMILIES = Object.keys(familyLabels) as Familia[];
const GENDERS: { key: Genero; label: string }[] = [
  { key: 'F', label: 'Feminino' },
  { key: 'M', label: 'Masculino' },
  { key: 'U', label: 'Unissex' },
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
  const [buscaAberta, setBuscaAberta] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const results = useMemo(() => applyFilters(perfumes, filters), [perfumes, filters]);
  const active = hasActiveFilters(filters);

  const toggleFamily = (f: Familia) =>
    setFilters((prev) => ({
      ...prev,
      familias: prev.familias.includes(f)
        ? prev.familias.filter((x) => x !== f)
        : [...prev.familias, f],
    }));

  const fecharBusca = () => {
    setBuscaAberta(false);
    setFilters((prev) => ({ ...prev, busca: '' }));
  };

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

      {buscaAberta ? (
        <View style={styles.buscaRow}>
          <SearchIcon size={22} color={colors.gold} />
          <TextInput
            ref={inputRef}
            style={styles.buscaInput}
            value={filters.busca}
            onChangeText={(t) => setFilters((prev) => ({ ...prev, busca: t }))}
            placeholder="Nome do perfume ou marca"
            placeholderTextColor={colors.muted}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            // Sem sugestão automática: nome de perfume não está no dicionário.
            autoCapitalize="none"
          />
          <PressableScale scaleTo={0.9} onPress={fecharBusca} style={styles.buscaFechar}>
            <Text style={styles.buscaFecharLabel}>✕</Text>
          </PressableScale>
        </View>
      ) : (
        <View style={styles.countRow}>
          <PressableScale
            scaleTo={0.92}
            onPress={() => setBuscaAberta(true)}
            style={styles.lupa}
          >
            <SearchIcon size={20} />
          </PressableScale>

          <Text style={styles.countText}>
            {results.length === 1 ? '1 perfume encontrado' : `${results.length} perfumes encontrados`}
          </Text>

          {active && (
            <Pressable onPress={() => setFilters(emptyFilters)} hitSlop={12}>
              <Text style={styles.clearText}>Limpar filtros ✕</Text>
            </Pressable>
          )}
        </View>
      )}

      {results.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {filters.busca.trim()
              ? `Nada encontrado para “${filters.busca.trim()}”`
              : 'Nenhum perfume com esses filtros'}
          </Text>
          <Text style={styles.emptySubtitle}>
            Experimente outro termo ou remova algum filtro para ver mais opções.
          </Text>
          <CtaButton
            label="Limpar tudo"
            variant="secondary"
            onPress={() => {
              setFilters(emptyFilters);
              setBuscaAberta(false);
            }}
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
          keyboardShouldPersistTaps="handled"
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
    gap: 14,
    paddingHorizontal: 28,
    paddingVertical: 11,
  },
  lupa: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.16)',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { flex: 1, fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink },
  clearText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    letterSpacing: 0.8,
    color: colors.gold,
  },
  buscaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 28,
    marginVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.surface,
  },
  buscaInput: {
    flex: 1,
    height: 52,
    fontFamily: fonts.sans,
    fontSize: 17,
    color: colors.ink,
    // O outline padrão do input na web quebra a borda arredondada.
    outlineStyle: 'none',
  } as object,
  buscaFechar: { padding: 6 },
  buscaFecharLabel: { fontSize: 18, color: colors.muted },
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
