# Le Parfum — Totem de Loja

App de totem para tablet (modo quiosque, orientação retrato) da perfumaria **Le Parfum**, com catálogo sincronizado do **Bling (API v3)** e quiz de perfumes.

O app é **offline-first**: ele abre completo — catálogo, preços e fotos — sem nenhuma rede. O servidor da loja é uma atualização em segundo plano, nunca um requisito. Veja [docs/OFFLINE-FIRST.md](docs/OFFLINE-FIRST.md) para a receita completa.

## Arquitetura

```
App/
├── src/                          # App Expo (React Native + TypeScript, Expo Router)
│   ├── app/                      # Telas: início, catálogo, detalhe, quiz, resultado, admin
│   ├── components/               # UI compartilhada (cards, chips, toasts, animações)
│   ├── data/catalogStore.tsx     # Catálogo em 3 camadas: bundle → cache → servidor
│   ├── data/images.ts            # Cadeia de origens da foto + prefetch para disco
│   ├── data/bundledImages.ts     # GERADO: mapa id → require() das fotos no APK
│   ├── kiosk/                    # Timeout de inatividade (90s) + "Ainda está aí?"
│   └── logic/                    # Filtros, pontuação do quiz, notas, métricas
├── data/
│   ├── catalog.json              # Catálogo bruto do Bling (gerado pelo sync)
│   ├── enrichment.json           # Curadoria: gênero/famílias/ocasiões/intensidade
│   ├── catalog.bundle.json       # GERADO: curadoria empacotada no APK
│   └── images/                   # GERADO: fotos baixadas do Bling (~5,6 MB)
└── sync/                         # Backend Node.js (independente do app)
    ├── src/auth.js               # Autorização OAuth 2.0 do Bling (roda uma vez)
    ├── src/sync.js               # Bling → data/catalog.json
    ├── src/curate.js             # Completa lacunas da curadoria + inclui perfumes novos
    ├── src/images.js             # Baixa e redimensiona as fotos → data/images/
    ├── src/bundle.js             # Gera o recorte que vai dentro do APK
    └── src/server.js             # Servidor local: /api/totem e /images/:id
```

## Como rodar o app

```bash
npm install
npx expo start
```

Escaneie o QR code com o **Expo Go** no tablet. Para o catálogo atualizar sem rebuild, o tablet precisa alcançar o servidor da loja:

```powershell
# Windows (PowerShell) — use o IP do PC na rede local:
$env:EXPO_PUBLIC_API_URL = "http://192.168.0.10:3001"; npx expo start
```

> Sem `EXPO_PUBLIC_API_URL`, o app funciona 100% offline com o catálogo e as fotos empacotados.

Para gerar o APK do totem, veja **[docs/BUILD-ANDROID.md](docs/BUILD-ANDROID.md)**.

## Sincronização em tempo real

Preço e estoque chegam ao totem em **segundos**, sem ninguém tocar em nada. São duas velocidades:

```
Bling ──5 min──▶ quick.js ──escreve──▶ catalog.json ──fs.watch──▶ servidor
                                                                      │
                                                            WebSocket │ (push)
                                                                      ▼
                                                                   TOTEM
                                                            refaz o fetch na hora
```

| Rotina | Cadência | Duração | O que traz |
| ------ | -------- | ------- | ---------- |
| **Sync rápido** (`npm run quick`) | 5 min | ~18s | Preço e estoque |
| **Sync completo** (`npm run atualizar`) | 1×/dia às 05:00 | ~8 min | Descrições, fotos, produtos novos, curadoria |

Por que dividir: o sync completo pede o detalhe de cada um dos 1.161 produtos (350ms cada = ~7 min), porque precisa de descrição, foto e categoria — campos que quase nunca mudam. Preço e estoque vêm da listagem + do endpoint de saldos: 45 requisições, 18 segundos. Separando os dois, dá para rodar o que importa de 5 em 5 minutos sem estourar o limite de 3 req/s do Bling.

O `quick.js` **só regrava o `catalog.json` quando algo mudou de verdade** — e é essa escrita que o servidor observa (`fs.watch`) para avisar os totens pelo WebSocket. Sem mudança, ninguém é acordado à toa.

O WebSocket **não substitui o offline-first**: se o servidor cair, o app reconecta sozinho com backoff (até 30s) e segue mostrando o cache. O refetch de hora em hora continua como rede de segurança.

