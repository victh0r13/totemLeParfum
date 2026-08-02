import { PRICE_BUCKETS } from '@/config';
import { effectivePrice } from '@/logic/format';
import type { Familia, Genero, Perfume } from '@/types/catalog';

export interface CatalogFilters {
  familias: Familia[];
  genero: Genero | null;
  priceBucket: number | null;
  /** Texto livre da lupa: casa com nome E marca. */
  busca: string;
}

export const emptyFilters: CatalogFilters = {
  familias: [],
  genero: null,
  priceBucket: null,
  busca: '',
};

export function hasActiveFilters(f: CatalogFilters): boolean {
  return (
    f.familias.length > 0 ||
    f.genero !== null ||
    f.priceBucket !== null ||
    f.busca.trim() !== ''
  );
}

/**
 * Texto comparável: sem acento, sem caixa, sem pontuação. O cliente digita
 * "lattafa" ou "HAYAATI" no teclado do tablet e precisa achar do mesmo jeito.
 */
function comparavel(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Busca por nome e marca. Cada palavra digitada precisa aparecer em algum
 * lugar — "lattafa haya" acha "Haya - Lattafa Eau de Parfum" mesmo com a
 * ordem trocada, que é como as pessoas realmente digitam.
 */
export function matchesSearch(p: Perfume, termo: string): boolean {
  const busca = comparavel(termo);
  if (!busca) return true;
  const alvo = comparavel(`${p.nome} ${p.marca ?? ''}`);
  return busca.split(' ').every((palavra) => alvo.includes(palavra));
}

/**
 * Filtros combináveis do catálogo. Um produto sem família/gênero registrado
 * na curadoria continua visível na listagem completa, mas sai do resultado
 * quando o filtro correspondente está ativo — nunca deduzimos o dado aqui.
 */
export function applyFilters(perfumes: Perfume[], f: CatalogFilters): Perfume[] {
  return perfumes.filter((p) => {
    if (f.familias.length > 0 && !f.familias.some((fam) => p.familias.includes(fam))) return false;
    if (f.genero !== null && p.genero !== f.genero) return false;
    if (!matchesSearch(p, f.busca)) return false;
    if (f.priceBucket !== null) {
      const bucket = PRICE_BUCKETS[f.priceBucket];
      if (!bucket) return false;
      // Em oferta, vale o preço promocional (ex.: filtro "Até R$ 250").
      const preco = effectivePrice(p);
      if (preco < bucket.min || preco >= bucket.max) return false;
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
