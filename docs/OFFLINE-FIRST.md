# Offline-first: a receita

Como este app foi construído para funcionar sem rede, e como repetir isso em outro projeto Expo (por exemplo, um app de Bíblia).

---

## O princípio

Aplicativo comum:

> busco no servidor → se falhar, mostro erro

Aplicativo offline-first:

> **leio do meu dado local → e sincronizo com o servidor em segundo plano**

A rede vira uma *otimização*, não uma dependência. Consequências práticas:

- o app abre instantaneamente, sem spinner esperando HTTP;
- Wi-Fi caindo não quebra nada — degrada em silêncio;
- o que o usuário escreve nunca se perde: fica local e sobe depois.

A pergunta que guia tudo: **"se a rede nunca funcionar, o que o usuário vê?"** Se a resposta for "uma tela vazia", o desenho está errado.

---

## As três camadas

Toda leitura passa por esta cascata, **sempre nesta ordem**:

```
1. BUNDLE    dentro do APK       → funciona em aparelho recém-formatado, modo avião
2. CACHE     no aparelho         → última versão que o app conseguiu baixar
3. SERVIDOR  em segundo plano    → atualiza o cache; falhar aqui não afeta a tela
```

O truque que faz isso ficar simples: **as três camadas usam exatamente o mesmo formato de dado.** Aqui é o tipo `TotemPayload` ([src/types/catalog.ts](../src/types/catalog.ts)). O bundle é um JSON com essa forma, o cache guarda essa forma, e o endpoint `/api/totem` devolve essa forma. Com isso o app não tem três caminhos de código — tem um só, trocando a fonte.

Implementação: [src/data/catalogStore.tsx](../src/data/catalogStore.tsx).

```tsx
// 1. Estado inicial JÁ é o bundle — a tela nunca começa vazia.
const [payload, setPayload] = useState<TotemPayload>(bundledCatalog);

useEffect(() => {
  (async () => {
    // 2. Cache do aparelho, se houver, substitui o bundle.
    const cached = await AsyncStorage.getItem(PAYLOAD_KEY);
    if (cached) setPayload(JSON.parse(cached));
    setLoading(false);          // a UI já pode aparecer aqui

    // 3. Só agora a rede — e o resultado dela é opcional.
    await refresh();
  })();
}, []);

const refresh = async () => {
  try {
    const remoto = await fetchJson(`${API_URL}/api/totem`);
    setPayload(remoto);
    await AsyncStorage.setItem(PAYLOAD_KEY, JSON.stringify(remoto));
    setOnline(true);
  } catch {
    setOnline(false);           // não relança, não mostra erro, não limpa nada
  }
};
```

Três detalhes que fazem diferença:

1. **`setLoading(false)` acontece antes da rede.** Se ele estivesse depois do `await refresh()`, o app ficaria travado no spinner por 6 segundos toda vez que o servidor estivesse fora.
2. **O `catch` é vazio de propósito.** Falha de rede não é um erro do ponto de vista do usuário — é o estado normal do app.
3. **Timeout obrigatório.** Sem `AbortController`, um servidor que aceita a conexão mas não responde deixa o app pendurado indefinidamente:
   ```ts
   const controller = new AbortController();
   const timer = setTimeout(() => controller.abort(), 6000);
   fetch(url, { signal: controller.signal });
   ```

---

## Imagens: a parte que quase todo mundo erra

Foi o bug mais grave deste projeto. O catálogo guardava a **URL** da foto que o Bling devolvia:

```
https://orgbling.s3.amazonaws.com/.../...?AWSAccessKeyId=...&Expires=1784795198&Signature=...
```

É uma URL **pré-assinada, que expira em 7 dias**. Resultado: uma semana depois de cada sync, todas as 868 fotos do totem viravam quadrado vazio. E um APK recém-instalado sem servidor nunca mostraria foto nenhuma.

**Regra geral: URL de imagem de terceiro não é armazenamento.** Se a foto precisa existir offline, ela tem que virar arquivo seu.

O que foi feito ([sync/src/images.js](../sync/src/images.js)):

1. **Baixar** a imagem no servidor, guardando a *parte estável* da URL (o caminho, sem a query) para saber se ela mudou de verdade:
   ```js
   const stableKey = (url) => new URL(url).pathname;   // a query muda a cada sync
   if (manifest[id]?.key === key && fs.existsSync(file)) continue;   // não rebaixa
   ```
