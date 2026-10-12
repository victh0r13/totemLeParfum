/**
 * O que está de fato à venda: com estoque E com preço.
 *
 * Preço zero no Bling quase sempre é uma variação "com composição" — um atalho
 * que aponta para o produto real (que já tem preço e entra no totem por conta
 * própria). Levá-lo adiante só duplicaria o produto e ocuparia espaço no APK.
 * O app aplica a mesma regra na vitrine (mergeCatalog), mas filtrar aqui
 * também mantém curadoria, fotos e bundle enxutos.
 */
export function aVenda(p) {
  return Number(p.estoque) > 0 && Number(p.preco) > 0;
}
