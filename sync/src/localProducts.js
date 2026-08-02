import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';

import { LOCAL_PHOTOS_DIR, LOCAL_PRODUCTS_PATH } from './env.js';

/**
 * Produtos cadastrados pela equipe nos totens, fora do Bling.
 *
 * O arquivo é a fonte da verdade compartilhada entre os tablets: cada um envia
 * o que criou e lê o que os outros criaram. É deliberadamente um JSON, e não um
 * banco: o volume é de dezenas de registros, e um arquivo observável pelo
 * `fs.watch` já dispara o aviso de tempo real que os totens escutam.
 *
 * Formato:
 * ```
 * { produtos: { [id]: ProdutoLocal }, removidos: { [id]: ISO }, atualizadoEm }
 * ```
 *
 * `removidos` é uma lápide: sem ela, um totem que ficou uma semana sem rede
 * subiria de volta um produto que a loja já apagou, porque para ele aquela
 * escrita ainda está pendente.
 */

const VAZIO = { produtos: {}, removidos: {}, atualizadoEm: null };

export function lerProdutosLocais() {
  try {
    const dados = JSON.parse(fs.readFileSync(LOCAL_PRODUCTS_PATH, 'utf8'));
    return {
      produtos: dados.produtos ?? {},
      removidos: dados.removidos ?? {},
      atualizadoEm: dados.atualizadoEm ?? null,
    };
  } catch {
    return { ...VAZIO };
  }
}

/**
 * Grava em arquivo temporário e renomeia: se o processo morrer no meio da
 * escrita, o arquivo antigo continua íntegro em vez de virar JSON truncado.
 */
function gravar(dados) {
  const conteudo = JSON.stringify({ ...dados, atualizadoEm: new Date().toISOString() }, null, 2);
  fs.mkdirSync(path.dirname(LOCAL_PRODUCTS_PATH), { recursive: true });
  const temporario = `${LOCAL_PRODUCTS_PATH}.tmp`;
  fs.writeFileSync(temporario, conteudo);
  fs.renameSync(temporario, LOCAL_PRODUCTS_PATH);
}

const TEXTO = (v) => (typeof v === 'string' ? v.trim() : '');
const LISTA = (v, validos) =>
  Array.isArray(v) ? [...new Set(v.filter((i) => validos.includes(i)))] : [];

const FAMILIAS = ['floral', 'citrico', 'amadeirado', 'doce', 'oriental', 'fresco'];
const OCASIOES = ['trabalho', 'dia', 'noite', 'esporte'];

/**
 * Normaliza o que chegou pela rede. O totem valida antes de enviar, mas o
 * servidor não pode confiar nisso: qualquer um na rede da loja alcança a porta.
 * Devolve `null` quando o corpo não descreve um produto utilizável.
 */
export function normalizarProduto(cru) {
  if (!cru || typeof cru !== 'object') return null;

  const id = TEXTO(cru.id);
  const nome = TEXTO(cru.nome);
  const preco = Number(cru.preco);
  const estoque = Number(cru.estoque);

  if (!id.startsWith('local:')) return null;
  if (nome.length < 2) return null;
  if (!Number.isFinite(preco) || preco <= 0) return null;
  if (!Number.isInteger(estoque) || estoque < 0) return null;

  const agora = new Date().toISOString();
  const intensidade = Number(cru.intensidade);

  return {
    id,
    nome,
    marca: TEXTO(cru.marca) || null,
    preco: Math.round(preco * 100) / 100,
    estoque,
    descricao: TEXTO(cru.descricao),
    genero: ['F', 'M', 'U'].includes(cru.genero) ? cru.genero : null,
    familias: LISTA(cru.familias, FAMILIAS),
    ocasioes: LISTA(cru.ocasioes, OCASIOES),
    intensidade: [1, 2, 3].includes(intensidade) ? intensidade : null,
    // `fotoLocal` é deliberadamente descartado: é um caminho no sistema de
    // arquivos do tablet que cadastrou, sem sentido algum em outro aparelho.
    fotoLocal: null,
    fotoAtualizadaEm: TEXTO(cru.fotoAtualizadaEm) || null,
    criadoEm: TEXTO(cru.criadoEm) || agora,
    atualizadoEm: TEXTO(cru.atualizadoEm) || agora,
  };
}

/**
 * Nome de arquivo da foto a partir do id do produto.
 *
 * A lista branca de caracteres é a defesa contra path traversal: qualquer um na
 * rede da loja alcança esta porta, e um id como `../../../etc/passwd` não pode
 * virar caminho. Precisa casar com `nomeArquivoFoto()` do app.
 */
function arquivoFoto(id) {
  return `${String(id).replace(/[^a-zA-Z0-9]/g, '-')}.jpg`;
}

export function caminhoFotoLocal(id) {
  const arquivo = path.join(LOCAL_PHOTOS_DIR, arquivoFoto(id));
  return fs.existsSync(arquivo) ? arquivo : null;
}

/** Grava a foto que o totem enviou em base64. */
export function salvarFotoLocal(id, base64) {
  const limpo = String(base64 ?? '').replace(/^data:image\/\w+;base64,/, '');
  if (!limpo) return { estado: 'vazia' };
  const buffer = Buffer.from(limpo, 'base64');
  // 8 MB é folgado para uma foto de 800px e ainda barra um envio absurdo.
  if (buffer.length === 0 || buffer.length > 8 * 1024 * 1024) {
    return { estado: 'invalida' };
  }
  fs.mkdirSync(LOCAL_PHOTOS_DIR, { recursive: true });
  fs.writeFileSync(path.join(LOCAL_PHOTOS_DIR, arquivoFoto(id)), buffer);
  return { estado: 'gravada', bytes: buffer.length };
}

export function removerFotoLocal(id) {
  const arquivo = caminhoFotoLocal(id);
  if (!arquivo) return false;
  fs.unlinkSync(arquivo);
  return true;
}

export function listarProdutosLocais() {
  return Object.values(lerProdutosLocais().produtos);
}

/**
 * Cria ou atualiza. A regra de conflito é a mesma dos dois lados — vence o
 * `atualizadoEm` mais recente — para dois totens editando o mesmo produto
 * convergirem em vez de ficar sobrescrevendo um ao outro.
 */
export function salvarProdutoLocal(produto) {
  const dados = lerProdutosLocais();

  const removidoEm = dados.removidos[produto.id];
  if (removidoEm && removidoEm >= produto.atualizadoEm) {
    return { estado: 'removido' };
  }

  const atual = dados.produtos[produto.id];
  if (atual && atual.atualizadoEm > produto.atualizadoEm) {
    return { estado: 'desatualizado', produto: atual };
  }

  dados.produtos[produto.id] = produto;
  delete dados.removidos[produto.id];
  gravar(dados);
  return { estado: atual ? 'atualizado' : 'criado', produto };
}

export function removerProdutoLocal(id) {
  const dados = lerProdutosLocais();
  const existia = Boolean(dados.produtos[id]);
  delete dados.produtos[id];
  dados.removidos[id] = new Date().toISOString();
  gravar(dados);
  // A foto vai junto: deixá-la para trás encheria o disco com arquivos que
  // nenhum produto referencia mais.
  removerFotoLocal(id);
  return { estado: existia ? 'removido' : 'inexistente' };
}