2. **Redimensionar** para o tamanho que a tela realmente desenha. As originais somavam 52 MB; a 800px de lado em JPEG 82 ficaram **5,6 MB** — a diferença entre caber e não caber num APK.
   ```js
   sharp(buffer).rotate()
     .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
     .flatten({ background: '#ffffff' })   // PNG transparente fica preto no Android
     .jpeg({ quality: 82, mozjpeg: true })
   ```
3. **Empacotar no app.** O Metro só entende `require()` com string literal, então o caminho é gerar um módulo ([sync/src/bundle.js](../sync/src/bundle.js)):
   ```ts
   export const bundledImages: Record<string, number> = {
     '16664095230': require('../../data/images/16664095230.jpg'),
     // ...
   };
   ```
4. **Cadeia de origens com fallback** ([src/data/images.ts](../src/data/images.ts)): APK → servidor → URL original. O componente avança na cadeia no `onError` e, se tudo falhar, desenha um gradiente — nunca um quadrado quebrado.
   ```tsx
   const [failed, setFailed] = useState(0);
   const source = sources[failed];
   if (!source) return <Gradiente />;            // fim da cadeia
   return <Image source={source} onError={() => setFailed(i => i + 1)} />;
   ```
5. **Prefetch para o disco** do que não veio no APK, em lotes pequenos:
   ```ts
   await Image.prefetch(uri, { cachePolicy: 'disk' });
   ```

### "Isso não é hardcoded?"

Pergunta justa, e vale separar três coisas que parecem uma só:

| Camada | O que é | É opcional? |
| ------ | ------- | ----------- |
| **1. Baixar** do Bling para armazenamento nosso | Passo de ETL | **Não.** A URL de origem expira em 7 dias. |
| **2. Servir** de `/images/:id` com cache | Nosso "CDN" | **Não.** É como qualquer catálogo funciona. |
| **3. Empacotar** no APK | Escolha de quiosque | **Sim.** `TOTEM_BUNDLE_IMAGES=false`. |

A camada 1 não é opção de arquitetura, é consequência do fornecedor: **URL assinada de terceiro não é armazenamento**. Um e-commerce de verdade faz exatamente isto — recebe a imagem do fornecedor e sobe para o próprio S3/CDN. A diferença aqui é só a escala: o "CDN" é o PC da loja.

O `bundledImages.ts` com 197 `require()` **é gerado**, nunca escrito à mão, e regerado por `npm run bundle` a cada atualização. Isso é um *manifesto de assets* — o mesmo padrão do asset catalog do Xcode ou da pasta `res/` do Android. Hardcoding seria digitar esses caminhos à mão e vê-los divergir da realidade na primeira mudança de catálogo.

A camada 3 é a única discutível, e por isso virou uma variável de ambiente. Para o totem ela fica ligada: 5,6 MB é barato perto de o app abrir completo num tablet recém-formatado sem rede. **Para um app de consumidor final você desligaria** — catálogo muda toda hora, o usuário tem rede boa, e não faz sentido enfiar o estoque inteiro dentro do binário.

### No app de Bíblia

O texto bíblico é o caso mais fácil que existe: é **estático e pequeno**. Ele deve ir **inteiro dentro do APK** — nenhuma tradução deveria depender de download. A cascata muda um pouco:

| Camada | Le Parfum | App de Bíblia |
| ------ | --------- | ------------- |
| Bundle | catálogo + fotos | **a tradução inteira** (JSON/SQLite) |
| Cache | catálogo atualizado | traduções extras que o usuário baixou |
| Servidor | preços e estoque | novas traduções, planos de leitura, devocionais |

Um detalhe importante: um JSON de Bíblia inteira (~4,5 MB por tradução) é lento de dar `JSON.parse` a cada abertura e ocupa memória à toa. Para texto grande, prefira **SQLite** (`expo-sqlite`, com o `.db` pré-populado como asset) e faça consultas por capítulo — só o capítulo aberto vai para a memória. Para 1–2 traduções, o JSON resolve; a partir daí, SQLite.

---

## Tempo real sem abrir mão do offline

Parece contradição — não é. As duas coisas resolvem problemas diferentes:

