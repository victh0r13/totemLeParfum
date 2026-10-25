import AsyncStorage from '@react-native-async-storage/async-storage';

import { BLING_CLIENT_ID, BLING_CLIENT_SECRET, BLING_REFRESH_TOKEN } from '@/config';
import { atualizarPrecoEstoque } from '@/logic/catalog';
import type { TotemPayload } from '@/types/catalog';

/**
 * Sync direto com o Bling, para o tablet que roda sem servidor. Porta para o
 * app o `sync/src/quick.js` — só preço e estoque, que é o que muda o dia todo.
 * Descrição, foto e produto novo continuam chegando com um APK novo.
 */

const API_BASE = 'https://api.bling.com.br/Api/v3';
const TOKEN_URL = 'https://www.bling.com.br/Api/v3/oauth/token';
const TOKENS_KEY = 'leparfum:bling:tokens:v1';

/** Limite da API do Bling: 3 requisições por segundo. */
const MIN_INTERVAL_MS = 350;
/** Renova o access_token quando faltar menos que isso para expirar. */
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20000;
const PAGE_SIZE = 100;
const STOCK_BATCH = 40;

interface BlingTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  /** Semente do APK de onde esta cadeia de tokens começou. */
  semente: string | null;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

interface ProdutoListagem {
  id?: number | string;
  preco?: number | string;
  situacao?: string;
  tipo?: string;
}

interface SaldoEstoque {
  produto?: { id?: number | string };
  saldoVirtualTotal?: number;
  saldoFisicoTotal?: number;
}

/** O refresh token não vale mais: só um APK com autorização nova resolve. */
export class BlingAuthError extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 de texto ASCII (client_id:client_secret), sem depender de btoa. */
function base64(texto: string): string {
  let saida = '';
  for (let i = 0; i < texto.length; i += 3) {
    const [a, b, c] = [texto.charCodeAt(i), texto.charCodeAt(i + 1), texto.charCodeAt(i + 2)];
    const bloco = (a << 16) | ((b || 0) << 8) | (c || 0);
    saida += BASE64[(bloco >> 18) & 63] + BASE64[(bloco >> 12) & 63];
    saida += Number.isNaN(b) ? '=' : BASE64[(bloco >> 6) & 63];
    saida += Number.isNaN(c) ? '=' : BASE64[bloco & 63];
  }
  return saida;
}

async function fetchComTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function carregarTokens(): Promise<BlingTokens | null> {
  try {
    const salvo = await AsyncStorage.getItem(TOKENS_KEY);
    return salvo ? (JSON.parse(salvo) as BlingTokens) : null;
  } catch {
    return null;
  }
}

