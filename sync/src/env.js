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
/** Tokens OAuth do Bling (fora do git). */
export const TOKENS_PATH = path.join(SYNC_ROOT, '.tokens.json');

// Carrega sync/.env e, como fallback, o .env da raiz do projeto.
dotenv.config({ path: path.join(SYNC_ROOT, '.env') });
dotenv.config({ path: path.join(APP_ROOT, '.env') });

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(
      `\n[erro] Variável de ambiente ${name} não encontrada.\n` +
        `Crie o arquivo sync/.env a partir de sync/.env.example e preencha as credenciais.\n`,
    );
    process.exit(1);
  }
  return value;
}