- **offline-first** responde "o que aparece quando não há rede";
- **tempo real** responde "quão rápido chega quando há".

O erro é usar o tempo real como *fonte* dos dados. Se o app só tem conteúdo depois que o WebSocket conecta, você trocou uma dependência de rede por outra, pior. A regra: **o push só dispara um refetch; ele nunca é o caminho pelo qual o dado chega.**

```ts
socket.onmessage = (evento) => {
  if (JSON.parse(evento.data)?.tipo === 'catalogo-atualizado') refresh();
  //                                                          ^^^^^^^^^
  // o mesmo refresh() do polling — o push só antecipa, não substitui
};
```

Com isso a cascata fica intacta: bundle → cache → servidor, e o WebSocket apenas encurta o tempo entre "mudou lá" e "apareceu aqui".

Três detalhes que fazem funcionar de verdade:

1. **Reconexão com backoff exponencial.** O PC da loja desliga à noite; sem backoff o app tenta reconectar em loop e come bateria.
   ```ts
   socket.onclose = () => {
     const espera = Math.min(30000, 1000 * 2 ** tentativas++);
     reconnect = setTimeout(conectar, espera);
   };
   ```
2. **O polling continua existindo.** Uma conexão pode morrer sem disparar `onclose` (Wi-Fi que some sem FIN). O refetch periódico é a rede de segurança que cobre esse caso.
3. **Só avise quando mudou.** Aqui o gatilho é a escrita do arquivo (`fs.watch` no servidor) e o `quick.js` só escreve se algum preço ou estoque realmente mudou. Avisar "atualizou" a cada ciclo faria 288 refetches por dia à toa.

No app de Bíblia isso vale para *notificações e conteúdo novo* (devocional do dia, resposta num plano compartilhado) — nunca para o texto bíblico, que já está no aparelho.

## Escrita offline

Tudo que o usuário produz (aqui: ofertas e métricas; no app de Bíblia: **grifos, anotações, favoritos, progresso do plano**) segue a regra:

> **grava local primeiro, sempre; sincroniza depois, se der.**

Parte da escrita nunca sai do aparelho, e essa não precisa de fila: ofertas e métricas são locais por natureza ([src/data/promotionsStore.tsx](../src/data/promotionsStore.tsx), [src/logic/metrics.ts](../src/logic/metrics.ts)).

O **cadastro de produtos da loja** é o caso oposto — nasce no totem e precisa chegar ao PC e aos outros tablets ([src/data/localProductsStore.tsx](../src/data/localProductsStore.tsx)). Ele usa as duas peças que qualquer escrita sincronizada exige:

1. **Fila de pendências** — cada alteração vira `{ opId, tipo, produtoId, produto, criadoEm }` no AsyncStorage. Ao voltar a rede, envia em ordem e remove da fila conforme confirma. É isso que garante que um produto cadastrado com o Wi-Fi fora não se perca. Dois detalhes que a prática exigiu:
   - **Uma operação por produto.** Editar o preço cinco vezes offline gera uma pendência, não cinco: `enfileirar()` descarta as anteriores do mesmo produto. Como a regra de conflito é "vence a mais recente", guardar só a última é equivalente e evita aplicar escritas fora de ordem.
   - **O envio para na primeira falha.** Se o servidor caiu, insistir nas operações seguintes só rende timeout; elas ficam na fila e sobem na próxima tentativa.
2. **Regra de conflito escrita antes de precisar dela** — "vence o `atualizadoEm` mais recente", aplicada igual nos dois lados ([src/logic/produtosLocais.ts](../src/logic/produtosLocais.ts) e [sync/src/localProducts.js](../sync/src/localProducts.js)). Duas exceções que só apareceram ao testar de verdade:
   - **Registro com pendência é intocável na leitura.** Aceitar a versão do servidor para um produto que ainda não subiu apagaria exatamente o trabalho que a fila existe para proteger.
   - **Remoção precisa de lápide.** Sem guardar `removidos[id] = quando`, um totem que passou uma semana sem rede ressuscita um produto que a loja já apagou — para ele, aquela escrita ainda está pendente.

No app de Bíblia é a mesma receita para grifos e anotações; o que muda é só o conflito ser entre dois aparelhos do mesmo usuário.

