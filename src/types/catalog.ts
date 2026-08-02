export type Familia = 'floral' | 'citrico' | 'amadeirado' | 'doce' | 'oriental' | 'fresco';
export type Ocasiao = 'trabalho' | 'dia' | 'noite' | 'esporte';
export type Genero = 'F' | 'M' | 'U';
export type Intensidade = 1 | 2 | 3;

/** Produto como vem do catalog.json gerado pelo sync do Bling. */
export interface CatalogProduct {
  id: string;
  codigo?: string | null;
  nome: string;
  marca?: string | null;
  preco: number;
  estoque: number;
  imagem?: string | null;
  descricao?: string | null;
}

export interface CatalogFile {
  generatedAt: string;
  source: string;
  produtos: CatalogProduct[];
}

/**
 * O que o totem consome: a curadoria já recortada (produtos com estoque e
 * entrada no enrichment) junto do enriquecimento correspondente.
 *
 * Bundle do APK, cache do aparelho e resposta do servidor usam exatamente
 * este formato — é o que permite as três origens serem intercambiáveis.
 */
export interface TotemPayload {
  generatedAt: string;
  source: string;
  produtos: CatalogProduct[];
  enrichment: Record<string, EnrichmentEntry>;
}

/** Entrada manual em data/enrichment.json (chave = id do Bling ou SKU). */
export interface EnrichmentEntry {
  /** Nome do produto, somente para leitura humana ao editar o JSON — o app ignora. */
  nome?: string;
  genero?: Genero;
  familias?: Familia[];
  ocasioes?: Ocasiao[];
  intensidade?: Intensidade;
}

export interface EnrichmentFile {
  produtos: Record<string, EnrichmentEntry>;
}

/** Produto do catálogo já combinado com o enriquecimento manual. */
export interface Perfume {
  id: string;
  codigo: string | null;
  nome: string;
  /** Marca normalizada; null quando o Bling não tem marca cadastrada. */
  marca: string | null;
  preco: number;
  estoque: number;
  imagem: string | null;
  descricao: string;
  /**
   * Versão da foto, usada como cache-buster na URL do servidor. Só produtos
   * cadastrados na loja preenchem — os do Bling ficam null e nada muda.
   */
  fotoVersao: string | null;
  /** Preço de oferta definido pela equipe no totem (menor que `preco`). */
  precoPromocional: number | null;
  genero: Genero | null;
  familias: Familia[];
  ocasioes: Ocasiao[];
  intensidade: Intensidade | null;
}

/**
 * Produto cadastrado pela equipe no próprio totem, sem passar pelo Bling.
 *
 * Convive com o catálogo do ERP em vez de competir com ele: o id sempre tem o
 * prefixo `local:`, então nunca colide com um id do Bling, e o registro carrega
 * o enriquecimento embutido — não existe entrada em enrichment.json para um
 * produto que nasce aqui.
 */
export interface ProdutoLocal {
  id: string;
  nome: string;
  marca: string | null;
  preco: number;
  estoque: number;
  descricao: string;
  genero: Genero | null;
  familias: Familia[];
  ocasioes: Ocasiao[];
  intensidade: Intensidade | null;
  /**
   * `file://` da cópia da foto no próprio aparelho. Existe apenas no totem que
   * tirou a foto — o servidor descarta este campo, porque o caminho não faz
   * sentido nenhum em outro tablet.
   */
  fotoLocal: string | null;
  /**
   * Quando a foto foi definida; `null` significa produto sem foto.
   *
   * Faz dois trabalhos: avisa os outros totens que existe foto no servidor e
   * serve de "versão" na URL, para uma foto trocada não ficar presa no cache.
   */
  fotoAtualizadaEm: string | null;
  criadoEm: string;
  /** Carimbo da última edição — é ele que resolve o conflito entre aparelhos. */
  atualizadoEm: string;
}

/**
 * Uma escrita esperando para subir ao servidor da loja.
 *
 * O cadastro grava no aparelho e devolve o controle na hora; esta fila é o que
 * garante que a alteração feita sem rede não se perca. Enquanto houver item
 * aqui, o painel mostra "N alterações pendentes".
 */
export interface Pendencia {
  /** Identifica a operação para o envio ser idempotente em caso de reenvio. */
  opId: string;
  tipo: 'salvar' | 'remover';
  produtoId: string;
  /** Presente somente em 'salvar'. */
  produto?: ProdutoLocal;
  /**
   * `file://` da foto que ainda precisa subir junto deste produto.
   *
   * Guardamos o caminho, e não os bytes: a fila mora no AsyncStorage, que é um
   * SQLite com poucos MB de limite — meia dúzia de fotos em base64 ali dentro
   * estouraria o banco e levaria junto o catálogo em cache. Os bytes só são
   * lidos do disco na hora do envio.
   */
  fotoParaEnviar?: string;
  criadoEm: string;
}

export interface QuizAnswers {
  quem: 'mim' | 'presente' | null;
  /** null = "tanto faz": o resultado não é restrito por gênero. */
  genero: Genero | null;
  ocasiao: Ocasiao | null;
  intensidade: Intensidade | null;
  familias: Familia[];
  estilo: 'classico' | 'moderno' | 'natural' | null;
}
