import { marcaPeloNome, normalizeBrand } from '@/logic/brands';
import { descricaoUtil, nomeVitrine } from '@/logic/format';
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
    tipo: p.tipo ?? 'perfume',
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
 * O payload `a` foi gerado depois de `b`? Data ilegível conta como antiga —
 * na dúvida, fica o catálogo empacotado, que sempre está íntegro.
 */
export function maisRecente(a: TotemPayload, b: TotemPayload): boolean {
  const ta = Date.parse(a.generatedAt);
  const tb = Date.parse(b.generatedAt);
  if (Number.isNaN(ta)) return false;
  if (Number.isNaN(tb)) return true;
  return ta >= tb;
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
        nome: nomeVitrine(p.nome),
        // Entrada antiga, de quando a curadoria só tinha perfume.
        tipo: entry.tipo ?? 'perfume',
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

  // Variação do Bling chega sem marca: empresta a de um irmão pelo nome, para
  // ela aparecer na navegação por marca e no "Combina com".
  const marcas = new Set(
    [...daLoja, ...doBling].map((p) => p.marca).filter((m): m is string => m !== null),
  );
  for (const p of doBling) {
    if (p.marca === null) p.marca = marcaPeloNome(p.nome, marcas);
  }

  return [...daLoja, ...doBling];
}

/**
 * Aplica no payload o preço e o estoque que vieram do Bling — a mesma regra do
 * `sync/src/quick.js`: preço só muda se vier maior que zero (zero é cadastro
 * incompleto) e produto ausente da resposta fica como estava.
 *
 * `generatedAt` vira o momento da conferência mesmo sem mudança: é a data que o
 * painel mostra como "preços e estoque de".
 */
export function atualizarPrecoEstoque(
  payload: TotemPayload,
  precos: Map<string, number>,
  estoques: Map<string, number>,
  agora: string,
): { payload: TotemPayload; mudancas: number } {
  let mudancas = 0;
  const produtos = (payload.produtos ?? []).map((p) => {
    const preco = precos.get(p.id);
    const estoque = estoques.get(p.id);
    const novoPreco = preco !== undefined && preco > 0 ? preco : p.preco;
    const novoEstoque = estoque ?? p.estoque;
    if (novoPreco === p.preco && novoEstoque === p.estoque) return p;
    mudancas++;
    return { ...p, preco: novoPreco, estoque: novoEstoque };
  });
  return { payload: { ...payload, produtos, generatedAt: agora }, mudancas };
}