## Fluxo de atualização do catálogo

Um comando faz tudo:

```bash
npm run atualizar     # = sync → images → bundle
```

| Etapa            | Comando            | O que faz                                                        |
| ---------------- | ------------------ | ---------------------------------------------------------------- |
| 1. Sync          | `npm run sync`     | Bling → `data/catalog.json` (preços, estoque, categoria, descrição) |
| 2. Curadoria     | `npm run curar`    | Inclui perfumes novos e completa gênero/família que faltam        |
| 3. Fotos         | `npm run images`   | Baixa as fotos novas, redimensiona p/ 800px → `data/images/`      |
| 4. Bundle        | `npm run bundle`   | Gera `catalog.bundle.json` + `bundledImages.ts` (só p/ novo APK)  |

**Por que as fotos são baixadas:** as URLs de imagem do Bling são links S3 **pré-assinados que expiram em ~7 dias** (`?Expires=...`). Guardar a URL faz o totem perder todas as fotos uma semana depois. Baixando os arquivos, as fotos viram um ativo local — vão dentro do APK e são servidas pelo servidor da loja.

## 1) Primeira autorização OAuth do Bling (roda uma vez)

1. Copie `sync/.env.example` para `sync/.env` e preencha `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET` e `BLING_REDIRECT_URI` (exatamente o cadastrado no app do Bling — atenção: o Bling redireciona para a **raiz**, ex.: `http://localhost:3000`).
2. Rode:
   ```bash
   cd sync
   npm install   # só na primeira vez
   npm run auth
   ```
3. O navegador abre a tela de autorização do Bling — faça login e autorize (o código expira em ~1 min).
4. Os tokens ficam em `sync/.tokens.json` (fora do git). O `access_token` renova sozinho via `refresh_token`; só é preciso repetir o `npm run auth` se o refresh_token expirar (~30 dias sem uso).

## 2) Servidor local do catálogo

```bash
cd sync
npm run server    # porta 3001 (configurável via PORT)
```

| Rota              | Para que serve                                                   |
| ----------------- | ---------------------------------------------------------------- |
| `/health`         | Diagnóstico: nº de produtos, nº de fotos, data do catálogo        |
| `/api/totem`      | O que o app consome: curadoria + enrichment (mesma forma do bundle) |
| `/images/:id`     | Foto do produto pelo id do Bling                                  |
| `/api/catalog`    | Catálogo bruto (depuração)                                        |
| `/api/enrichment` | Curadoria completa (depuração)                                    |

Teste: `http://localhost:3001/health` deve responder `{"ok":true, ...}`.

## 3) Curadoria (enrichment.json)

**O totem exibe SOMENTE os produtos com entrada no `enrichment.json`** — ele é a curadoria da loja física. O Bling não tem campos de gênero/família olfativa/ocasião:

```jsonc
{
  "produtos": {
    "12345678901": {                        // ID do produto no Bling (ou o SKU/código)
      "nome": "Yara - Lattafa EDP 100ml",   // só para você se localizar — o app ignora
      "genero": "F",                        // F | M | U
      "familias": ["floral", "doce"],       // floral|citrico|amadeirado|doce|oriental|fresco
      "ocasioes": ["dia", "noite"],         // trabalho|dia|noite|esporte
      "intensidade": 2                      // 1 leve | 2 moderada | 3 marcante
    }
  },
  "_autoIncluidos": ["..."]                 // controle do `npm run curar` — não edite
}
```

- **Para tirar um produto do totem:** apague o bloco dele (ache pelo nome com Ctrl+F). O `curar` respeita a remoção e não o traz de volta — é para isso que serve o `_autoIncluidos`.
- **`npm run curar`** inclui automaticamente todo produto com estoque cuja categoria do Bling contenha "perfume", e preenche o que der para deduzir com segurança (categoria, nome, notas da descrição). **Nunca sobrescreve** um valor já existente.
- Produtos com estoque zero somem do totem sozinhos, mesmo com entrada aqui.

## Sync automático (Windows)

**O agendamento vive dentro do servidor** ([sync/src/scheduler.js](sync/src/scheduler.js)). Basta manter `npm run server` rodando:

