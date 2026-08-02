/**
 * Sync rápido: só PREÇO e ESTOQUE.
 *
 * O `sync.js` completo pede o detalhe de cada produto (1.161 requisições a
 * 350ms = ~7 min) porque precisa de descrição, foto e categoria. Mas esses
 * campos quase nunca mudam — o que muda o dia inteiro é preço e estoque, e
 * isso vem da listagem + do endpoint de saldos: ~45 requisições, ~20 segundos.
 *
 * Por isso a atualização do totem é dividida em duas:
 *   - este script, de 5 em 5 minutos  → preço e estoque quase em tempo real;
 *   - o sync completo, 1x por dia     → descrições, fotos e produtos novos.
 *
 * Só reescreve data/catalog.json se algo mudou de verdade — assim o servidor
 * só avisa os totens quando há novidade.
 *
 * Uso: cd sync && npm run quick
 */
import fs from 'node:fs';

import { getStockBalances, listAllProducts } from './bling.js';
import { chamadoDireto, comoScript } from './cli.js';
import { CATALOG_PATH } from './env.js';

/**
 * Atualiza preço e estoque no catálogo.
 * @returns {Promise<{mudouPreco: number, mudouEstoque: number}>} o que mudou —
 *   o agendador usa isso para saber se vale avisar os totens.
 */
export async function runQuick() {
  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  } catch {
    throw new Error('data/catalog.json não existe. Rode `npm run sync` primeiro.');
  }

  const listing = await listAllProducts();
  const ativos = listing.filter((p) => (p.situacao ?? 'A') === 'A' && (p.tipo ?? 'P') !== 'S');
  const precos = new Map(ativos.map((p) => [String(p.id), Number(p.preco ?? 0)]));
  const estoques = await getStockBalances(ativos.map((p) => String(p.id)));

  let mudouPreco = 0;
  let mudouEstoque = 0;
  const alteracoes = [];

  for (const produto of catalog.produtos ?? []) {
    const id = String(produto.id);

    const preco = precos.get(id);
    if (preco !== undefined && preco > 0 && preco !== produto.preco) {
      alteracoes.push(`preço  ${produto.nome.slice(0, 44)}: ${produto.preco} → ${preco}`);
      produto.preco = preco;
      mudouPreco++;
    }

    const estoque = estoques.get(id);
    if (estoque !== undefined && estoque !== produto.estoque) {
      alteracoes.push(`estoque ${produto.nome.slice(0, 44)}: ${produto.estoque} → ${estoque}`);
      produto.estoque = estoque;
      mudouEstoque++;
    }
  }

  if (mudouPreco === 0 && mudouEstoque === 0) {
    console.log('[quick] Nada mudou — catalog.json não foi tocado.');
    return { mudouPreco: 0, mudouEstoque: 0 };
  }

  // Só regrava quando há mudança: é a escrita no arquivo que dispara o aviso
  // aos totens pelo WebSocket.
  catalog.generatedAt = new Date().toISOString();
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');

  console.log(`\n[ok] ${mudouPreco} preço(s) e ${mudouEstoque} estoque(s) atualizados:`);
  for (const linha of alteracoes.slice(0, 20)) console.log(`  - ${linha}`);
  if (alteracoes.length > 20) console.log(`  ... e mais ${alteracoes.length - 20}.`);

  return { mudouPreco, mudouEstoque };
}

if (chamadoDireto(import.meta.url)) comoScript(runQuick);
