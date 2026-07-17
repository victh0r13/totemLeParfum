# Le Parfum — Totem de Loja

App de totem para tablet (modo quiosque, orientação retrato) da perfumaria **Le Parfum**, com catálogo sincronizado do **Bling (API v3)** e quiz de perfumes.

## Arquitetura

```
App/
├── src/                    # App Expo (React Native + TypeScript, Expo Router)
│   ├── app/                # Telas: início, catálogo, detalhe, quiz, resultado
│   ├── components/         # UI compartilhada (cards, chips, toasts, animações)
│   ├── data/catalogStore   # Catálogo + enrichment com cache offline (AsyncStorage)
│   ├── kiosk/              # Timeout de inatividade (90s) + aviso "Ainda está aí?"
│   └── logic/              # Filtros, pontuação do quiz, formatação
├── data/
│   ├── catalog.json        # Gerado pelo sync a partir do Bling
│   └── enrichment.json     # Curadoria do totem: gênero/famílias/ocasiões — MANUAL
└── sync/                   # Backend Node.js (independente do app)
    ├── src/auth.js         # Autorização OAuth 2.0 do Bling (roda uma vez)
    ├── src/sync.js         # Gera data/catalog.json (produtos + estoque + categoria)
    └── src/server.js       # Servidor local: entrega catálogo/enrichment p/ o app
```

## Como rodar o app (Expo Go)

```bash
npm install
npx expo start
```

Escaneie o QR code com o **Expo Go** no tablet. Para o catálogo atualizar sem rebuild, o tablet precisa alcançar o servidor da loja (veja abaixo) e o app precisa saber o endereço dele:

```bash
# Windows (PowerShell) — use o IP do PC na rede local:
$env:EXPO_PUBLIC_API_URL = "http://192.168.0.10:3001"; npx expo start
```

> Sem `EXPO_PUBLIC_API_URL`, o app funciona 100% offline com o catálogo em cache/bundle.

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

O script busca **todos os produtos** (paginação completa, respeitando o limite de 3 req/s do Bling), consulta os **saldos de estoque** e gera `data/catalog.json` com `id, nome, marca, preço, estoque, categoria, imagem, descrição`. Ao final, lista os produtos com estoque que ainda **não têm enriquecimento** manual.

- Com o servidor (`npm run server`) no ar, o app baixa o catálogo novo sozinho ao abrir — sem rebuild.
- `SYNC_FETCH_DETAILS=false` no `.env` acelera o sync (pula marca/descrição/imagem/categoria detalhadas).

## 3) Servidor local do catálogo

```bash
cd sync
npm run server    # porta 3001 (configurável via PORT)
```

Inicie o app com `EXPO_PUBLIC_API_URL` apontando para o IP do PC (veja acima). Teste: `http://localhost:3001/health` deve responder `{"ok":true, ...}`.

## 4) Curadoria: preencher o enrichment.json

**O totem exibe SOMENTE os produtos com entrada no `enrichment.json`** — ele é a curadoria da loja física. O Bling não tem campos de gênero/família olfativa/ocasião, então eles são preenchidos manualmente aqui:

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
  }
}
```

As entradas ficam em **ordem alfabética pelo nome** — para tirar um produto do totem, ache-o pelo nome (Ctrl+F) e apague o bloco inteiro dele.

- Rode `npm run sync` para descobrir os IDs disponíveis (o relatório sai no terminal); a `categoria` de cada produto no `catalog.json` ajuda a identificar o gênero.
- Produtos **sem** entrada não aparecem no totem (nem no catálogo, nem no quiz). Para tirar um produto do totem, basta remover a entrada. **Nunca** deduza dados olfativos pelo nome — use as notas da descrição.
- Este arquivo **não** é tocado pelo sync; produtos com estoque zero são ocultados automaticamente mesmo com entrada aqui.

## Sync automático (Windows)

A tarefa agendada **"Le Parfum - Sync Bling"** roda `sync/run-sync.cmd` a cada 6 horas (a partir das 06:00) e regrava `data/catalog.json`; o log da última execução fica em `sync/last-sync.log`. O app, por sua vez, busca o catálogo novo no servidor local a cada 1 hora (`CATALOG_REFRESH_MS`).

```powershell
schtasks /Run /TN "Le Parfum - Sync Bling"     # testar agora
schtasks /Query /TN "Le Parfum - Sync Bling"   # conferir agendamento
schtasks /Delete /TN "Le Parfum - Sync Bling"  # remover
```

## Área da equipe (PIN)

O PIN da equipe está em `src/config.ts` (`ADMIN_PIN`).

- **Ofertas**: na página do perfume, toque no ícone **✎** ao lado do preço → PIN → defina o preço promocional (ou remova). O produto ganha o badge **OFERTA**, preço riscado e o promocional vale nos filtros de preço. As ofertas ficam salvas no próprio tablet (não alteram o Bling).
- **Painel da loja**: na tela inicial, **segure o logo "Le Parfum" por ~1,5s** → PIN. Mostra as ofertas ativas, os perfumes mais vistos, os pedidos de amostra, as respostas do quiz e o botão de zerar métricas. As métricas são 100% locais (AsyncStorage) — nada sai do aparelho.

## Pirâmide olfativa

A tela de detalhe extrai automaticamente as notas de **topo/coração/fundo** quando a descrição do Bling as traz de forma estruturada ("Notas de topo: ..."), exibindo-as como pirâmide e removendo o trecho duplicado do texto. Descrições sem notas estruturadas seguem exibidas como texto normal — para ganhar a pirâmide, edite a descrição no Bling incluindo "Notas de topo/coração/fundo: ...".

## Build de produção (APK para o totem)

O Expo Go serve para desenvolver; o totem final deve rodar um APK standalone:

```bash
npm install -g eas-cli
eas login          # conta Expo (grátis)
eas build -p android --profile totem
```

O perfil `totem` (eas.json) gera um **APK** instalável direto no tablet (link de download ao final do build). Antes de buildar, defina a URL do servidor da loja para ficar embutida no app:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://IP_DO_PC:3001"; eas build -p android --profile totem
```

Depois de instalar, ative o **modo quiosque do Android** para prender o app na tela:
1. Configurações → Segurança → **Fixação de tela** (screen pinning): ative e fixe o app; ou
2. Para algo mais robusto, use um launcher de quiosque (ex.: *Fully Kiosk Browser* não serve para app nativo — prefira **SureLock** ou o modo *dedicated device* do Android Enterprise).

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
| `npm run server`    | Sobe o servidor local do catálogo           |

## Segurança

- `.env`, `sync/.env` e `sync/.tokens.json` estão no `.gitignore` — **nunca** commite credenciais.
- As credenciais do Bling existem apenas no servidor (`/sync`); o app do tablet fala somente com o servidor local.
