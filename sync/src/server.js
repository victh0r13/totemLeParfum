/**
 * Servidor local da loja:
 *   GET  /health         — diagnóstico
 *   GET  /api/catalog    — catálogo gerado pelo sync (o app atualiza sem rebuild)
 *   GET  /api/enrichment — enriquecimento manual (curadoria do totem)
 *
 * Uso: cd sync && npm run server
 */
import fs from 'node:fs';
import cors from 'cors';
import express from 'express';

import { CATALOG_PATH, ENRICHMENT_PATH } from './env.js';
import { getCatalog } from './catalogContext.js';

const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => {
  const catalog = getCatalog();
  res.json({
    ok: true,
    produtosNoTotem: catalog.produtos.length,
    catalogGeneratedAt: catalog.generatedAt,
  });
});

app.get('/api/catalog', (_req, res) => {
  try {
    res.type('application/json').send(fs.readFileSync(CATALOG_PATH, 'utf8'));
  } catch {
    res.status(404).json({ error: 'catalog.json não encontrado. Rode npm run sync.' });
  }
});

app.get('/api/enrichment', (_req, res) => {
  try {
    res.type('application/json').send(fs.readFileSync(ENRICHMENT_PATH, 'utf8'));
  } catch {
    res.status(404).json({ error: 'enrichment.json não encontrado.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  const catalog = getCatalog();
  console.log(`\n[server] Catálogo Le Parfum ouvindo em http://0.0.0.0:${PORT}`);
  console.log(`[server] ${catalog.produtos.length} produtos na curadoria do totem`);
  console.log(
    '[server] No tablet, defina EXPO_PUBLIC_API_URL=http://IP_DESTE_PC:' + PORT + '\n',
  );
});
