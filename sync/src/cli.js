/**
 * Cada etapa do pipeline (sync, quick, curar, images, bundle) é ao mesmo tempo:
 *
 *   - um MÓDULO, que o servidor importa e agenda dentro do próprio processo;
 *   - um SCRIPT, que você roda à mão com `npm run <etapa>`.
 *
 * Estas duas funções são a costura entre os dois usos. A regra que elas impõem:
 * biblioteca lança erro, script decide o que fazer com ele — nenhuma etapa
 * chama `process.exit()` por conta própria, senão uma falha do Bling derrubaria
 * o servidor junto.
 */
import { pathToFileURL } from 'node:url';

/** true só quando o arquivo foi chamado direto pelo node, não importado. */
export function chamadoDireto(importMetaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  return importMetaUrl === pathToFileURL(entry).href;
}

/** Executa uma etapa como programa de linha de comando. */
export async function comoScript(etapa) {
  try {
    await etapa();
  } catch (err) {
    console.error(`\n[erro] ${err.message}\n`);
    process.exitCode = 1;
  }
}
