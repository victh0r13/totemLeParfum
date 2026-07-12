import { PRICE_BUCKETS } from '@/config';
import type { Familia, Genero, Ocasiao, Perfume } from '@/types/catalog';

export interface CatalogFilters {
  familias: Familia[];
  genero: Genero | null;
  ocasiao: Ocasiao | null;
  priceBucket: number | null;
}

export const emptyFilters: CatalogFilters = {
  familias: [],
  genero: null,
  ocasiao: null,
  priceBucket: null,
};

export function hasActiveFilters(f: CatalogFilters): boolean {
  return f.familias.length > 0 || f.genero !== null || f.ocasiao !== null || f.priceBucket !== null;
}

/**
 * Filtros combináveis do catálogo. Produtos sem enriquecimento permanecem
 * visíveis sem filtros, mas saem do resultado quando um filtro de família,
 * gênero ou ocasião está ativo (nunca deduzimos esses dados).
 */
export function applyFilters(perfumes: Perfume[], f: CatalogFilters): Perfume[] {
  return perfumes.filter((p) => {
    if (f.familias.length > 0 && !f.familias.some((fam) => p.familias.includes(fam))) return false;
    if (f.genero !== null && p.genero !== f.genero) return false;
    if (f.ocasiao !== null && !p.ocasioes.includes(f.ocasiao)) return false;
    if (f.priceBucket !== null) {
      const bucket = PRICE_BUCKETS[f.priceBucket];
      if (!bucket) return false;
      if (p.preco < bucket.min || p.preco >= bucket.max) return false;
    }
    return true;
  });
}

/** Perfumes similares: mesma família olfativa, priorizando o mesmo gênero. */
export function similarTo(perfume: Perfume, all: Perfume[], limit = 4): Perfume[] {
  if (perfume.familias.length === 0) return [];
  const candidates = all.filter(
    (p) => p.id !== perfume.id && p.familias.some((f) => perfume.familias.includes(f)),
  );
  candidates.sort((a, b) => {
    const ag = a.genero === perfume.genero ? 1 : 0;
    const bg = b.genero === perfume.genero ? 1 : 0;
    return bg - ag;
  });
  return candidates.slice(0, limit);
}
