import { getAccessToken } from './tokens.js';

const API_BASE = 'https://api.bling.com.br/Api/v3';

/**
 * Limitador simples: máximo 3 requisições por segundo (limite da API do Bling).
 * Intervalo mínimo de 350ms entre chamadas, com retry em 429.
 */
const MIN_INTERVAL_MS = 350;
let lastRequestAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function throttle() {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

/** GET autenticado na API v3 do Bling, com rate limit e retry. */
export async function blingGet(pathname, params = {}, attempt = 1) {
  await throttle();
  const token = await getAccessToken();
  const url = new URL(`${API_BASE}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(key, String(v));
    } else if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

  if (res.status === 429 && attempt <= 5) {
    const backoff = 1000 * attempt;
    console.warn(`[bling] 429 (limite de requisições) — aguardando ${backoff}ms...`);
    await sleep(backoff);
    return blingGet(pathname, params, attempt + 1);
  }
  if ((res.status === 500 || res.status === 503) && attempt <= 3) {
    await sleep(1500 * attempt);
    return blingGet(pathname, params, attempt + 1);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Bling GET ${pathname} falhou (HTTP ${res.status}): ${JSON.stringify(data).slice(0, 400)}`,
    );
  }
  return data;
}

/** Lista todos os produtos, percorrendo a paginação completa (100 por página). */
export async function listAllProducts() {
  const all = [];
  let page = 1;
  for (;;) {
    const { data } = await blingGet('/produtos', { pagina: page, limite: 100 });
    const items = Array.isArray(data) ? data : [];
    all.push(...items);
    console.log(`[bling] página ${page}: ${items.length} produtos (total ${all.length})`);
    if (items.length < 100) break;
    page += 1;
  }
  return all;
}

/** Detalhes completos de um produto (marca, descrição, imagens). */
export async function getProductDetails(id) {
  const { data } = await blingGet(`/produtos/${id}`);
  return data ?? null;
}

/** Saldos de estoque para um conjunto de produtos (lotes de 40 ids). */
export async function getStockBalances(productIds) {
  const balances = new Map();
  const BATCH = 40;
  for (let i = 0; i < productIds.length; i += BATCH) {
    const batch = productIds.slice(i, i + BATCH);
    try {
      const { data } = await blingGet('/estoques/saldos', { 'idsProdutos[]': batch });
      for (const item of data ?? []) {
        const id = item?.produto?.id;
        if (id !== undefined) {
          balances.set(String(id), Number(item.saldoVirtualTotal ?? item.saldoFisicoTotal ?? 0));
        }
      }
      console.log(
        `[bling] estoque: ${Math.min(i + BATCH, productIds.length)}/${productIds.length} produtos`,
      );
    } catch (err) {
      console.warn(`[bling] falha ao buscar estoque do lote ${i / BATCH + 1}: ${err.message}`);
    }
  }
  return balances;
}
