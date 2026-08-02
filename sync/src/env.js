import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Raiz da pasta sync (onde fica o .env). */
export const SYNC_ROOT = path.resolve(here, '..');
/** Raiz do projeto do app (onde fica /data). */
export const APP_ROOT = path.resolve(SYNC_ROOT, '..');
/** Arquivos de dados compartilhados com o app. */
export const CATALOG_PATH = path.join(APP_ROOT, 'data', 'catalog.json');
export const ENRICHMENT_PATH = path.join(APP_ROOT, 'data', 'enrichment.json');
/** Fotos baixadas do Bling: vão dentro do APK e são servidas pelo servidor. */
export const IMAGES_DIR = path.join(APP_ROOT, 'data', 'images');
export const IMAGES_MANIFEST_PATH = path.join(IMAGES_DIR, 'manifest.json');
/** Produtos cadastrados pela loja nos totens — não vêm do Bling. */
export const LOCAL_PRODUCTS_PATH = path.join(APP_ROOT, 'data', 'produtos-locais.json');
/**
 * Fotos desses produtos. Ficam FORA de data/images/ de propósito: o runImages()
 * apaga daquela pasta tudo que não estiver no manifesto do Bling, e roda sozinho
 * a cada 6 horas — as fotos do cadastro sumiriam sem ninguém entender por quê.
 */
export const LOCAL_PHOTOS_DIR = path.join(APP_ROOT, 'data', 'fotos-locais');
/** Recorte da curadoria empacotado no app (gerado por `npm run bundle`). */
export const BUNDLE_CATALOG_PATH = path.join(APP_ROOT, 'data', 'catalog.bundle.json');
export const BUNDLE_IMAGES_MODULE = path.join(APP_ROOT, 'src', 'data', 'bundledImages.ts');
/** Tokens OAuth do Bling (fora do git). */
export const TOKENS_PATH = path.join(SYNC_ROOT, '.tokens.json');

// Carrega sync/.env e, como fallback, o .env da raiz do projeto.
dotenv.config({ path: path.join(SYNC_ROOT, '.env') });
dotenv.config({ path: path.join(APP_ROOT, '.env') });

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não encontrada. ` +
        'Crie sync/.env a partir de sync/.env.example e preencha as credenciais.',
    );
  }
  return value;
}
