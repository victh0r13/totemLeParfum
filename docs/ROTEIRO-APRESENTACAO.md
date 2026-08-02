# Roteiro de apresentação — Le Parfum Totem

**Duração:** 12–15 min de fala + 5 de perguntas
**Data:** 03/08/2026

---

## Antes de entrar na sala

- [ ] Tablet carregado (>80%), brilho no máximo, rotação automática desligada
- [ ] APK instalado e **aberto uma vez** (para o prefetch de fotos já ter rodado)
- [ ] Fixação de tela ativada
- [ ] Notebook com o servidor rodando (`npm run server`) e na mesma rede do tablet
- [ ] Bling aberto numa aba, já logado, na tela de um produto que você vai alterar
- [ ] **Ensaie o modo avião**: puxe a barra de notificações e localize o botão antes
- [ ] Slides abertos, celular no silencioso

**Plano B:** se o Wi-Fi do local falhar, a demo do tempo real cai — mas o app continua 100% funcional (é o ponto da apresentação). Use isso a seu favor: _"olha, é exatamente esse o cenário para o qual ele foi feito"_.

---

## 1. Abertura — o problema (1,5 min)

> "A Le Parfum tem mais de 200 perfumes em estoque. Um cliente entra, olha a parede de frascos e não sabe por onde começar. Ou ele espera um atendente ficar livre, ou ele vai embora.
>
> O totem resolve isso: ele atende sozinho, sabe o preço e o estoque de verdade, e nunca fica sem resposta."

Não abra com tecnologia. Abra com a cena da loja.

---

## 2. Demo ao vivo — o app (4 min)

Deixe o tablet na mão ou projetado. **Não narre o que está na tela; narre o que o cliente está pensando.**

1. **Home** → "Duas portas: quem já sabe o que quer, e quem não faz ideia."
2. **Catálogo** → toque na **lupa** e digite **lattafa**
   > "Cliente que chega pedindo uma marca ou um nome específico — resolvido em um toque."
   > Feche a busca e use **Família: Amadeirado** + **Gênero: Masculino**
   > "E quem chega dizendo 'quero algo amadeirado, masculino' também."
3. **Detalhe de um perfume** → mostre a **pirâmide olfativa**
   > "Topo, coração e fundo. Isso não existe no Bling — o sistema extrai das descrições automaticamente."
4. **Quiz** (o momento mais forte) → faça as 6 perguntas ao vivo, sem pressa
   > "Seis perguntas. Nenhuma pede conhecimento de perfumaria — é sobre a pessoa, não sobre nota olfativa."
   > No resultado, aponte:
   > "Cinco perfumes reais, todos com estoque neste minuto, todos do gênero que ela pediu."

---

## 3. O golpe de efeito — tempo real (2 min)

Este é o momento que as pessoas lembram. Faça devagar.

1. Deixe o **detalhe de um perfume aberto** no tablet, com o preço visível.
2. Vá ao **Bling no notebook** e mude o preço desse produto. Salve.
3. Volte para o tablet. Aponte para o preço.

> "Não toquei no tablet. Nenhum botão de atualizar. O servidor da loja percebeu a alteração e avisou o totem na hora."

**Se a demo ao vivo assustar**, tem uma versão sem depender do Bling: peça para alguém alterar o preço pelo próprio painel da loja (ícone ✎ → PIN) enquanto você segura o tablet.

Explique em uma frase:

> "De 5 em 5 minutos o sistema confere preço e estoque no Bling. Quando algo muda, ele avisa o totem por WebSocket — o mesmo mecanismo de um chat."

---

## 4. O diferencial técnico — offline-first (3 min)

Aqui é onde você mostra maturidade de engenharia. **Faça a demonstração, não conte.**

1. Coloque o tablet em **modo avião**, na frente de todos.
2. Navegue: catálogo, fotos, detalhe, quiz completo.