async function renovar(refreshToken: string): Promise<BlingTokens> {
  const res = await fetchComTimeout(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${base64(`${BLING_CLIENT_ID}:${BLING_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token || !data.refresh_token) {
    throw new BlingAuthError(`Bling recusou a renovação do acesso (HTTP ${res.status}).`);
  }
  const tokens: BlingTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 21600) * 1000,
    semente: BLING_REFRESH_TOKEN,
  };
  // Grava antes de usar: se o Bling invalidou o refresh token anterior, este
  // par é o único que ainda vale.
  await AsyncStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  return tokens;
}

/**
 * Tenta renovar com cada refresh token conhecido. Um APK novo traz uma semente
 * nova (autorização feita no PC na hora do build), que passa na frente da
 * cadeia antiga; a antiga fica de reserva, e vice-versa.
 */
async function renovarComCandidatos(salvos: BlingTokens | null): Promise<BlingTokens> {
  const sementeNova = salvos?.semente !== BLING_REFRESH_TOKEN;
  const candidatos = (
    sementeNova
      ? [BLING_REFRESH_TOKEN, salvos?.refresh_token]
      : [salvos?.refresh_token, BLING_REFRESH_TOKEN]
  ).filter((t, i, lista): t is string => !!t && lista.indexOf(t) === i);

  let ultimoErro: unknown = new BlingAuthError('Nenhum token do Bling neste aplicativo.');
  for (const candidato of candidatos) {
    try {
      return await renovar(candidato);
    } catch (err) {
      ultimoErro = err;
      // Falha de rede não é token inválido: não adianta tentar o próximo.
      if (!(err instanceof BlingAuthError)) throw err;
    }
  }
  throw ultimoErro;
}

// Uma renovação por vez: duas em paralelo gastariam o mesmo refresh token.
let renovacao: Promise<BlingTokens> | null = null;

async function accessToken(forcar = false): Promise<string> {
  const salvos = await carregarTokens();
  const valido =
    salvos &&
    !forcar &&
    salvos.semente === BLING_REFRESH_TOKEN &&
    Date.now() < salvos.expires_at - EXPIRY_MARGIN_MS;
  if (valido) return salvos.access_token;

  renovacao ??= renovarComCandidatos(salvos).finally(() => {
    renovacao = null;
  });
  return (await renovacao).access_token;
}

let ultimaRequisicao = 0;

async function aguardarVez() {
  const espera = ultimaRequisicao + MIN_INTERVAL_MS - Date.now();
  ultimaRequisicao = Date.now() + Math.max(espera, 0);
  if (espera > 0) await sleep(espera);
}

type Params = Record<string, string | number | (string | number)[]>;

function querystring(params: Params): string {
  const partes: string[] = [];
  for (const [chave, valor] of Object.entries(params)) {
    for (const v of Array.isArray(valor) ? valor : [valor]) {
      partes.push(`${encodeURIComponent(chave)}=${encodeURIComponent(String(v))}`);
    }
  }
  return partes.join('&');
}

/** GET autenticado na API v3 do Bling, com limite de ritmo e novas tentativas. */
async function blingGet<T>(
  caminho: string,
  params: Params,
  tentativa = 1,
  renovarToken = false,
): Promise<T> {
  await aguardarVez();
  const token = await accessToken(renovarToken);
  const res = await fetchComTimeout(`${API_BASE}${caminho}?${querystring(params)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

  // Token revogado antes da hora: renova uma vez e repete.
  if (res.status === 401 && !renovarToken) return blingGet(caminho, params, tentativa + 1, true);
  if (res.status === 429 && tentativa <= 5) {
    await sleep(1000 * tentativa);
    return blingGet(caminho, params, tentativa + 1);
  }
  if ((res.status === 500 || res.status === 503) && tentativa <= 3) {
    await sleep(1500 * tentativa);
    return blingGet(caminho, params, tentativa + 1);
  }
  if (!res.ok) throw new Error(`Bling ${caminho} respondeu HTTP ${res.status}.`);
  return (await res.json()) as T;
}

/** Preço de todos os produtos ativos, percorrendo a paginação completa. */
async function listarPrecos(): Promise<Map<string, number>> {
  const precos = new Map<string, number>();
  for (let pagina = 1; ; pagina++) {
    const { data } = await blingGet<{ data?: ProdutoListagem[] }>('/produtos', {
      pagina,
      limite: PAGE_SIZE,
    });
    const itens = Array.isArray(data) ? data : [];
    for (const p of itens) {
      const ativo = (p.situacao ?? 'A') === 'A' && (p.tipo ?? 'P') !== 'S';
      if (ativo && p.id !== undefined) precos.set(String(p.id), Number(p.preco ?? 0));
    }
    if (itens.length < PAGE_SIZE) return precos;
  }
}

/** Saldo de estoque dos produtos informados, em lotes de 40. */
async function buscarEstoques(ids: string[]): Promise<Map<string, number>> {
  const estoques = new Map<string, number>();
  for (let i = 0; i < ids.length; i += STOCK_BATCH) {
    const { data } = await blingGet<{ data?: SaldoEstoque[] }>('/estoques/saldos', {
      'idsProdutos[]': ids.slice(i, i + STOCK_BATCH),
    });
    for (const item of data ?? []) {
      const id = item.produto?.id;
      if (id === undefined) continue;
      estoques.set(String(id), Number(item.saldoVirtualTotal ?? item.saldoFisicoTotal ?? 0));
    }
  }
  return estoques;
}

/** Busca preço e estoque no Bling e devolve o payload atualizado. */
export async function sincronizarComBling(
  payload: TotemPayload,
): Promise<{ payload: TotemPayload; mudancas: number }> {
  const precos = await listarPrecos();
  const ids = (payload.produtos ?? []).map((p) => p.id).filter((id) => precos.has(id));
  const estoques = await buscarEstoques(ids);
  return atualizarPrecoEstoque(payload, precos, estoques, new Date().toISOString());
}
