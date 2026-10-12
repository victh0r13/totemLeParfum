/**
 * Tipo de produto (perfume, body splash, corpo & banho...) deduzido do nome e
 * da categoria do Bling.
 *
 * As categorias do Bling misturam tipo com marca ("Maquiagens > Ruby Kisses",
 * "Body Splash > Lattafa") e quase um terço dos produtos não tem categoria
 * nenhuma — por isso o NOME vem primeiro: "Body Splash Victoria's Secret"
 * dentro de "Perfumes & Colônias" é body splash, não perfume.
 */

/** Tipos que entram no totem. Maquiagem e capilar ficam de fora por ora. */
export const TIPOS_NO_TOTEM = new Set(['perfume', 'body-splash', 'corpo', 'kit']);

/**
 * Casa palavras inteiras. O `\b` do JavaScript só enxerga letras ASCII — em
 * "Óleo" ele não acha a fronteira antes do "Ó" —, então a borda é qualquer
 * coisa que não seja letra ou número, acentuada ou não.
 */
const palavras = (...termos) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${termos.join('|')})(?![\\p{L}\\p{N}])`, 'iu');

/**
 * A primeira regra que casar vence. A ordem importa: "Kit Queridinhos (batom +
 * gloss)" é maquiagem; "Kit Hidratante + Body Splash" é kit; "Mist Capilar" é
 * capilar, não body splash.
 */
const REGRAS_NOME = [
  ['outro', palavras('vale[- ]presente', 'gift ?card', 'nécessaire', 'necessaire')],
  [
    'maquiagem',
    palavras(
      'batom', 'gloss', 'lip ?(?:tint|oil|balm)', 'brilho labial', 'balm labial', 'blush',
      'corretivo', 'iluminador', 'sombras?', 'r[íi]mel', 'm[áa]scara (?:de|para) c[íi]lios',
      'c[íi]lios', 'delineador', 'l[áa]pis', 'pinc[ée]is', 'pincel', 'primer',
      'p[óo] (?:compacto|solto|transl[úu]cido)', 'paleta', 'contorno', 'bronzer',
      'esponja', 'base(?: stick| matte| l[íi]quida)', 'fixador de maquiagem',
      'bruma fixadora', 'demaquilante', '[bc]b cream',
    ),
  ],
  ['kit', palavras('kits?', 'combo')],
  [
    'capilar',
    palavras(
      'shampoo', 'condicionador', 'leave[- ]?in', 'capilar', 'cabelos?', 'finalizador',
      'm[áa]scara de (?:tratamento|hidrata[çc][ãa]o|nutri[çc][ãa]o|reconstru[çc][ãa]o)', 'hair',
    ),
  ],
  ['body-splash', palavras('body ?splash', 'body ?mist', 'splash', 'brume', 'fragrance mist')],
  [
    'corpo',
    palavras(
      'hidratante', 'lo[çc][ãa]o', 'lotion', 'creme', 'cream', 'body butter', 'manteiga',
      'esfoliante', 'scrub', 'sabonete', 'soap', '[óo]leo (?:corporal|de banho)', 'body oil',
      'body spray', 'desodorante', 'antitranspirante', 'shower', 'gel de banho', 'talco',
      'barbear', 'p[óo]s[- ]barba',
    ),
  ],
  [
    'perfume',
    palavras(
      'perfumes?', 'eau de (?:parfum|toilette|cologne)', 'edp', 'edt', 'parfum', 'extrait',
      'elixir', 'col[ôo]nia',
      // Variação de perfume no Bling: "La Rive Brave (Conjunto) Volume:100ml".
      'volume: ?\\d+ ?ml',
    ),
  ],
];

/** Raiz da categoria do Bling → tipo, quando o nome não diz nada. */
const REGRAS_CATEGORIA = [
  ['kit', /^kit/i],
  ['maquiagem', /^maquiage/i],
  ['capilar', /^capilar/i],
  ['body-splash', /^body splash/i],
  ['corpo', /^(hidratantes|esfoliantes|cuidado do corpo|desodorantes|granado)/i],
  ['perfume', /perfume/i],
];

/**
 * Tipo do produto, ou null quando nem o nome nem a categoria dão pista
 * segura — esse fica fora do totem até alguém classificar à mão.
 * @param {{nome?: string, categoria?: {caminho?: string} | null}} p
 * @returns {string | null}
 */
export function inferTipo(p) {
  const nome = p.nome ?? '';
  for (const [tipo, re] of REGRAS_NOME) {
    if (re.test(nome)) return tipo;
  }
  const caminho = p.categoria?.caminho ?? '';
  for (const [tipo, re] of REGRAS_CATEGORIA) {
    if (re.test(caminho)) return tipo;
  }
  return null;
}
