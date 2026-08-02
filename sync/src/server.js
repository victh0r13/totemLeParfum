/**
 * Servidor local da loja:
 *   GET    /health                   — diagnóstico
 *   GET    /api/totem                — curadoria pronta para o app (produtos + enrichment)
 *   GET    /images/:id               — foto do produto baixada do Bling (data/images/)
 *   GET    /api/catalog              — catálogo bruto do sync (depuração)
 *   GET    /api/enrichment           — enriquecimento manual completo (depuração)
 *   GET    /api/produtos-locais      — produtos cadastrados nos totens
 *   POST   /api/produtos-locais      — cria ou atualiza um deles
 *   DELETE /api/produtos-locais/:id  — remove um deles
 *
 * As três últimas são as únicas rotas de escrita: o catálogo do Bling é sempre
 * de leitura aqui, porque quem o altera é o sync.
 *
 * Uso: cd sync && npm run server
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { WebSocketServer } from 'ws';

import { CATALOG_PATH, ENRICHMENT_PATH, IMAGES_DIR, IMAGES_MANIFEST_PATH } from './env.js';
import { getCatalog } from './catalogContext.js';
import {
  caminhoFotoLocal,
  listarProdutosLocais,
  normalizarProduto,
  removerFotoLocal,
  removerProdutoLocal,
  salvarFotoLocal,
  salvarProdutoLocal,
} from './localProducts.js';
import { iniciarAgenda } from './scheduler.js';
import { runCurate } from './curate.js';
import { runImages } from './images.js';
import { runQuick } from './quick.js';
import { runSync } from './sync.js';

const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(cors());

/**
 * Um corpo de produto é texto curto e 256kb sobra. Já a foto vai em base64, que
 * infla o binário em ~33%: uma imagem de 800px em JPEG passa folgadamente dos
 * 256kb. Em vez de afrouxar o limite para todas as rotas, a exceção é só onde
 * ela é necessária.
 */
const jsonPadrao = express.json({ limit: '256kb' });
const jsonFoto = express.json({ limit: '12mb' });
app.use((req, res, next) =>
  (req.path.endsWith('/foto') ? jsonFoto : jsonPadrao)(req, res, next),
);

/** Manifesto das fotos, relido quando o arquivo muda (o sync o reescreve). */
let imagesCache = { mtime: 0, manifest: {} };
function imageManifest() {
  let mtime = 0;
  try {
    mtime = fs.statSync(IMAGES_MANIFEST_PATH).mtimeMs;
  } catch {
    return {};
  }
  if (imagesCache.mtime !== mtime) {
    try {
      imagesCache = { mtime, manifest: JSON.parse(fs.readFileSync(IMAGES_MANIFEST_PATH, 'utf8')) };
    } catch {
      imagesCache = { mtime, manifest: {} };
    }
  }
  return imagesCache.manifest;
}

app.get('/health', (_req, res) => {
  const catalog = getCatalog();
  res.json({
    ok: true,
    produtosNoTotem: catalog.produtos.length,
    produtosDaLoja: listarProdutosLocais().length,
    fotosLocais: Object.keys(imageManifest()).length,
    catalogGeneratedAt: catalog.generatedAt,
    totensConectados: wss.clients.size,
    // Sem isto, uma rotina que falha há dias fica invisível.
    agenda: agenda.status(),
  });
});

/** O que o totem consome: mesmo formato do bundle do APK (TotemPayload). */
app.get('/api/totem', (_req, res) => {
  const { produtos, enrichment, generatedAt, source } = getCatalog();
  res.json({ generatedAt, source, produtos, enrichment });
});

/**
 * Foto do produto pelo id do Bling — o app não precisa saber a extensão do
 * arquivo, o manifesto resolve. Cache longo: o conteúdo de um id só muda
 * quando a foto muda no Bling.
 */
app.get('/images/:id', (req, res) => {
  const id = String(req.params.id);

  // Produto cadastrado na loja: a foto vem de data/fotos-locais/. O app usa a
  // mesma rota das fotos do Bling de propósito — para ele não existe diferença
  // entre um produto e outro na hora de desenhar a vitrine.
  if (id.startsWith('local:')) {
    const arquivo = caminhoFotoLocal(id);
    if (!arquivo) return res.status(404).json({ error: 'produto sem foto' });
    // Sem cache longo aqui: a equipe troca a foto pelo próprio totem, e o
    // cache-buster (?v=) já cuida de forçar a releitura quando isso acontece.
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.sendFile(arquivo);
  }

  const entry = imageManifest()[id];
  if (!entry) return res.status(404).json({ error: 'sem foto local para este produto' });
  const file = path.join(IMAGES_DIR, entry.file);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'arquivo não encontrado' });
  res.setHeader('Cache-Control', 'public, max-age=604800');
  return res.sendFile(file);
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

