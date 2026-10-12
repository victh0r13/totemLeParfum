/**
 * Normalização de marca.
 *
 * O campo "marca" do Bling é texto livre digitado por quem cadastra o produto,
 * e ao longo do tempo acumulou variações da mesma marca: "Antonio Bandares" e
 * "Antonio Banderas", "Paris Elysees" e "Parys Elysees", "jacques bogart" e
 * "Jacques Bogart". Sem tratamento, o filtro de marca do totem mostra a mesma
 * marca duas ou três vezes, cada uma com uma parte dos produtos.
 *
 * Duas correções, nesta ordem:
 *   1. apelidos — erros de digitação conhecidos apontam para a grafia certa;
 *   2. caixa — o resto vira Título, o que já funde "joop!" com "Joop!".
 */

/** Grafias erradas vistas no cadastro → grafia correta. Chave em minúsculas. */
const APELIDOS: Record<string, string> = {
  'antonio bandares': 'Antonio Banderas',
  'parys elysees': 'Paris Elysees',
  aarmani: 'Armani',
  'ralph laurent': 'Ralph Lauren',
  azarro: 'Azzaro',
  'salvador dali': 'Salvador Dalí',
  lancome: 'Lancôme',
  givency: 'Givenchy',
  'carolina herrera': 'Carolina Herrera',
};

/** Partículas que ficam em minúscula no meio do nome. */
const MINUSCULAS = new Set(['de', 'da', 'do', 'del', 'di', 'du', 'e', 'y', 'of', 'the', 'by']);

/** Siglas e estilizações que não devem virar Título. */
const LITERAIS: Record<string, string> = {
  ch: 'CH',
  ysl: 'YSL',
  jpg: 'JPG',
  udv: 'UDV',
  ck: 'CK',
};

function titulo(texto: string): string {
  return texto
    .split(' ')
    .map((palavra, i) => {
      const minuscula = palavra.toLowerCase();
      if (LITERAIS[minuscula]) return LITERAIS[minuscula];
      // Partícula só fica minúscula no meio do nome, nunca na primeira palavra.
      if (i > 0 && MINUSCULAS.has(minuscula)) return minuscula;
      return minuscula.charAt(0).toUpperCase() + minuscula.slice(1);
    })
    .join(' ');
}

/**
 * Marca pronta para exibir e agrupar, ou null quando o produto não tem marca
 * cadastrada — nesse caso ela não entra no filtro, porque "sem marca" não é
 * uma marca.
 */
export function normalizeBrand(raw: string | null | undefined): string | null {
  const limpo = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!limpo) return null;
  const apelido = APELIDOS[limpo.toLowerCase()];
  return apelido ?? titulo(limpo);
}

/** Sem acento, sem caixa, só letras/números separados por um espaço. */
function plano(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Marcas que existem no cadastro mas não identificam linha nenhuma. */
const MARCAS_GENERICAS = new Set(['diversos', 'outros', 'outras']);

/**
 * Marca deduzida do nome, para produto que chegou do Bling sem ela — é o caso
 * de toda variação ("Body Splash - Ciclo Cosméticos (Conjunto) Fragância:Kiss").
 * Só vale uma marca que JÁ existe no catálogo e aparece no nome como palavra
 * inteira; entre várias, a mais longa ("Ciclo Cosméticos" antes de "Ciclo").
 */
export function marcaPeloNome(nome: string, marcasConhecidas: Iterable<string>): string | null {
  const alvo = ` ${plano(nome)} `;
  let melhor: string | null = null;
  let tamanho = 0;
  for (const marca of marcasConhecidas) {
    const chave = plano(marca);
    if (chave.length < 3 || MARCAS_GENERICAS.has(chave)) continue;
    if (alvo.includes(` ${chave} `) && chave.length > tamanho) {
      melhor = marca;
      tamanho = chave.length;
    }
  }
  return melhor;
}