> "Sem internet nenhuma. Catálogo, preços, as 197 fotos, o quiz inteiro — tudo dentro do aparelho.
>
> Isso é uma decisão de arquitetura chamada **offline-first**: em vez de buscar no servidor e mostrar erro se falhar, o app lê do próprio dado e sincroniza em segundo plano. A rede é uma melhoria, nunca um requisito.
>
> Numa loja isso não é luxo. Wi-Fi cai, o roteador reinicia, o PC do caixa desliga. O pior que pode acontecer é o totem mostrar um preço de duas horas atrás — nunca uma tela de erro na frente do cliente."

Se perguntarem "e se o preço mudar enquanto está offline?":

> "Ele mostra o último preço conhecido e a equipe vê no painel há quanto tempo o dado é. Assim que a rede volta, sincroniza sozinho. É melhor um preço de 2h atrás do que nenhum preço."

---

## 5. O que o dono da loja ganha (2 min)

Mude o tom: pare de falar de tecnologia.

- **Painel da loja** (segurar o logo → PIN) — mostre ao vivo:
  - perfumes mais vistos → _"o que desperta interesse mas talvez não esteja vendendo"_
  - pedidos de amostra → _"intenção real de compra"_
  - respostas do quiz → _"o que o público da sua loja procura: quantos pedem feminino, quantos pedem noite, qual família ganha"_
- **Ofertas pelo próprio totem** — a equipe põe um preço promocional sem mexer no Bling e sem chamar ninguém de TI.
- **Zero trabalho manual** — o catálogo vem do Bling que a loja já usa. Ninguém cadastra produto duas vezes.

> "Em uma semana de uso, o dono sabe qual perfume todo mundo olha e ninguém leva. Isso é decisão de compra e de vitrine."

---

## 6. Como funciona por baixo (2 min) — só se a plateia for técnica

Um slide, três caixas:

```
BLING ──▶ SERVIDOR DA LOJA (Node) ──▶ TOTEM (Expo / React Native)
 ERP        sync + fotos + API           app offline-first
```

Pontos que valem citar:

- **Expo / React Native** — um código, Android e iOS
- **API v3 do Bling** com OAuth 2.0 e respeito ao limite de 3 req/s
- **As fotos são baixadas, não linkadas** — as URLs do Bling expiram em 7 dias
- **WebSocket** para o push em tempo real
- **Tudo roda na loja** — nenhum servidor na nuvem, nenhum custo mensal

---

## 7. Fechamento (1 min)

> "O totem está pronto para ligar na loja hoje. Ele se atualiza sozinho, funciona sem internet, e vai começar a dizer o que os clientes procuram desde o primeiro dia.
>
> O próximo passo natural é levar a mesma base para o celular do cliente — é o mesmo código."

---

## Perguntas que vão aparecer

| Pergunta                     | Resposta curta                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| "Quanto custa manter?"       | Zero mensalidade. Roda no PC que a loja já tem, com o Bling que ela já paga.                                                      |
| "E se o tablet quebrar?"     | Instala o APK em outro e está no ar. Só as métricas daquele aparelho se perdem.                                                   |
| "Dá para vender pelo totem?" | Hoje ele informa e chama o atendente. Pagamento é o próximo passo, e o Bling já tem API de pedidos.                               |
| "Funciona em vários totens?" | Sim, todos apontam para o mesmo servidor. Ofertas e métricas hoje são por aparelho.                                               |
| "Quanto tempo levou?"        | (seja honesto — some as sessões; o valor está no que foi resolvido, não em parecer rápido)                                        |
| "E a segurança do PIN?"      | É trava de conveniência contra cliente curioso, não controle de acesso. Área administrativa de verdade viraria login no servidor. |
| "Por que não é um site?"     | Precisa funcionar sem internet e travado em modo quiosque. Navegador não dá nenhum dos dois com confiança.                        |

---

## Erros a evitar

- **Não** mostre código. Ninguém pediu.
- **Não** peça desculpa por nada ("ainda falta...", "não deu tempo de..."). Apresente o que existe.
- **Não** corra o quiz. É o momento em que a plateia entende o produto.
- **Não** dependa do Wi-Fi do local para nada além da demo de tempo real.
- Se algo travar, **use o modo avião como saída**: reabra o app e siga. Ele funciona sozinho — que é justamente a tese.