/**
 * Produtos cadastrados nos totens. Ficam separados de /api/totem de propósito:
 * aquele endpoint é o espelho do Bling, e misturar as duas origens no mesmo
 * payload tornaria impossível saber quem manda em cada registro. O app junta as
 * duas listas na hora de montar a vitrine.
 */
app.get('/api/produtos-locais', (_req, res) => {
  res.json({ produtos: listarProdutosLocais() });
});

app.post('/api/produtos-locais', (req, res) => {
  const produto = normalizarProduto(req.body);
  if (!produto) {
    return res.status(400).json({ error: 'produto inválido: confira nome, preço e estoque' });
  }
  const { estado, produto: salvo } = salvarProdutoLocal(produto);
  // 200 mesmo quando a escrita é descartada por ser velha: do ponto de vista do
  // totem a operação terminou, e ele deve tirá-la da fila em vez de reenviar
  // para sempre uma alteração que perdeu o conflito.
  return res.json({ estado, produto: salvo ?? produto });
});

app.delete('/api/produtos-locais/:id', (req, res) => {
  const { estado } = removerProdutoLocal(String(req.params.id));
  return res.json({ estado });
});

/**
 * Foto do produto, em base64.
 *
 * Vem numa requisição própria, e não dentro do POST do produto, por dois
 * motivos: o cadastro sobe na hora mesmo que a foto falhe, e uma edição que só
 * mexe no preço não reenvia a imagem inteira de novo.
 */
app.post('/api/produtos-locais/:id/foto', (req, res) => {
  const id = String(req.params.id);
  if (!id.startsWith('local:')) {
    return res.status(400).json({ error: 'só produtos da loja têm foto própria' });
  }
  const { estado, bytes } = salvarFotoLocal(id, req.body?.base64);
  if (estado !== 'gravada') return res.status(400).json({ error: `foto ${estado}` });
  return res.json({ estado, bytes });
});

app.delete('/api/produtos-locais/:id/foto', (req, res) => {
  const removida = removerFotoLocal(String(req.params.id));
  return res.json({ estado: removida ? 'removida' : 'inexistente' });
});

const server = http.createServer(app);

/**
 * Tempo real: em vez de o totem perguntar "mudou?" de tempos em tempos, o
 * servidor avisa. Quem escreve data/catalog.json (o sync rápido, de 5 em 5
 * minutos) dispara o aviso; o app refaz o fetch na hora.
 */
const wss = new WebSocketServer({ server, path: '/ws' });

function avisarTotens(motivo) {
  const { produtos, generatedAt } = getCatalog();
  const aviso = JSON.stringify({ tipo: 'catalogo-atualizado', motivo, generatedAt });
  let enviados = 0;
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(aviso);
      enviados++;
    }
  }
  console.log(
    `[ws] ${motivo}: ${produtos.length} produtos — avisados ${enviados} totem(ns).`,
  );
}

wss.on('connection', (socket) => {
  console.log(`[ws] totem conectado (${wss.clients.size} online)`);
  socket.on('close', () => console.log(`[ws] totem saiu (${wss.clients.size} online)`));
});

/**
 * fs.watch dispara várias vezes para uma única gravação (o Node reescreve em
 * blocos); o debounce junta tudo em um aviso só.
 */
function observar(arquivo, motivo) {
  let timer = null;
  try {
    fs.watch(arquivo, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => avisarTotens(motivo), 600);
    });
  } catch {
    console.warn(`[ws] não foi possível observar ${arquivo} — tempo real desativado para ele.`);
  }
}

observar(CATALOG_PATH, 'catálogo alterado');
observar(ENRICHMENT_PATH, 'curadoria alterada');

/**
 * As rotinas de sincronização rodam aqui dentro. Quando alguma delas grava
 * data/catalog.json, o `observar()` acima percebe e avisa os totens — os dois
 * mecanismos se encontram no arquivo, sem precisar chamar um ao outro.
 */
const agenda = iniciarAgenda({
  quick: runQuick,
  completo: async () => {
    await runSync();
    runCurate();
    await runImages();
  },
  intervaloQuickMin: Number(process.env.SYNC_QUICK_MIN ?? 5),
});

server.listen(PORT, '0.0.0.0', () => {
  const catalog = getCatalog();
  console.log(`\n[server] Catálogo Le Parfum ouvindo em http://0.0.0.0:${PORT}`);
  console.log(`[server] ${catalog.produtos.length} produtos na curadoria do totem`);
  console.log(`[server] ${listarProdutosLocais().length} produtos cadastrados pela loja`);
  console.log(`[server] ${Object.keys(imageManifest()).length} fotos locais em data/images/`);
  console.log(`[server] Tempo real (WebSocket) em ws://0.0.0.0:${PORT}/ws`);
  console.log(
    '[server] No tablet, defina EXPO_PUBLIC_API_URL=http://IP_DESTE_PC:' + PORT + '\n',
  );
});
