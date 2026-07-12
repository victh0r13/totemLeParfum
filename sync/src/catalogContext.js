import fs from 'node:fs';
import { CATALOG_PATH, ENRICHMENT_PATH } from './env.js';

const familyLabels = {
  floral: 'floral',
  citrico: 'cítrico',
  amadeirado: 'amadeirado',
  doce: 'doce',
  oriental: 'oriental',
  fresco: 'fresco',
};
const generoLabels = { F: 'feminino', M: 'masculino', U: 'unissex' };
const intensidadeLabels = { 1: 'leve', 2: 'moderada', 3: 'marcante' };
const LOW_STOCK = 3;

let cache = null;

function fileMtime(p) {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return 0;
  }
}

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * Catálogo real combinado com o enrichment, em memória (recarrega quando os
 * arquivos mudam). Usado para montar o contexto do consultor e validar ids.
 */
export function getCatalog() {
  const stamp = `${fileMtime(CATALOG_PATH)}:${fileMtime(ENRICHMENT_PATH)}`;
  if (cache?.stamp === stamp) return cache;

  const catalogFile = readJson(CATALOG_PATH, { produtos: [] });
  const enrichmentFile = readJson(ENRICHMENT_PATH, { produtos: {} });
  const entries = enrichmentFile.produtos ?? {};

  const produtos = (catalogFile.produtos ?? [])
    .filter((p) => Number(p.estoque) > 0)
    .map((p) => {
      const e = entries[p.id] ?? (p.codigo ? entries[p.codigo] : undefined) ?? null;
      return { ...p, enrichment: e };
    });

  const validIds = new Set(produtos.map((p) => String(p.id)));

  const lines = produtos.map((p) => {
    const parts = [
      `id=${p.id}`,
      `nome="${p.nome}"`,
      `marca="${p.marca ?? 'Le Parfum'}"`,
      `preço=R$${Number(p.preco).toFixed(2)}`,
      Number(p.estoque) <= LOW_STOCK ? 'estoque=últimas unidades' : 'estoque=disponível',
    ];
    if (p.enrichment) {
      const e = p.enrichment;
      if (e.genero) parts.push(`gênero=${generoLabels[e.genero] ?? e.genero}`);
      if (e.familias?.length) {
        parts.push(`famílias=${e.familias.map((f) => familyLabels[f] ?? f).join('/')}`);
      }
      if (e.ocasioes?.length) parts.push(`ocasiões=${e.ocasioes.join('/')}`);
      if (e.intensidade) {
        parts.push(`intensidade=${intensidadeLabels[e.intensidade] ?? e.intensidade}`);
      }
    } else {
      parts.push('SEM_DADOS_OLFATIVOS');
    }
    if (p.descricao) parts.push(`descrição="${String(p.descricao).slice(0, 220)}"`);
    return `- ${parts.join(' | ')}`;
  });

  cache = {
    stamp,
    produtos,
    validIds,
    summary: lines.join('\n'),
    generatedAt: catalogFile.generatedAt ?? null,
  };
  return cache;
}
