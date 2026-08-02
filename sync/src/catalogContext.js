import fs from 'node:fs';
import { CATALOG_PATH, ENRICHMENT_PATH } from './env.js';

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
 * Curadoria do totem em memória (recarrega quando os arquivos mudam):
 * produtos com estoque E entrada no enrichment.json — o mesmo recorte
 * que o app exibe, no mesmo formato do bundle do APK (TotemPayload).
 */
export function getCatalog() {
  const stamp = `${fileMtime(CATALOG_PATH)}:${fileMtime(ENRICHMENT_PATH)}`;
  if (cache?.stamp === stamp) return cache;

  const catalogFile = readJson(CATALOG_PATH, { produtos: [] });
  const enrichmentFile = readJson(ENRICHMENT_PATH, { produtos: {} });
  const entries = enrichmentFile.produtos ?? {};

  const produtos = (catalogFile.produtos ?? [])
    .filter((p) => Number(p.estoque) > 0)
    .filter((p) => entries[p.id] ?? (p.codigo ? entries[p.codigo] : undefined))
    .map(({ categoria, ...p }) => p);

  const enrichment = {};
  for (const p of produtos) {
    const { nome, ...entry } = entries[p.id] ?? entries[p.codigo] ?? {};
    enrichment[p.id] = entry;
  }

  cache = {
    stamp,
    produtos,
    enrichment,
    generatedAt: catalogFile.generatedAt ?? null,
    source: catalogFile.source ?? 'bling',
  };
  return cache;
}