### A foto do cadastro

Uma foto tem um problema que o texto não tem: **peso**. Três decisões que vieram disso ([src/data/fotos.ts](../src/data/fotos.ts)):

1. **O que a galeria devolve não é armazenamento.** O URI que o seletor entrega é temporário do sistema e some sozinho depois de um tempo — é o mesmo erro da URL assinada do Bling em outra roupagem. A foto é copiada para o sandbox do app antes de qualquer outra coisa.
2. **A fila guarda o caminho, nunca os bytes.** O AsyncStorage é um SQLite com poucos MB de limite; meia dúzia de fotos em base64 ali dentro estouraria o banco e levaria junto o catálogo em cache. Os bytes só são lidos do disco no instante do envio.
3. **O nome do arquivo carrega um carimbo de tempo.** Cache de imagem é indexado por URI: sem trocar o caminho, uma foto substituída continuaria aparecendo com a imagem antiga. O mesmo vale do lado do servidor, onde a URL leva `?v=` com a versão.

E o redimensionamento para 800px/JPEG 82 é feito **no aparelho, antes de guardar** — os mesmos números que o sync usa nas fotos do Bling. Uma foto de celular moderno tem 4 MB; guardar isso para exibir num card de 400pt seria desperdício em disco, em rede e no tempo de envio da fila.

Nunca use o retorno do servidor como confirmação para liberar a UI. O usuário grifa o versículo e o grifo aparece **imediatamente**; a sincronização é assunto do app, não dele.

---

## Mostre o estado, mas para quem interessa

O app precisa saber se está desatualizado — mas isso não é assunto do cliente na frente do totem. Por isso o status vive no **painel da equipe** ([src/app/admin.tsx](../src/app/admin.tsx)), não na tela do cliente:

- quantos perfumes estão carregados;
- quantos produtos a loja cadastrou e **quantas alterações ainda não subiram**;
- **de quando** são os preços (com aviso em dourado se passou de 2 dias);
- **de onde** vieram os dados: app / cache / servidor;
- se o servidor está alcançável e quando foi o último sync;
- quantas fotos estão dentro do app;
- botão **Atualizar agora**.

Sem isso, um sync quebrado é invisível: o totem mostra preços de duas semanas atrás com toda a confiança do mundo — que foi exatamente o que aconteceu aqui. A tarefa agendada do Windows falhava desde o dia em que foi criada e ninguém tinha como perceber.

Num app de Bíblia o equivalente é discreto: "Traduções atualizadas há 3 dias" nos ajustes, e um ícone de nuvem com risco quando há anotações na fila esperando para subir.

---

## Erros que custaram caro aqui

| Erro | Sintoma | Correção |
| ---- | ------- | -------- |
| Guardar URL assinada de terceiro | Todas as fotos somem em 7 dias | Baixar o arquivo, versionar localmente |
| Empacotar o catálogo bruto inteiro | 812 KB no APK para exibir 205 produtos | Empacotar só o recorte que a tela usa (204 KB) |
| `await` da rede antes de liberar a UI | Spinner de 6s quando o servidor está fora | Renderizar do cache primeiro, rede depois |
| Não ter indicador de frescor | Dados de 14 dias exibidos como se fossem de hoje | Status no painel da equipe |
| Tarefa agendada com caminho não citado | Sync nunca rodou; falha silenciosa `0x80070002` | `Register-ScheduledTask` + conferir `LastTaskResult` |
| Fiar-se no cache automático do `expo-image` | Só funciona para o que já foi visto uma vez | `Image.prefetch` + ativo no bundle |

---

## Checklist para o próximo app

- [ ] O app abre e é **útil** em modo avião, num aparelho recém-instalado?
- [ ] O conteúdo essencial está **dentro do APK**, não só em cache?
- [ ] Toda imagem tem origem local ou fallback visual — nenhum quadrado quebrado?
- [ ] Todo `fetch` tem timeout e um `catch` que não quebra a tela?
- [ ] A UI aparece **antes** de qualquer `await` de rede?
- [ ] O que o usuário escreve é salvo local **antes** de qualquer chamada de rede?
- [ ] Existe uma tela onde dá para ver se a sincronização está funcionando?
- [ ] Você já testou com o Wi-Fi **desligado** — não só com o servidor parado?
