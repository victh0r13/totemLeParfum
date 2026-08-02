/**
 * Baixa as fotos dos produtos da curadoria para data/images/.
 *
 * Por que isto existe: as URLs de imagem que o Bling devolve são links S3
 * PRÉ-ASSINADOS que expiram em ~7 dias (`?Expires=...`). Guardar a URL no
 * catálogo significa que o totem perde todas as fotos uma semana depois do
 * sync — e um APK recém-instalado sem servidor nunca mostraria foto nenhuma.
 * Baixando os arquivos, as fotos passam a ser um ativo local: vão dentro do
 * APK e são servidas pelo servidor da loja.
 *
 * Uso: cd sync && npm run images   (roda automaticamente depois do sync)
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import { chamadoDireto, comoScript } from './cli.js';
import { CATALOG_PATH, ENRICHMENT_PATH, IMAGES_DIR, IMAGES_MANIFEST_PATH } from './env.js';

/** Downloads simultâneos — as URLs são do S3, não da API do Bling (sem rate limit). */
const CONCURRENCY = 6;
const TIMEOUT_MS = 20000;

/**
 * As fotos do Bling vêm com ~1500px e 270 KB cada — 52 MB no total, grande
 * demais para ir dentro do APK. O maior quadro que o totem desenha é a foto
 * da tela de detalhe (360dp); 800px cobre isso com folga em tela de alta
 * densidade. Resultado: ~12 MB para o catálogo inteiro.
 */
const MAX_SIDE = 800;
const JPEG_QUALITY = 82;

/**
 * Reduz para o tamanho que o totem realmente desenha e normaliza tudo em JPEG
 * sobre fundo branco (as fotos do Bling já vêm com fundo branco; um PNG com
 * transparência ficaria com fundo preto no Android).
 */
async function normalize(buffer) {
  return sharp(buffer)
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

/**
 * Parte estável da URL assinada: o caminho do objeto no S3. A query
 * (AWSAccessKeyId/Expires/Signature) muda a cada sync, o caminho não —
 * é ele que diz se a foto mudou de verdade.
 */
function stableKey(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function download(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

/** Produtos da curadoria (com estoque E entrada no enrichment) que têm foto. */
function curatedWithImages() {
  const catalog = readJson(CATALOG_PATH, { produtos: [] });
  const entries = readJson(ENRICHMENT_PATH, { produtos: {} }).produtos ?? {};
  return (catalog.produtos ?? [])
    .filter((p) => Number(p.estoque) > 0)
    .filter((p) => entries[p.id] ?? (p.codigo ? entries[p.codigo] : undefined))
    .filter((p) => !!p.imagem);
}

/**
 * Baixa e redimensiona as fotos que ainda não estão em data/images/.
 * @returns {Promise<{baixadas: number, total: number}>}
 */
export async function runImages() {
  await fsp.mkdir(IMAGES_DIR, { recursive: true });

  const produtos = curatedWithImages();
  const manifest = readJson(IMAGES_MANIFEST_PATH, {});
  const next = {};

  console.log(`[imagens] ${produtos.length} produtos da curadoria com foto.`);

  let baixadas = 0;
  let reaproveitadas = 0;
  let falhas = 0;
  let cursor = 0;

  async function worker() {
    for (;;) {
      const index = cursor++;
      if (index >= produtos.length) return;
      const p = produtos[index];
      const key = stableKey(p.imagem);
      const previous = manifest[p.id];

      // Mesma foto de antes e o arquivo continua no disco: não rebaixa.
      if (previous?.key === key && fs.existsSync(path.join(IMAGES_DIR, previous.file))) {
        next[p.id] = previous;
        reaproveitadas++;
        continue;
      }

      try {
        const original = await download(p.imagem);
        const buffer = await normalize(original);
        const file = `${p.id}.jpg`;
        await fsp.writeFile(path.join(IMAGES_DIR, file), buffer);
        next[p.id] = { file, key, bytes: buffer.length, updatedAt: new Date().toISOString() };
        baixadas++;
        if (baixadas % 20 === 0) console.log(`[imagens] ${baixadas} baixadas...`);
      } catch (err) {
        falhas++;
        console.warn(`[imagens] falhou ${p.id} (${p.nome}): ${err.message}`);
        // Mantém a versão anterior, se existir — foto velha é melhor que nenhuma.
        if (previous && fs.existsSync(path.join(IMAGES_DIR, previous.file))) {
          next[p.id] = previous;
        }
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Remove fotos de produtos que saíram da curadoria/estoque.
  const validos = new Set(Object.values(next).map((m) => m.file));
  let removidas = 0;
  for (const file of await fsp.readdir(IMAGES_DIR)) {
    if (file === 'manifest.json' || validos.has(file)) continue;
    await fsp.unlink(path.join(IMAGES_DIR, file));
    removidas++;
  }

  await fsp.writeFile(IMAGES_MANIFEST_PATH, JSON.stringify(next, null, 2), 'utf8');

  const totalBytes = Object.values(next).reduce((sum, m) => sum + (m.bytes ?? 0), 0);
  console.log(
    `\n[ok] ${Object.keys(next).length} fotos em data/images/ ` +
      `(${baixadas} novas, ${reaproveitadas} reaproveitadas, ${falhas} falhas, ${removidas} removidas).`,
  );
  console.log(`[ok] Total em disco: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);

  return { baixadas, total: Object.keys(next).length };
}

if (chamadoDireto(import.meta.url)) comoScript(runImages);
