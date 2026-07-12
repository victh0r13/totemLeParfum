/**
 * Sincroniza o catálogo com o Bling e gera data/catalog.json.
 *
 * Uso: cd sync && npm run sync
 *
 * - Busca todos os produtos (paginação completa, máx. 3 req/s).
 * - Busca os saldos de estoque (endpoint /estoques/saldos).
 * - Com SYNC_FETCH_DETAILS=true, busca marca/descrição/imagem de cada produto.
 * - Nunca toca em data/enrichment.json (preenchimento manual).
 */
import fs from 'node:fs';

import { getProductDetails, getStockBalances, listAllProducts } from './bling.js';
import { CATALOG_PATH, ENRICHMENT_PATH } from './env.js';

const fetchDetails = (process.env.SYNC_FETCH_DETAILS ?? 'true').toLowerCase() !== 'false';

function pickImage(detail, listingItem) {
  const internas = detail?.midia?.imagens?.internas ?? [];
  const externas = detail?.midia?.imagens?.externas ?? [];
  return (
    internas[0]?.link ||
    externas[0]?.link ||
    detail?.imagemURL ||
    listingItem?.imagemURL ||
    null
  );
}

function cleanText(value) {
  if (!value) return null;
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('[sync] Iniciando sincronização com o Bling...\n');

  const listing = await listAllProducts();

  // Somente produtos ativos e do tipo "produto" (ignora serviços).
  const active = listing.filter(
    (p) => (p.situacao ?? 'A') === 'A' && (p.tipo ?? 'P') !== 'S',
  );
  console.log(`\n[sync] ${active.length} produtos ativos de ${listing.length} no total.`);

  const ids = active.map((p) => String(p.id));
  const stock = await getStockBalances(ids);

  const produtos = [];
  for (let i = 0; i < active.length; i++) {
    const item = active[i];
    const id = String(item.id);

    let detail = null;
    if (fetchDetails) {
      try {
        detail = await getProductDetails(id);
        if ((i + 1) % 25 === 0 || i === active.length - 1) {
          console.log(`[sync] detalhes: ${i + 1}/${active.length}`);
        }
      } catch (err) {
        console.warn(`[sync] sem detalhes para ${id} (${item.nome}): ${err.message}`);
      }
    }

    const estoque =
      stock.get(id) ??
      Number(detail?.estoque?.saldoVirtualTotal ?? item?.estoque?.saldoVirtualTotal ?? 0);

    produtos.push({
      id,
      codigo: detail?.codigo ?? item.codigo ?? null,
      nome: detail?.nome ?? item.nome,
      marca: cleanText(detail?.marca) || null,
      preco: Number(detail?.preco ?? item.preco ?? 0),
      estoque: Number.isFinite(estoque) ? estoque : 0,
      imagem: pickImage(detail, item),
      descricao:
        cleanText(detail?.descricaoComplementar) ||
        cleanText(detail?.descricaoCurta) ||
        cleanText(item.descricaoCurta) ||
        null,
    });
  }

  const catalog = {
    generatedAt: new Date().toISOString(),
    source: 'bling',
    produtos,
  };
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');

  const inStock = produtos.filter((p) => p.estoque > 0);
  console.log(`\n[ok] catalog.json gerado: ${produtos.length} produtos (${inStock.length} com estoque).`);
  console.log(`[ok] Arquivo: ${CATALOG_PATH}`);

  // Aponta produtos com estoque que ainda não têm enriquecimento manual.
  try {
    const enrichment = JSON.parse(fs.readFileSync(ENRICHMENT_PATH, 'utf8'));
    const entries = enrichment.produtos ?? {};
    const missing = inStock.filter((p) => !entries[p.id] && !(p.codigo && entries[p.codigo]));
    if (missing.length > 0) {
      console.log(
        `\n[atenção] ${missing.length} produto(s) com estoque ainda SEM enriquecimento ` +
          '(fora dos filtros de família/ocasião, do quiz e do consultor):',
      );
      for (const p of missing.slice(0, 30)) {
        console.log(`  - id ${p.id}${p.codigo ? ` | SKU ${p.codigo}` : ''} | ${p.nome}`);
      }
      if (missing.length > 30) console.log(`  ... e mais ${missing.length - 30}.`);
      console.log('Preencha em data/enrichment.json (veja as instruções no próprio arquivo).');
    } else {
      console.log('\n[ok] Todos os produtos com estoque possuem enriquecimento. 🎉');
    }
  } catch {
    console.warn('[aviso] Não foi possível ler data/enrichment.json para o relatório.');
  }
}

main().catch((err) => {
  console.error(`\n[erro] Sincronização falhou: ${err.message}`);
  process.exit(1);
});
