# Le Parfum — Totem de Loja

App de totem para tablet (modo quiosque, orientação retrato) da perfumaria **Le Parfum**, com catálogo sincronizado do **Bling (API v3)**, quiz de perfumes e **consultor virtual com IA (Claude)**.

## Arquitetura

```
App/
├── src/                    # App Expo (React Native + TypeScript, Expo Router)
│   ├── app/                # Telas: início, experiência, catálogo, detalhe, quiz, resultado, chat
│   ├── components/         # UI compartilhada (cards, chips, toasts, animações)
│   ├── data/catalogStore   # Catálogo + enrichment com cache offline (AsyncStorage)
│   ├── kiosk/              # Timeout de inatividade (90s) + aviso "Ainda está aí?"
│   ├── logic/              # Filtros, pontuação do quiz, formatação
│   └── api/consultant.ts   # Cliente do consultor (fala com /sync, nunca com a Anthropic)
├── data/
│   ├── catalog.json        # Gerado pelo sync (vem com dados demo até o 1º sync)
│   └── enrichment.json     # Gênero/famílias/ocasiões — preenchido MANUALMENTE
└── sync/                   # Backend Node.js (independente do app)
    ├── src/auth.js         # Autorização OAuth 2.0 do Bling (roda uma vez)
    ├── src/sync.js         # Gera data/catalog.json (produtos + estoque)
    └── src/server.js       # Servidor local: catálogo p/ o app + proxy da IA
```

## Como rodar o app (Expo Go)

```bash
npm install
npx expo start
```

Escaneie o QR code com o **Expo Go** no tablet. Para o consultor virtual funcionar, o tablet precisa alcançar o servidor da loja (veja abaixo) e o app precisa saber o endereço dele:

```bash
# Windows (PowerShell) — use o IP do PC na rede local:
$env:EXPO_PUBLIC_API_URL = "http://192.168.0.10:3001"; npx expo start
```

> Sem `EXPO_PUBLIC_API_URL`, o app funciona 100% offline (catálogo + quiz); o consultor exibe uma mensagem amigável sugerindo o quiz.

## 1) Primeira autorização OAuth do Bling (roda uma vez)

1. Copie `sync/.env.example` para `sync/.env` e preencha `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET` e `BLING_REDIRECT_URI` (deve ser exatamente o cadastrado no app do Bling, ex.: `http://localhost:3000/callback`).
2. Rode:
   ```bash
   cd sync
   npm install   # só na primeira vez
   npm run auth
   ```
3. O navegador abre a tela de autorização do Bling — faça login e autorize.
4. Os tokens ficam em `sync/.tokens.json` (ignorado pelo git). O `access_token` renova sozinho via `refresh_token`; só é preciso repetir o `npm run auth` se o refresh_token expirar (~30 dias sem uso).

## 2) Sincronizar o catálogo (preços/estoque)

```bash
cd sync
npm run sync      # ou, da raiz do projeto: npm run sync
```

O script busca **todos os produtos** (paginação completa, respeitando o limite de 3 req/s do Bling), consulta os **saldos de estoque** e gera `data/catalog.json` com `id, nome, marca, preço, estoque, imagem, descrição`. Ao final, lista os produtos que ainda **não têm enriquecimento** manual.

- Produtos com estoque zero são ocultados pelo app automaticamente.
- Com o servidor (`npm run server`) no ar, o app baixa o catálogo novo sozinho ao abrir — sem rebuild.
- `SYNC_FETCH_DETAILS=false` no `.env` acelera o sync (pula marca/descrição/imagem detalhadas).

## 3) Consultor virtual (Claude)

1. No `sync/.env`, preencha `ANTHROPIC_API_KEY` (crie em https://platform.claude.com). A chave fica **somente no servidor** — nunca no tablet.
2. Suba o servidor da loja:
   ```bash
   cd sync
   npm run server    # porta 3001 (configurável via PORT)
   ```
3. Inicie o app com `EXPO_PUBLIC_API_URL` apontando para o IP do PC (veja acima).
4. Teste: `http://localhost:3001/health` deve responder `{"ok":true, ...}`.

O servidor injeta o catálogo real (só produtos com estoque) no contexto do Claude e valida os IDs recomendados — o consultor não consegue inventar produtos nem características olfativas que não estejam no `enrichment.json`.

## 4) Preencher o enrichment.json (novos produtos)

O Bling não tem campos de gênero/família olfativa/ocasião — eles são preenchidos manualmente em `data/enrichment.json`:

```jsonc
{
  "produtos": {
    "12345678901": {                        // ID do produto no Bling (ou o SKU/código)
      "genero": "F",                        // F | M | U
      "familias": ["floral", "doce"],       // floral|citrico|amadeirado|doce|oriental|fresco
      "ocasioes": ["dia", "noite"],         // trabalho|dia|noite|esporte
      "intensidade": 2                      // 1 leve | 2 moderada | 3 marcante
    }
  }
}
```

- Rode `npm run sync` para descobrir os IDs que faltam (o relatório sai no terminal).
- Produtos **sem** entrada continuam visíveis no catálogo (com preço/estoque/descrição), mas ficam fora dos filtros de família/gênero/ocasião, do quiz e das recomendações do consultor. **Nunca** deduza dados olfativos pelo nome.
- Este arquivo **não** é tocado pelo sync.

## Modo quiosque

- Orientação **travada em retrato** (app.json + expo-screen-orientation).
- Tela **nunca dorme** (expo-keep-awake).
- **90s de inatividade** → overlay "Ainda está aí?" com contagem regressiva de 15s → volta à tela inicial e limpa a sessão (o toque em qualquer lugar reinicia o cronômetro).
- Botão **Recomeçar** discreto no canto superior direito de todas as telas.

## Scripts úteis (raiz)

| Comando             | O que faz                                   |
| ------------------- | ------------------------------------------- |
| `npx expo start`    | Roda o app (Expo Go)                        |
| `npm run typecheck` | Verifica os tipos (tsc)                     |
| `npm run auth`      | Autorização OAuth do Bling (via /sync)      |
| `npm run sync`      | Sincroniza o catálogo com o Bling           |
| `npm run server`    | Sobe o servidor do consultor/catálogo       |

## Segurança

- `.env`, `sync/.env` e `sync/.tokens.json` estão no `.gitignore` — **nunca** commite credenciais.
- A `ANTHROPIC_API_KEY` e as credenciais do Bling existem apenas no servidor (`/sync`); o app do tablet fala somente com o servidor local.