| Rotina | Cadência | O que faz |
| ------ | -------- | --------- |
| Sync rápido | a cada 5 min (`SYNC_QUICK_MIN`) | preço e estoque |
| Sync completo | diário às 05:00 | sync + curadoria + fotos |

Não há tarefa do Agendador do Windows, `.cmd` nem janela de console piscando. Isso foi uma decisão consciente: a versão anterior usava `schtasks` e tinha três defeitos — abria um `cmd` a cada 5 minutos na cara do usuário, só funcionava no Windows, e o agendamento vivia fora do repositório (invisível em code review, impossível de versionar).

Para ver se as rotinas estão saudáveis, o `/health` responde o estado de cada uma:

```bash
curl http://localhost:3001/health
# → "agenda": { "sync rápido": { "rodando": false, "ultimaExecucao": "...", "ultimoErro": null } }
```

O mesmo aparece no painel da loja, dentro do totem.

## Área da equipe (PIN)

O PIN da equipe está em `src/config.ts` (`ADMIN_PIN`).

- **Ofertas**: na página do perfume, toque no ícone **✎** ao lado do preço → PIN → defina o preço promocional (ou remova). O produto ganha o badge **OFERTA**, preço riscado, e o promocional passa a valer nos filtros de preço. As ofertas ficam salvas no próprio tablet (não alteram o Bling).
- **Painel da loja**: na tela inicial, **segure o logo "Le Parfum" por ~1,5s** → PIN. Mostra:
  - **Status do catálogo** — quantos perfumes, de quando são os preços, de onde vieram os dados (app / cache / servidor), se o servidor está alcançável, quantas fotos estão dentro do app, e um botão **Atualizar agora**;
  - ofertas ativas, perfumes mais vistos, pedidos de amostra, respostas do quiz e o botão de zerar métricas.
- As métricas são 100% locais (AsyncStorage) — nada sai do aparelho.

## Quiz

Cinco perguntas: para quem, **gênero**, ocasião, intensidade, famílias (até 2) e estilo. O gênero **filtra** o resultado (unissex sempre entra; produto sem gênero na curadoria não é descartado, só pontua menos) — as demais respostas pontuam. O resultado mostra de 3 a 5 perfumes reais, com estoque, do mais para o menos aderente.

## Pirâmide olfativa

A tela de detalhe extrai as notas de **topo/coração/fundo** quando a descrição do Bling as traz de forma estruturada ("Notas de topo: ..."), exibindo-as como pirâmide e removendo o trecho duplicado do texto. Descrições sem notas estruturadas seguem como texto normal — para ganhar a pirâmide, edite a descrição no Bling.

## Modo quiosque

- Orientação **travada em retrato** (app.json + expo-screen-orientation).
- Tela **nunca dorme** (expo-keep-awake).
- **90s de inatividade** → overlay "Ainda está aí?" com contagem de 15s → volta ao início e limpa a sessão.
- Botão **Recomeçar** discreto no canto superior direito de todas as telas.
- No Android, ative a **Fixação de tela** para prender o app (veja [docs/BUILD-ANDROID.md](docs/BUILD-ANDROID.md)).

## Scripts (raiz)

| Comando              | O que faz                                            |
| -------------------- | ---------------------------------------------------- |
| `npx expo start`     | Roda o app (Expo Go)                                 |
| `npm run typecheck`  | Verifica os tipos (tsc)                              |
| `npm run lint`       | ESLint                                               |
| `npm run auth`       | Autorização OAuth do Bling                           |
| `npm run atualizar`  | **sync + images + bundle** (pipeline completo)       |
| `npm run quick`      | Só preço e estoque (~18s)                            |
| `npm run test`       | Suíte de testes (vitest)                             |
| `npm run sync`       | Só o catálogo do Bling                               |
| `npm run images`     | Só as fotos                                          |
| `npm run bundle`     | Só o recorte que vai no APK                          |
| `npm run server`     | Sobe o servidor local do catálogo                    |

## Segurança

- `.env`, `sync/.env` e `sync/.tokens.json` estão no `.gitignore` — **nunca** commite credenciais.
- As credenciais do Bling existem apenas no servidor (`/sync`); o tablet fala somente com o servidor local.
- O `ADMIN_PIN` vai dentro do bundle do app: é uma trava de conveniência contra o cliente curioso, **não** um controle de acesso de verdade.
