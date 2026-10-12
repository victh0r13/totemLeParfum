import { PRICE_BUCKETS } from '@/config';
import { effectivePrice } from '@/logic/format';
import type { Familia, Genero, Perfume, TipoProduto } from '@/types/catalog';

export interface CatalogFilters {
  /** Prateleira escolhida (null = tudo). É navegação, não filtro: "Limpar" não mexe nela. */
  tipo: TipoProduto | null;
  /** Marca escolhida na tela inicial (null = todas). */
  marca: string | null;
  familias: Familia[];
  genero: Genero | null;
  priceBucket: number | null;
  /** Texto livre da lupa: casa com nome E marca. */
  busca: string;
}

export const emptyFilters: CatalogFilters = {
  tipo: null,
  marca: null,
  familias: [],
  genero: null,
  priceBucket: null,
  busca: '',
};

export function hasActiveFilters(f: CatalogFilters): boolean {
  return (
    f.marca !== null ||
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
 *
 * Famílias combinam com E: "amadeirado + doce" traz o amadeirado adocicado,
 * não a soma das duas prateleiras. É o que o cliente quer dizer ao marcar as
 * duas. O preço é o resultado curto — a curadoria dá no máximo 2 famílias por
 * perfume, então qualquer par fora do que está cadastrado devolve zero.
 */
export function applyFilters(perfumes: Perfume[], f: CatalogFilters): Perfume[] {
  return perfumes.filter((p) => {
    if (f.tipo !== null && p.tipo !== f.tipo) return false;
    if (f.marca !== null && p.marca !== f.marca) return false;
    if (f.familias.length > 0 && !f.familias.every((fam) => p.familias.includes(fam))) return false;
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

/** Quantos produtos há em cada prateleira — as abas vazias nem aparecem. */
export function contarPorTipo(perfumes: Perfume[]): Record<TipoProduto, number> {
  const contagem: Record<TipoProduto, number> = { perfume: 0, 'body-splash': 0, corpo: 0, kit: 0 };
  for (const p of perfumes) contagem[p.tipo]++;
  return contagem;
}

/** Marcas com quantos produtos cada, da maior para a menor. */
export function marcasPorContagem(perfumes: Perfume[]): { marca: string; total: number }[] {
  const contagem = new Map<string, number>();
  for (const p of perfumes) {
    if (p.marca) contagem.set(p.marca, (contagem.get(p.marca) ?? 0) + 1);
  }
  return [...contagem]
    .map(([marca, total]) => ({ marca, total }))
    .sort((a, b) => b.total - a.total || a.marca.localeCompare(b.marca));
}

/**
 * Similares: mesmo tipo e mesma família olfativa, priorizando o mesmo gênero.
 * Quem olha um perfume quer comparar com perfume, não com hidratante.
 */
export function similarTo(perfume: Perfume, all: Perfume[], limit = 4): Perfume[] {
  if (perfume.familias.length === 0) return [];
  const candidates = all.filter(
    (p) =>
      p.id !== perfume.id &&
      p.tipo === perfume.tipo &&
      p.familias.some((f) => perfume.familias.includes(f)),
  );
  candidates.sort((a, b) => {
    const ag = a.genero === perfume.genero ? 1 : 0;
    const bg = b.genero === perfume.genero ? 1 : 0;
    return bg - ag;
  });
  return candidates.slice(0, limit);
}

/**
 * Palavras que dizem o TIPO ou a embalagem, não a linha: "Body Splash Kiss Me
 * More" e "Hidratante Kiss Me More" são da mesma linha por causa de "kiss" e
 * "more", não por causa de "body".
 */
const PALAVRAS_GENERICAS = new Set([
  'body', 'splash', 'mist', 'spray', 'hidratante', 'corporal', 'locao', 'creme', 'perfume',
  'colonia', 'lata', 'original', 'feminino', 'masculino', 'cosmeticos', 'conjunto',
  'fragancia', 'fragrancia', 'volume', 'parfum', 'toilette', 'escolha', 'variacao', 'unissex',
]);

function palavrasDaLinha(nome: string): Set<string> {
  return new Set(
    comparavel(nome)
      .split(' ')
      // Palavras curtas e medidas ("de", "200ml") não dizem nada sobre a linha.
      .filter((w) => w.length >= 4 && !/\d/.test(w) && !PALAVRAS_GENERICAS.has(w)),
  );
}

/**
 * "Combina com": produtos de OUTRO tipo para completar o ritual — o body splash
 * ou o hidratante que acompanham o perfume. A mesma linha (palavras do nome em
 * comum) vem antes, depois a mesma marca e, por fim, a mesma família olfativa.
 *
 * A linha conta mesmo sem marca: as variações do Bling ("Body Splash (Conjunto)
 * Fragância:Kiss me More") chegam sem marca nenhuma.
 */
export function combinaCom(produto: Perfume, all: Perfume[], limit = 4): Perfume[] {
  const minhas = palavrasDaLinha(produto.nome);
  const marca = produto.marca ? comparavel(produto.marca) : null;

  const pontuados: { p: Perfume; pontos: number }[] = [];
  for (const p of all) {
    if (p.id === produto.id || p.tipo === produto.tipo) continue;
    const mesmaMarca = marca !== null && p.marca !== null && comparavel(p.marca) === marca;
    let emComum = 0;
    for (const w of palavrasDaLinha(p.nome)) {
      if (minhas.has(w) && !(marca ?? '').split(' ').includes(w)) emComum++;
    }
    // Só a família em comum é pouco: sem marca nem linha, não é "combina", é sorteio.
    // Uma palavra só, sem a marca para confirmar, também é coincidência demais.
    if (!mesmaMarca && emComum < 2) continue;
    let pontos = emComum * 3 + (mesmaMarca ? 2 : 0);
    if (p.familias.some((f) => produto.familias.includes(f))) pontos += 1;
    if (produto.genero && p.genero === produto.genero) pontos += 1;
    pontuados.push({ p, pontos });
  }
  pontuados.sort((a, b) => b.pontos - a.pontos || a.p.preco - b.p.preco);
  return pontuados.slice(0, limit).map(({ p }) => p);
}
