import { normalizeBrand } from '@/logic/brands';
import { descricaoUtil } from '@/logic/format';
import type {
  CatalogProduct,
  EnrichmentEntry,
  Perfume,
  ProdutoLocal,
  TotemPayload,
} from '@/types/catalog';

/** Oferta da equipe só vale se for de fato menor que o preço cheio. */
function precoDeOferta(promocoes: Record<string, number>, id: string, preco: number): number | null {
  const promo = promocoes[id];
  return typeof promo === 'number' && promo > 0 && promo < preco ? promo : null;
}

/**
 * Produto cadastrado no totem já chega com o enriquecimento embutido, então
 * vira Perfume direto — não há enrichment.json para consultar.
 */
function localParaPerfume(p: ProdutoLocal, promocoes: Record<string, number>): Perfume {
  return {
    id: p.id,
    codigo: null,
    nome: p.nome,
    marca: normalizeBrand(p.marca),
    preco: p.preco,
    estoque: p.estoque,
    // A cópia no próprio aparelho, quando existe. Sem foto nenhuma, o
    // ProductImage cai no gradiente da família — nunca num quadrado quebrado.
    // Cadastrar produto no totem não exige subir imagem.
    imagem: p.fotoLocal,
    descricao: descricaoUtil(p.nome, p.descricao),
    fotoVersao: p.fotoAtualizadaEm,
    precoPromocional: precoDeOferta(promocoes, p.id, p.preco),
    genero: p.genero,
    familias: p.familias,
    ocasioes: p.ocasioes,
    intensidade: p.intensidade,
  };
}

/**
 * Regra de vitrine: transforma o payload cru (bundle, cache ou servidor) na
 * lista de perfumes que a tela mostra, aplicando curadoria e ofertas.
 *
 * Vive aqui, e não no `catalogStore`, porque é lógica de domínio pura — sem
 * React, sem AsyncStorage, sem rede. É o que permite testá-la de verdade.
 *
 * Os produtos cadastrados na loja entram na MESMA lista, e não numa seção
 * separada: para o cliente na frente do totem não existe "produto do Bling" e
 * "produto do tablet" — existe o que está à venda. Eles vêm primeiro por serem
 * o que a loja acabou de cadastrar.
 */
export function mergeCatalog(
  payload: TotemPayload,
  promocoes: Record<string, number>,
  locais: ProdutoLocal[] = [],
): Perfume[] {
  const entries = payload.enrichment ?? {};

  const doBling = (payload.produtos ?? [])
    .filter((p) => p.estoque > 0)
    // Preço zerado no Bling é cadastro incompleto — "R$ 0" na vitrine é pior
    // que o produto não aparecer.
    .filter((p) => p.preco > 0)
    .map((p: CatalogProduct) => {
      const entry: EnrichmentEntry = entries[p.id] ?? {};
      return {
        id: p.id,
        codigo: p.codigo ?? null,
        nome: p.nome,
        marca: normalizeBrand(p.marca),
        preco: p.preco,
        estoque: p.estoque,
        imagem: p.imagem ?? null,
        descricao: descricaoUtil(p.nome, p.descricao),
        fotoVersao: null,
        precoPromocional: precoDeOferta(promocoes, p.id, p.preco),
        genero: entry.genero ?? null,
        familias: entry.familias ?? [],
        ocasioes: entry.ocasioes ?? [],
        intensidade: entry.intensidade ?? null,
      };
    });

  // As mesmas duas regras de vitrine valem para o cadastro local: sem estoque
  // ou sem preço, o produto existe no cadastro mas não vai para a prateleira.
  const daLoja = locais
    .filter((p) => p.estoque > 0 && p.preco > 0)
    .map((p) => localParaPerfume(p, promocoes));

  return [...daLoja, ...doBling];
}
