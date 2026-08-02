import type {
  Familia,
  Genero,
  Intensidade,
  Ocasiao,
  Pendencia,
  ProdutoLocal,
} from '@/types/catalog';

/**
 * Regras do cadastro de produtos próprios da loja.
 *
 * Vive aqui, e não no store, porque é lógica de domínio pura — sem React, sem
 * AsyncStorage, sem rede. É o que permite testar de verdade a validação, a fila
 * de pendências e a regra de conflito entre aparelhos.
 */

/** Prefixo que separa o que nasceu no totem do que veio do Bling. */
export const PREFIXO_LOCAL = 'local:';

export function isProdutoLocal(id: string): boolean {
  return id.startsWith(PREFIXO_LOCAL);
}

/**
 * Id único sem depender de biblioteca de UUID: o par tempo + aleatório basta,
 * porque a chance de duas lojas gerarem o mesmo id no mesmo milissegundo é
 * irrelevante e o servidor trata id repetido como atualização.
 */
export function novoId(): string {
  return `${PREFIXO_LOCAL}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function novoOpId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Nome de arquivo seguro a partir do id.
 *
 * O `:` do prefixo `local:` é inválido em nome de arquivo no Windows — e o
 * servidor da loja roda em Windows. Trocar por `-` resolve; a lista branca de
 * caracteres também impede que um id forjado vire `../../algo` no servidor.
 */
export function nomeArquivoFoto(id: string): string {
  return `${id.replace(/[^a-zA-Z0-9]/g, '-')}.jpg`;
}

/** O que o formulário produz: tudo texto, porque vem de TextInput. */
export interface RascunhoProduto {
  nome: string;
  marca: string;
  preco: string;
  estoque: string;
  descricao: string;
  genero: Genero | null;
  familias: Familia[];
  ocasioes: Ocasiao[];
  intensidade: Intensidade | null;
  /** `file://` da foto já redimensionada e salva no aparelho. */
  fotoLocal: string | null;
}

export const RASCUNHO_VAZIO: RascunhoProduto = {
  nome: '',
  marca: '',
  preco: '',
  estoque: '',
  descricao: '',
  genero: null,
  familias: [],
  ocasioes: [],
  intensidade: null,
  fotoLocal: null,
};

/** Campo do formulário → mensagem, para destacar o campo culpado na tela. */
export type ErrosProduto = Partial<Record<'nome' | 'preco' | 'estoque', string>>;

/**
 * Aceita "199,90" e "199.90": num tablet de loja a vírgula é o que a equipe
 * digita, e recusar isso seria só teimosia.
 */
export function parsePreco(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '').replace(',', '.');
  if (!limpo) return null;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : null;
}

export function validarRascunho(rascunho: RascunhoProduto): ErrosProduto {
  const erros: ErrosProduto = {};

  if (rascunho.nome.trim().length < 2) {
    erros.nome = 'Informe o nome do produto.';
  }

  const preco = parsePreco(rascunho.preco);
  if (preco === null) {
    erros.preco = 'Informe o preço.';
  } else if (preco <= 0) {
    // Mesma regra da vitrine: "R$ 0" na tela é pior que o produto não aparecer.
    erros.preco = 'O preço precisa ser maior que zero.';
  }

  const estoque = parsePreco(rascunho.estoque);
  if (estoque === null) {
    erros.estoque = 'Informe o estoque.';
  } else if (!Number.isInteger(estoque) || estoque < 0) {
    erros.estoque = 'O estoque precisa ser um número inteiro.';
  }

  return erros;
}

export function temErro(erros: ErrosProduto): boolean {
  return Object.keys(erros).length > 0;
}

/**
 * Converte o rascunho validado em registro. `base` preenche id e criadoEm numa
 * edição; sem ela, nasce um produto novo.
 */
