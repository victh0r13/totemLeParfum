# Prompt para o Claude Design — slides do projeto

Copie tudo abaixo da linha e cole no Claude Design.
Anexe também 4 ou 5 screenshots do app (home, catálogo, detalhe com pirâmide, resultado do quiz, painel da loja).

---

Crie uma apresentação de slides para eu apresentar um projeto que desenvolvi: um **totem de autoatendimento para uma perfumaria física**, a Le Parfum.

## Contexto

O totem é um tablet em modo quiosque, na loja, que ajuda o cliente a escolher um perfume sozinho quando não há atendente livre. Ele mostra o catálogo real da loja — preço e estoque vindos do ERP Bling — e tem um quiz de 6 perguntas que recomenda fragrâncias de verdade, com estoque naquele momento.

A plateia é mista: **dono da loja e equipe comercial** (que querem saber o que ganham) e **algumas pessoas técnicas** (que querem saber como funciona). Priorize o lado de negócio; a parte técnica é um slide de apoio, não o centro.

## Tom e identidade visual

Perfumaria sofisticada, não startup de tecnologia. Elegante, silencioso, com muito espaço em branco. Nada de gradiente roxo, ícone de foguete ou "disrupção".

Paleta (é a identidade real do app, use exatamente):
- fundo: `#faf7f2` (creme)
- texto: `#211d18` (quase preto, quente)
- texto secundário: `#8c8478`
- destaque: `#a8823f` (dourado)
- superfície/cards: `#ffffff`

Tipografia: um **serif elegante** para títulos (o app usa Cormorant Garamond) e um **sans-serif limpo** para o corpo (o app usa Manrope). Títulos grandes e arejados. Fios dourados finos como separador, nunca caixas pesadas.

## Estrutura dos slides

1. **Capa** — "Le Parfum · Totem de Loja". Sóbria, quase um convite. Subtítulo: "Atendimento que não deixa o cliente esperando."

2. **O problema** — 200+ perfumes na parede, cliente sem saber por onde começar, atendente ocupado. Um número em destaque: **205 perfumes** no catálogo. Sem bullets longos.

3. **A solução em uma frase** — "Um totem que atende sozinho, sabe o preço e o estoque de verdade, e funciona mesmo sem internet." Slide de respiro, quase só tipografia.

4. **A jornada do cliente** — 3 etapas com screenshot em cada:
   - *Explorar* → busca por nome/marca e filtros por família olfativa, gênero e preço
   - *Descobrir* → quiz de 6 perguntas visuais
   - *Escolher* → 5 perfumes reais, com estoque, com pirâmide olfativa
   Layout horizontal, os screenshots em molduras de tablet em retrato.

5. **Recomendação que é real, não genérica** — explique que o quiz filtra por gênero, família olfativa, ocasião e intensidade, e só sugere o que está em estoque naquele instante. Destaque: **nunca sugere o que a loja não tem**.

6. **Sempre atualizado, sem trabalho manual** — diagrama simples e bonito, horizontal:
   `BLING (ERP) → SERVIDOR DA LOJA → TOTEM`
   Com dois rótulos: "preço e estoque a cada 5 minutos" e "atualiza o totem em segundos".
   Sem ícones técnicos genéricos; linhas finas douradas.

7. **Funciona sem internet** — o slide mais importante. Deixe forte e visual: um ícone de modo avião e a frase "Catálogo, preços e as 197 fotos ficam dentro do aplicativo." Subtexto: "Wi-Fi cai, roteador reinicia, PC desliga — o cliente na frente do totem nunca vê uma tela de erro."

8. **O que a loja descobre** — o painel mostra os perfumes mais vistos, os pedidos de amostra e o perfil de quem responde o quiz. Enquadre como **inteligência de vitrine e de compra**, não como "analytics". Se ajudar, um gráfico de barras horizontal simples, em dourado sobre creme, com dados de exemplo.

9. **Como foi construído** (slide técnico único, discreto) — React Native + Expo, integração OAuth com a API v3 do Bling, arquitetura offline-first em três camadas, WebSocket para atualização em tempo real, tudo rodando na própria loja, sem custo de nuvem. Texto pequeno, organizado, sem poluir.

10. **Próximos passos** — mesma base no celular do cliente; pagamento pelo totem; múltiplos totens compartilhando dados.

11. **Encerramento** — "Pronto para ligar na loja." Limpo, com a marca.

## Regras

- Um slide, uma ideia. Se precisar de mais de 4 linhas de texto, quebre em dois.
- Números grandes e sozinhos funcionam melhor que listas: **205 perfumes**, **197 fotos offline**, **6 perguntas**, **5 minutos**, **40 marcas**.
- Os screenshots são o herói dos slides 4, 5 e 8 — dê espaço a eles, em moldura de tablet vertical.
- Nada de emoji, nada de clip-art, nada de stock photo de "pessoa sorrindo com tablet".
- Escreva tudo em **português do Brasil**.
