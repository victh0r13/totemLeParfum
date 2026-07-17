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
  marca: string;
  preco: number;
  estoque: number;
  imagem: string | null;
  descricao: string;
  /** Preço de oferta definido pela equipe no totem (menor que `preco`). */
  precoPromocional: number | null;
  /** true quando existe entrada no enrichment.json */
  enriquecido: boolean;
  genero: Genero | null;
  familias: Familia[];
  ocasioes: Ocasiao[];
  intensidade: Intensidade | null;
}

export interface QuizAnswers {
  quem: 'mim' | 'presente' | null;
  ocasiao: Ocasiao | null;
  intensidade: Intensidade | null;
  familias: Familia[];
  estilo: 'classico' | 'moderno' | 'natural' | null;
}
