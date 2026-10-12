# Le Parfum — Totem de Loja

App de totem para tablet (modo quiosque, orientação retrato) da perfumaria **Le Parfum**, com catálogo sincronizado do **Bling (API v3)** — perfumes, body splash, corpo & banho e kits — e quiz de perfumes.

O app é **offline-first**: ele abre completo — catálogo, preços e fotos — sem nenhuma rede. O servidor da loja é uma atualização em segundo plano, nunca um requisito. Veja [docs/OFFLINE-FIRST.md](docs/OFFLINE-FIRST.md) para a receita completa.

## Funcionalidades concluídas

- **Tela inicial** — vitrine de destaques com troca automática (ofertas primeiro), navegação por categoria e por marca, e **modo atração** em tela cheia depois de 45s parado.
- **Catálogo multiproduto** — 423 produtos à venda (de 1.224 no Bling) em quatro abas: perfumes, body splash, corpo & banho e kits. Busca por nome/marca e filtros combinados de marca, gênero, família olfativa e faixa de preço.
- **Detalhe do produto** — foto, preço, descrição, pirâmide olfativa (topo/coração/fundo) extraída da descrição do Bling, similares do mesmo tipo e **"Combina com"**: o body splash, o hidratante e o kit da mesma linha.
- **Quiz de recomendação** — 6 perguntas visuais, pontuação ponderada; devolve de 3 a 5 perfumes reais, destaca a melhor escolha, explica **por que** cada um apareceu e sugere produtos da mesma linha para completar.
- **Sincronização com o Bling (API v3 / OAuth 2.0)** — sync rápido a cada 5 min (preço e estoque) e sync completo diário (descrições, fotos, produtos novos, curadoria).
- **Tempo real** — push por WebSocket quando o catálogo muda, sem botão de atualizar.
- **Offline-first** — o app abre completo (catálogo, preços e 407 fotos) sem nenhuma rede. Também roda **sem servidor nenhum**: o APK sozinho é o catálogo (veja [Tablet sem servidor](#tablet-sem-servidor)).
- **Cadastro de produtos da loja** — CRUD no próprio totem, com fila de pendências offline e resolução de conflito por *last-write-wins*.
- **Ofertas** — preço promocional definido pela equipe no tablet, sem alterar o Bling.
- **Painel da loja** (PIN) — status e frescor do catálogo, produtos por tipo, origem dos dados (app/cache/servidor), saúde das rotinas de sync, mais vistos e respostas do quiz.
- **Modo quiosque** — orientação travada em retrato, tela sempre acesa, timeout de inatividade de 90s com retorno ao início, modo atração na tela inicial.
- **162 testes automatizados** (Vitest) sobre a lógica de negócio pura, incluindo o classificador de tipo de produto do sync.

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
│   └── logic/                    # Filtros, quiz, vitrine, notas, marcas, métricas
├── data/
│   ├── catalog.json              # Catálogo bruto do Bling (gerado pelo sync)
│   ├── enrichment.json           # Curadoria: tipo/gênero/famílias/ocasiões/intensidade
│   ├── catalog.bundle.json       # GERADO: curadoria empacotada no APK
│   └── images/                   # GERADO: fotos baixadas do Bling (~11 MB)
└── sync/                         # Backend Node.js (independente do app)
    ├── src/auth.js               # Autorização OAuth 2.0 do Bling (roda uma vez)
    ├── src/sync.js               # Bling → data/catalog.json
    ├── src/curate.js             # Completa lacunas da curadoria + inclui produtos novos
    ├── src/tipos.js              # Deduz o tipo (perfume, body splash...) pelo nome/categoria
    ├── src/images.js             # Baixa e redimensiona as fotos → data/images/
    ├── src/bundle.js             # Gera o recorte que vai dentro do APK
    └── src/server.js             # Servidor local: /api/totem e /images/:id
```

## Tecnologias e bibliotecas

| Camada | Tecnologia |
| ------ | ---------- |
| App | React Native 0.86 · React 19 · TypeScript · **Expo SDK 57** |
| Navegação | `expo-router` (roteamento por arquivos, com deep links) |
| Armazenamento | `@react-native-async-storage/async-storage` · `expo-file-system` |
| Imagens | `expo-image` · `expo-image-picker` · `expo-image-manipulator` |
| Animação e gestos | `react-native-reanimated` · `react-native-gesture-handler` · `react-native-screens` |
| Modo quiosque | `expo-screen-orientation` · `expo-keep-awake` |
| Tipografia | `@expo-google-fonts/cormorant-garamond` · `@expo-google-fonts/manrope` |
| Servidor (`/sync`) | Node.js · Express · `ws` (WebSocket) · `sharp` (redimensionamento) |
| Integração | Bling API v3 (REST, OAuth 2.0) |
| Testes | Vitest — 162 testes sobre a lógica pura |
| Qualidade | TypeScript estrito · ESLint (`eslint-config-expo`) |
| Build Android | Expo CNG (`expo prebuild`) + Gradle, JDK 17 |

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

### Tablet sem servidor

O APK gerado **sem** `EXPO_PUBLIC_API_URL` é autossuficiente: catálogo, preços e fotos vão dentro dele, e ofertas e cadastros da loja ficam salvos no próprio tablet. É o modo para um tablet avulso, sem PC na loja. Nesse modo:

- o catálogo é o do dia do build — para atualizar preços e produtos, rode `npm run atualizar`, gere um APK novo e instale **por cima** (os dados do tablet são mantidos);
- o indicador de estoque ("Últimas unidades") some, porque o número congelado no build enganaria a cliente;
- o painel da loja explica isso no lugar do status do servidor.

Ao instalar um APK novo, o catálogo empacotado vence qualquer cópia antiga guardada no tablet.

### No emulador: `dev.ps1`

O `.\dev.ps1` sobe de uma vez o emulador, os túneis `adb reverse`, o servidor da loja e o Metro — cada serviço na sua janela. É idempotente: o que já estiver de pé é reaproveitado.

| Comando | O que faz |
| ------- | --------- |
| `.\dev.ps1` | Sobe tudo (emulador `Medium_Tablet`, portas 3001 e 8081) |
| `.\dev.ps1 -Avd Pixel_8` | Outro emulador |
| `.\dev.ps1 -ApiUrl http://10.0.2.2:3002 -PortaMetro 8082` | Portas próprias, para conviver com outro projeto |
| `.\dev.ps1 -Parar` | Derruba servidor e Metro **deste** projeto e remove os túneis |

### Convivendo com outros projetos

As portas 3001 e 8081 são as mesmas que qualquer projeto Expo/Node usa. Se outro projeto as ocupar, o app fala com o servidor errado e falha **em silêncio**: o painel só mostra "sem conexão" e a sincronização não acontece. O `dev.ps1` sobe a árvore de processos para descobrir de quem é a porta e **para em vermelho** em vez de seguir por cima — mas ele só sabe avisar. Dois caminhos:

**Alternar** — rode `.\dev.ps1 -Parar` antes de ir para o outro projeto. Libera as duas portas e remove os `adb reverse`. O emulador continua ligado de propósito: é compartilhado e demora demais para subir (`adb emu kill` derruba, se quiser).

**Coexistir** — dê portas próprias a este projeto e deixe os dois de pé:

```powershell
.\dev.ps1 -ApiUrl http://10.0.2.2:3002 -PortaMetro 8082
```

Dentro do aparelho o Metro continua sendo o 8081 — é onde o dev client procura o bundle; quem traduz é o túnel (`8081 do aparelho → 8082 do PC`). Como o script mira o emulador pelo serial do AVD (`adb -s`), dois emuladores rodam lado a lado sem um roubar os túneis do outro.

> Se os dois apps rodarem no **mesmo** emulador, os servidores e Metros convivem sem problema, mas a porta 8081 *do aparelho* só aponta para um Metro por vez — rode o `dev.ps1` do projeto que quer usar para reapontar o túnel (é instantâneo, não reinicia nada).

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
npm run atualizar     # = sync → curar → images → bundle
```

| Etapa            | Comando            | O que faz                                                        |
| ---------------- | ------------------ | ---------------------------------------------------------------- |
| 1. Sync          | `npm run sync`     | Bling → `data/catalog.json` (preços, estoque, categoria, descrição) |
| 2. Curadoria     | `npm run curar`    | Inclui produtos novos, classifica o tipo e completa gênero/família |
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
      "tipo": "perfume",                    // perfume | body-splash | corpo | kit
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
- **`npm run curar`** inclui automaticamente todo produto à venda (estoque e preço) cujo **tipo** entra no totem, e preenche o que der para deduzir com segurança (categoria, nome, notas da descrição). **Nunca sobrescreve** um valor já existente.
- **O tipo** é deduzido pelo nome primeiro e pela categoria do Bling depois ([sync/src/tipos.js](sync/src/tipos.js)) — as categorias do Bling misturam tipo com marca e um terço dos produtos não tem categoria. Maquiagem, capilar e vale-presente ficam de fora (`TIPOS_NO_TOTEM`).
- Produtos com estoque zero ou **preço zero** somem do totem sozinhos, mesmo com entrada aqui. Preço zero no Bling costuma ser uma variação "com composição", um atalho para o produto real, que já entra por conta própria.
- Variações do Bling ("Body Splash Lattafa (Escolha o seu) Fragrância:Yara") aparecem no totem como **"Yara · Body Splash Lattafa"**, e herdam a marca citada no nome quando chegam sem marca.

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

- **Ofertas**: na página do produto, toque no ícone **✎** ao lado do preço → PIN → defina o preço promocional (ou remova). O produto ganha o badge **OFERTA**, preço riscado, e o promocional passa a valer nos filtros de preço. As ofertas ficam salvas no próprio tablet (não alteram o Bling).
- **Painel da loja**: na tela inicial, **segure o logo "Le Parfum" por ~1,5s** → PIN. Mostra:
  - **Status do catálogo** — quantos produtos (e de que tipo), de quando são os preços, de onde vieram os dados (app / cache / servidor), se o servidor está alcançável, quantas fotos estão dentro do app, e um botão **Atualizar agora** (só com servidor);
  - ofertas ativas, mais vistos, respostas do quiz e o botão de zerar métricas.
- As métricas são 100% locais (AsyncStorage) — nada sai do aparelho.

## Quiz

Seis perguntas: para quem, **gênero**, ocasião, intensidade, famílias (até 2) e estilo. O quiz recomenda só **perfume** — body splash e hidratante têm outra lógica de compra e aparecem em "Para completar". O gênero **filtra** o resultado (unissex sempre entra; produto sem gênero na curadoria não é descartado, só pontua menos) — as demais respostas pontuam, e bater as duas famílias pedidas vale mais que bater uma. O resultado mostra de 3 a 5 perfumes reais, com estoque: a melhor escolha em destaque, os motivos de cada sugestão ("Doce e Oriental · Para a noite · Marcante") e os produtos da mesma linha da melhor escolha.

## Pirâmide olfativa

A tela de detalhe extrai as notas de **topo/coração/fundo** quando a descrição do Bling as traz de forma estruturada ("Notas de topo: ..."), exibindo-as como pirâmide e removendo o trecho duplicado do texto. Descrições sem notas estruturadas seguem como texto normal — para ganhar a pirâmide, edite a descrição no Bling.

## Modo quiosque

- Orientação **travada em retrato** (app.json + expo-screen-orientation).
- Tela **nunca dorme** (expo-keep-awake).
- **Modo atração**: 45s parado na tela inicial → vitrine em tela cheia, fundo escuro, produtos se revezando; qualquer toque volta.
- **90s de inatividade** fora da tela inicial → overlay "Ainda está aí?" com contagem de 15s → volta ao início e limpa a sessão.
- Botão **Recomeçar** discreto no canto superior direito de todas as telas.
- No Android, ative a **Fixação de tela** para prender o app (veja [docs/BUILD-ANDROID.md](docs/BUILD-ANDROID.md)).

## Scripts (raiz)

| Comando              | O que faz                                            |
| -------------------- | ---------------------------------------------------- |
| `npx expo start`     | Roda o app (Expo Go)                                 |
| `npm run typecheck`  | Verifica os tipos (tsc)                              |
| `npm run lint`       | ESLint                                               |
| `npm run auth`       | Autorização OAuth do Bling                           |
| `npm run atualizar`  | **sync + curar + images + bundle** (pipeline completo) |
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

## Limitações conhecidas e pendências

- **O PIN da equipe (`ADMIN_PIN`) fica no bundle do app.** É trava de conveniência contra o cliente curioso, não controle de acesso — qualquer APK é extraível. Uma área administrativa de verdade exigiria autenticação no servidor.
- **O servidor local não tem autenticação.** Roda na rede da loja, atrás do roteador. Exposto à internet, as rotas de escrita precisariam de token.
- **Ofertas e métricas são por aparelho.** Com mais de um totem, cada um tem as suas; ainda não sincronizam entre si.
- **O totem não vende nem chama o atendente.** Os botões "Quero experimentar" e "Chamar atendente" foram retirados porque só exibiam um aviso, sem notificar ninguém. Um chamado de verdade precisa de um destino (celular da equipe, tela no balcão) e, portanto, de servidor.
- **No tablet sem servidor, o catálogo envelhece.** Preço e produtos são os do dia do APK; atualizar exige gerar e instalar um APK novo.
- **A classificação olfativa é semiautomática.** O `npm run curar` deduz o que dá para deduzir com segurança e nunca sobrescreve valor curado à mão, mas produtos novos podem entrar sem família ou ocasião até alguém revisar.
- **A pirâmide olfativa depende da descrição do Bling.** Só aparece quando as notas vêm estruturadas ("Notas de topo: ..."); as demais seguem como texto normal.
- **As URLs de imagem do Bling gravadas em `data/catalog.json` expiram em ~7 dias.** Elas são apenas o último elo da cadeia de fallback — as fotos exibidas vêm do APK ou do servidor local.
- **Validado apenas em Android.** O código é multiplataforma (Expo), mas não houve build nem teste em iOS.
- **Histórico de commits enxuto.** O desenvolvimento foi commitado por sessão de trabalho, não por unidade lógica — o commit de 01/08 concentra boa parte das mudanças, o que dificulta a revisão granular.
