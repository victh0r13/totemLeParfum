1. Versão leiga
(para explicar a alguém que não é de tecnologia — e para você ter a imagem mental certa na cabeça)

O que o sistema é
Um tablet na parede da loja que atende o cliente sozinho.

A Le Parfum tem mais de 200 perfumes. O cliente entra, olha a parede de frascos e trava. Ou espera um atendente, ou vai embora. O totem responde: mostra o catálogo com preço e estoque de verdade, filtra por "amadeirado / masculino / até R$ 250", e tem um quiz de seis perguntas que sugere perfumes para quem não sabe o que quer.

As três peças
Pense em uma loja física com um estoquista:

O Bling é o depósito. É o sistema que a loja já usa para preço e estoque. Ninguém cadastra nada duas vezes.
O servidor é o estoquista. Roda no PC da loja. De 5 em 5 minutos ele vai ao depósito conferir o que mudou de preço e estoque, baixa as fotos e deixa tudo arrumado.
O totem é a vitrine. Recebe do estoquista e mostra ao cliente.
O que tem de especial
O totem funciona sem internet. Não é "funciona mal sem internet" — é que ele foi feito para isso.

A comparação: a maioria dos apps é como um restaurante que só serve o que chegou do fornecedor naquela manhã. Fornecedor atrasou, o restaurante fecha. O nosso é como um restaurante com despensa cheia: o fornecedor traz reposição quando pode, mas ninguém fica sem comer.

Na prática: o Wi-Fi cai, o roteador reinicia, o PC do caixa desliga — o totem continua funcionando. Catálogo, fotos, quiz, tudo dentro do aparelho. O pior que acontece é mostrar um preço de duas horas atrás. Nunca uma tela de erro na frente do cliente.

E vale nos dois sentidos: se um funcionário cadastrar um produto novo com o Wi-Fi caído, o cadastro fica guardado numa fila e sobe sozinho quando a rede volta. Ele não perde o trabalho e nem precisa lembrar de reenviar.

O que a loja ganha
O totem anota o que os clientes procuram. Numa semana o dono sabe qual perfume todo mundo olha e ninguém leva — e isso é decisão de compra e de vitrine, não estatística bonita.

2. Versão técnica
(o vocabulário para falar com o chefe — cada termo aqui é real, não enfeite)

Arquitetura

BLING (ERP, API v3)  ──▶  SERVIDOR LOCAL (Node.js)  ──▶  TOTEM (Expo / React Native)
   OAuth 2.0              sync + imagens + API + WS       app offline-first
Três camadas, comunicação só para dentro. Nenhum componente na nuvem, nenhum custo recorrente.

Stack
Camada	Tecnologia
App	TypeScript + React Native 0.86 sobre Expo SDK 57
Navegação	expo-router (roteamento por arquivos, com deep links)
Servidor	Node.js + Express
Tempo real	WebSocket (ws), endpoint /ws
Imagens	sharp (redimensionamento server-side)
Persistência no totem	AsyncStorage (SQLite) + sistema de arquivos
Testes	Vitest — 120 testes sobre a lógica pura
Build Android	CNG (expo prebuild) + Gradle, JDK 17
Cerca de 8.800 linhas entre app, servidor e testes.

Os pontos que valem citar
Offline-first com cascata de três camadas. A leitura obedece a uma ordem: bundle embarcado (208 KB de catálogo compilado dentro do APK) → cache local → servidor. O app nunca depende de rede para renderizar. Rede é melhoria, não requisito.

Escrita com fila de pendências (outbox pattern). Cadastro, edição e exclusão são gravados localmente e enfileirados. O envio é assíncrono, com nova tentativa a cada 15 s. Conflito entre dois totens resolve por last-write-wins com carimbo atualizadoEm; exclusão grava tombstone — sem ela, um totem que ficou uma semana offline ressuscitaria um produto já apagado.

As fotos são baixadas, não referenciadas. As URLs de imagem do Bling são assinadas e expiram em 7 dias. Linkar direto daria um catálogo que apodrece sozinho. O servidor baixa, normaliza para 800 px / JPEG 82 com sharp, e serve pela rota /images/:id. São 197 fotos, 6,2 MB.

Enriquecimento derivado. Gênero, família olfativa, ocasião e intensidade não existem no Bling. Um passo de curadoria deduz o que dá para deduzir com segurança — categoria, convenções de nome do mercado, notas extraídas da descrição — e nunca sobrescreve valor curado à mão. É o que alimenta os filtros, o quiz e a pirâmide olfativa.

Tempo real sem abrir mão do offline. O sync rápido roda a cada 5 minutos; quando detecta mudança, o servidor faz push por WebSocket. O totem aplica sobre o dado que já tem. Se o socket cair, nada quebra — só volta a ser eventual.

Curadoria do catálogo. Dos 1.163 produtos no Bling, 203 entram no totem — só o que é classificado como perfume, com preço e estoque válidos.

Fechamento de qualidade. 120 testes automatizados, tipagem estrita, e cada regra de negócio isolada em módulo puro e testável (src/logic/), separada da UI.

3. Versão de apresentação
(o meio-termo — é isso que eu falaria em voz alta)

"É um totem de autoatendimento para a loja. Ele puxa preço e estoque direto do Bling, que a loja já usa, então ninguém cadastra produto duas vezes.

São três peças: o Bling como fonte, um servidor Node que roda no PC da loja fazendo a ponte, e o app no tablet, feito em React Native com Expo — um código só, que amanhã roda no celular do cliente sem reescrever nada.

A decisão de arquitetura mais importante chama-se offline-first. Em vez de o app buscar tudo no servidor e mostrar erro quando falha, ele lê do próprio dado e sincroniza em segundo plano. Numa loja isso não é luxo: Wi-Fi cai, roteador reinicia, o PC do caixa desliga. O pior cenário é o totem mostrar um preço de duas horas atrás — nunca uma tela de erro na frente do cliente.

E vale para escrita também: se a equipe cadastrar um produto com a rede caída, ele entra numa fila e sobe sozinho quando a rede volta. Testado: derrubei o servidor, cadastrei, religuei — subiu em 7 segundos sem ninguém tocar na tela.

Duas coisas que o Bling não dá e o sistema resolve: as fotos, que no Bling vêm por link que expira em 7 dias — então baixamos e servimos localmente; e a classificação olfativa — gênero, família, ocasião —, que não existe no ERP e é deduzida da descrição, alimentando os filtros e o quiz.

Quando algo muda no Bling, o servidor avisa o totem por WebSocket — o mesmo mecanismo de um chat. Sem botão de atualizar.

Tudo roda dentro da loja. Nenhum servidor na nuvem, nenhuma mensalidade além do Bling que ela já paga."

O que falta no roteiro
O ROTEIRO-APRESENTACAO.md cobre catálogo, quiz, tempo real, offline e painel — mas não tem o cadastro de produtos, que é justamente o CRUD que seu colega sugeriu. Ele encaixa naturalmente entre a seção 4 (offline-first) e a 5 (o que o dono ganha), porque é a prova mais concreta do offline: dá para demonstrar a fila ao vivo em 40 segundos.