export function rascunhoParaProduto(
  rascunho: RascunhoProduto,
  base?: Pick<ProdutoLocal, 'id' | 'criadoEm' | 'fotoLocal' | 'fotoAtualizadaEm'>,
  agora: string = new Date().toISOString(),
): ProdutoLocal {
  const marca = rascunho.marca.trim();
  // Cada foto nova é salva num arquivo com carimbo de tempo no nome, então uma
  // troca de foto SEMPRE muda este caminho. É o que permite detectar a troca
  // por comparação simples — e evita que o cache de imagem, que é indexado por
  // URI, continue mostrando a foto antiga.
  const fotoTrocou = (base?.fotoLocal ?? null) !== rascunho.fotoLocal;
  return {
    id: base?.id ?? novoId(),
    nome: rascunho.nome.trim(),
    marca: marca || null,
    preco: Math.round((parsePreco(rascunho.preco) ?? 0) * 100) / 100,
    estoque: Math.trunc(parsePreco(rascunho.estoque) ?? 0),
    descricao: rascunho.descricao.trim(),
    genero: rascunho.genero,
    familias: rascunho.familias,
    ocasioes: rascunho.ocasioes,
    intensidade: rascunho.intensidade,
    fotoLocal: rascunho.fotoLocal,
    fotoAtualizadaEm: fotoTrocou
      ? (rascunho.fotoLocal ? agora : null)
      : (base?.fotoAtualizadaEm ?? null),
    criadoEm: base?.criadoEm ?? agora,
    atualizadoEm: agora,
  };
}

export function produtoParaRascunho(produto: ProdutoLocal): RascunhoProduto {
  return {
    nome: produto.nome,
    marca: produto.marca ?? '',
    // Vírgula na edição pelo mesmo motivo que a aceitamos na entrada.
    preco: String(produto.preco).replace('.', ','),
    estoque: String(produto.estoque),
    descricao: produto.descricao,
    genero: produto.genero,
    familias: produto.familias,
    ocasioes: produto.ocasioes,
    intensidade: produto.intensidade,
    fotoLocal: produto.fotoLocal,
  };
}

/**
 * Põe uma operação na fila descartando as anteriores do MESMO produto.
 *
 * Sem isso, editar o preço cinco vezes sem rede geraria cinco envios cujo
 * resultado final é o da última — só que gastando cinco viagens e criando
 * chance de aplicar as escritas fora de ordem. Como a regra de conflito é
 * "vence a mais recente", guardar apenas a última é equivalente e mais barato.
 */
export function enfileirar(fila: Pendencia[], pendencia: Pendencia): Pendencia[] {
  return [...fila.filter((p) => p.produtoId !== pendencia.produtoId), pendencia];
}

export function removerDaFila(fila: Pendencia[], opId: string): Pendencia[] {
  return fila.filter((p) => p.opId !== opId);
}

/**
 * Junta o que veio do servidor com o que está no aparelho.
 *
 * Duas regras, nesta ordem:
 *
 *   1. produto com operação na fila é intocável — o aparelho tem uma alteração
 *      que o servidor ainda não viu, e aceitar a versão dele apagaria justamente
 *      o trabalho que a fila existe para proteger;
 *   2. fora isso, vence o `atualizadoEm` mais recente.
 *
 * A regra 2 é a decisão de conflito escrita ANTES de precisar dela: dois totens
 * editando o mesmo produto convergem para a edição mais nova, e isso é fácil de
 * explicar para a equipe da loja.
 */
export function mesclarComServidor(
  locais: ProdutoLocal[],
  remotos: ProdutoLocal[],
  fila: Pendencia[],
): ProdutoLocal[] {
  const pendentes = new Set(fila.map((p) => p.produtoId));
  const porId = new Map<string, ProdutoLocal>();

  for (const p of locais) porId.set(p.id, p);

  for (const remoto of remotos) {
    if (pendentes.has(remoto.id)) continue;
    const local = porId.get(remoto.id);
    if (!local || remoto.atualizadoEm > local.atualizadoEm) {
      // O servidor não guarda `fotoLocal` — o caminho só vale no aparelho que
      // tirou a foto. Sem preservá-lo aqui, uma edição feita em outro totem
      // faria este perder a cópia offline e passar a depender da rede para
      // exibir uma foto que ele tem no próprio disco.
      const fotoLocal =
        local && local.fotoAtualizadaEm === remoto.fotoAtualizadaEm
          ? local.fotoLocal
          : null;
      porId.set(remoto.id, { ...remoto, fotoLocal });
    }
  }

  // Um produto que sumiu do servidor foi removido em outro totem — a menos que
  // seja justamente o que este aparelho ainda não conseguiu enviar.
  const idsRemotos = new Set(remotos.map((p) => p.id));
  for (const id of [...porId.keys()]) {
    if (!idsRemotos.has(id) && !pendentes.has(id)) porId.delete(id);
  }

  return [...porId.values()].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}
