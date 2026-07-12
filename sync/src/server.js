/**
 * Servidor local da loja:
 *   GET  /health         — diagnóstico
 *   GET  /api/catalog    — catálogo gerado pelo sync (o app atualiza sem rebuild)
 *   GET  /api/enrichment — enriquecimento manual
 *   POST /api/chat       — consultor virtual (proxy para a API da Anthropic)
 *
 * A ANTHROPIC_API_KEY fica SOMENTE aqui — o tablet nunca vê a chave.
 * Uso: cd sync && npm run server
 */
import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import cors from 'cors';
import express from 'express';

import { CATALOG_PATH, ENRICHMENT_PATH } from './env.js';
import { getCatalog } from './catalogContext.js';

const PORT = Number(process.env.PORT ?? 3001);
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-8';
const MAX_HISTORY_TURNS = 24;

const client = new Anthropic();

const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    message: {
      type: 'string',
      description: 'Sua resposta ao cliente, em português do Brasil (2 a 4 frases).',
    },
    quickReplies: {
      type: 'array',
      items: { type: 'string' },
      description:
        'De 2 a 6 respostas rápidas curtas (máx. 4 palavras) para o cliente tocar. Vazio somente quando done=true.',
    },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
      description:
        'IDs exatos de produtos do catálogo recomendados nesta resposta (0 a 4). Use somente na recomendação final.',
    },
    done: {
      type: 'boolean',
      description: 'true quando esta resposta contém as recomendações finais.',
    },
  },
  required: ['message', 'quickReplies', 'recommendations', 'done'],
  additionalProperties: false,
};

function buildSystem() {
  const catalog = getCatalog();
  const persona = `Você é o consultor virtual da perfumaria Le Parfum, atendendo em um totem de tablet dentro da loja.

TOM: acolhedor, sofisticado e caloroso, sem ser formal demais. Sempre em português do Brasil. Respostas curtas (2 a 4 frases) — o cliente está de pé, na loja.

FLUXO DA CONVERSA:
1. Cumprimente brevemente e faça a primeira pergunta.
2. Faça de 2 a 4 perguntas, UMA por vez, sobre: para quem é o perfume, ocasião de uso, famílias olfativas/estilo e intensidade preferida.
3. Depois recomende de 2 a 4 perfumes do catálogo (campo recommendations com os ids exatos) e marque done=true.

REGRAS INEGOCIÁVEIS:
- Recomende APENAS produtos da lista CATÁLOGO abaixo, usando os ids exatos. Nunca invente produtos, preços ou marcas.
- Só afirme família olfativa, gênero, ocasião ou intensidade de um produto se esses dados constarem na lista. Produtos marcados com SEM_DADOS_OLFATIVOS não têm dados olfativos cadastrados: não atribua características de aroma a eles (pode citar apenas nome, marca, preço e a descrição fornecida).
- Prefira recomendar produtos que combinem com as respostas do cliente; se algo estiver com "últimas unidades", pode mencionar com delicadeza.
- Sempre ofereça quickReplies curtas e fáceis de tocar (o totem não tem teclado). Enquanto estiver perguntando, as quickReplies são as opções de resposta da sua pergunta.
- Não trate de assuntos fora de perfumaria e da loja; redirecione com gentileza.
- Na recomendação final (done=true): mencione brevemente por que cada perfume combina com o cliente, sem repetir a lista técnica.`;

  return [
    { type: 'text', text: persona },
    {
      type: 'text',
      text: `CATÁLOGO ATUAL DA LOJA (produtos com estoque):\n${catalog.summary}`,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0,
    )
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => {
  const catalog = getCatalog();
  res.json({
    ok: true,
    model: MODEL,
    produtosComEstoque: catalog.produtos.length,
    catalogGeneratedAt: catalog.generatedAt,
    anthropicKey: !!process.env.ANTHROPIC_API_KEY,
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

app.post('/api/chat', async (req, res) => {
  const history = sanitizeHistory(req.body?.messages);
  const messages =
    history.length > 0 && history[0].role === 'user'
      ? history
      : [{ role: 'user', content: 'Olá! Acabei de chegar ao totem.' }, ...history];

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: buildSystem(),
      messages,
      output_config: { format: { type: 'json_schema', schema: REPLY_SCHEMA } },
    });

    if (response.stop_reason === 'refusal') {
      res.json({
        message:
          'Desculpe, não consigo ajudar com isso. Que tal me contar para quem é o perfume que você procura?',
        quickReplies: ['É para mim', 'É um presente'],
        recommendations: [],
        done: false,
      });
      return;
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    const parsed = JSON.parse(textBlock?.text ?? '{}');

    // Garante que só ids reais e com estoque cheguem ao totem.
    const { validIds } = getCatalog();
    const recommendations = (parsed.recommendations ?? [])
      .map(String)
      .filter((id) => validIds.has(id))
      .slice(0, 4);

    res.json({
      message: typeof parsed.message === 'string' ? parsed.message : '',
      quickReplies: (parsed.quickReplies ?? []).map(String).slice(0, 6),
      recommendations,
      done: !!parsed.done,
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('[chat] ANTHROPIC_API_KEY inválida ou ausente.');
      res.status(502).json({ error: 'Configuração da IA inválida no servidor.' });
    } else if (err instanceof Anthropic.RateLimitError) {
      res.status(502).json({ error: 'Limite de uso da IA atingido. Tente em instantes.' });
    } else if (err instanceof Anthropic.APIError) {
      console.error(`[chat] Erro da API Anthropic (${err.status}): ${err.message}`);
      res.status(502).json({ error: 'O consultor está indisponível no momento.' });
    } else {
      console.error(`[chat] Erro inesperado: ${err.message}`);
      res.status(500).json({ error: 'Erro interno.' });
    }
  }
});

app.listen(PORT, '0.0.0.0', () => {
  const catalog = getCatalog();
  console.log(`\n[server] Consultor Le Parfum ouvindo em http://0.0.0.0:${PORT}`);
  console.log(`[server] Modelo: ${MODEL}`);
  console.log(`[server] Catálogo: ${catalog.produtos.length} produtos com estoque`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      '[server] ⚠ ANTHROPIC_API_KEY não definida — /api/chat vai falhar até configurá-la no sync/.env',
    );
  }
  console.log(
    '[server] No tablet, defina EXPO_PUBLIC_API_URL=http://IP_DESTE_PC:' + PORT + '\n',
  );
});
