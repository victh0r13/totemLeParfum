/**
 * Gera o recorte que vai DENTRO do APK (offline-first de fábrica):
 *
 *   data/catalog.bundle.json  — só a curadoria (com estoque + enrichment),
 *                               em vez dos ~1.200 produtos do Bling.
 *   src/data/bundledImages.ts — mapa id → require() das fotos de data/images/,
 *                               para o app abrir com foto sem rede nenhuma.
 *
 * Rode sempre depois de `npm run sync` + `npm run images` e ANTES de gerar o
 * APK. Os dois arquivos são versionados: é o estado "de fábrica" do totem.
 *
 * Uso: cd sync && npm run bundle
 */
import fs from 'node:fs';
import path from 'node:path';

import { chamadoDireto, comoScript } from './cli.js';
import {
  BUNDLE_CATALOG_PATH,
  BUNDLE_IMAGES_MODULE,
  CATALOG_PATH,
  ENRICHMENT_PATH,
  IMAGES_DIR,
  IMAGES_MANIFEST_PATH,
} from './env.js';

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * Gera o recorte da curadoria que vai dentro do APK.
 * @returns {{produtos: number, fotos: number}}
 */
export function runBundle() {
  const catalog = readJson(CATALOG_PATH, { produtos: [] });
  const entries = readJson(ENRICHMENT_PATH, { produtos: {} }).produtos ?? {};
  const manifest = readJson(IMAGES_MANIFEST_PATH, {});

  const produtos = (catalog.produtos ?? [])
    .filter((p) => Number(p.estoque) > 0)
    .filter((p) => entries[p.id] ?? (p.codigo ? entries[p.codigo] : undefined))
    // `categoria` só serve para a curadoria automática, o app não usa: fora do bundle.
    .map(({ categoria, ...p }) => p);

  // Só o enrichment dos produtos que entraram, e sem o campo `nome`
  // (é comentário para quem edita o JSON à mão; o app ignora).
  const enrichment = {};
  for (const p of produtos) {
    const { nome, ...entry } = entries[p.id] ?? entries[p.codigo] ?? {};
    enrichment[p.id] = entry;
  }

  const bundle = {
    generatedAt: catalog.generatedAt ?? new Date().toISOString(),
    source: catalog.source ?? 'bling',
    produtos,
    enrichment,
  };
  fs.writeFileSync(BUNDLE_CATALOG_PATH, JSON.stringify(bundle), 'utf8');

  /**
   * Empacotar as fotos no APK é uma escolha de QUIOSQUE, não uma regra geral:
   * troca ~5,6 MB de binário por um app que abre completo em modo avião, num
   * tablet recém-formatado. Um app de consumidor final faria o contrário —
   * serviria tudo do servidor e deixaria o cache de disco se encarregar.
   *
   * TOTEM_BUNDLE_IMAGES=false gera o mapa vazio: as fotos passam a vir só do
   * servidor da loja (+ prefetch para o disco do aparelho na primeira abertura).
   */
  const empacotarFotos = (process.env.TOTEM_BUNDLE_IMAGES ?? 'true').toLowerCase() !== 'false';

  // Só entram no mapa as fotos que existem mesmo em disco.
  const linhas = [];
  if (empacotarFotos) {
    for (const p of produtos) {
      const entry = manifest[p.id];
      if (!entry || !fs.existsSync(path.join(IMAGES_DIR, entry.file))) continue;
      linhas.push(`  '${p.id}': require('../../data/images/${entry.file}'),`);
    }
  } else {
    console.log('[info] TOTEM_BUNDLE_IMAGES=false — fotos ficam só no servidor.');
  }

  const modulo = `/**
 * GERADO AUTOMATICAMENTE por \`cd sync && npm run bundle\` — não edite à mão.
 *
 * Fotos da curadoria empacotadas no APK. É isto que faz o totem abrir com as
 * imagens dos perfumes sem nenhuma rede: as URLs do Bling são links assinados
 * que expiram em ~7 dias e não servem como fonte permanente.
 */
export const bundledImages: Record<string, number> = {
${linhas.join('\n')}
};

/** Foto empacotada do produto, quando existe. */
export function bundledImage(id: string): number | undefined {
  return bundledImages[id];
}
`;
  fs.writeFileSync(BUNDLE_IMAGES_MODULE, modulo, 'utf8');

  const bytes = fs.statSync(BUNDLE_CATALOG_PATH).size;
  const fotosBytes = linhas.length
    ? Object.values(manifest).reduce((sum, m) => sum + (m.bytes ?? 0), 0)
    : 0;

  console.log(`[ok] catalog.bundle.json: ${produtos.length} produtos (${(bytes / 1024).toFixed(0)} KB)`);
  console.log(
    `[ok] bundledImages.ts: ${linhas.length} fotos (${(fotosBytes / 1024 / 1024).toFixed(1)} MB no APK)`,
  );
  const semFoto = produtos.length - linhas.length;
  if (semFoto > 0) {
    console.log(`[info] ${semFoto} produto(s) sem foto — o app mostra o degradê da família.`);
  }

  return { produtos: produtos.length, fotos: linhas.length };
}

if (chamadoDireto(import.meta.url)) comoScript(runBundle);
