/**
 * Preenche as lacunas da curadoria em data/enrichment.json.
 *
 * Gênero, família olfativa, ocasião e intensidade não existem no Bling. Este
 * script deduz o que dá para deduzir com segurança (categoria do Bling, nome
 * do produto e notas da descrição) e NUNCA sobrescreve um valor já existente
 * — o que foi curado à mão continua valendo. Também inclui os perfumes novos
 * que entraram em estoque desde a última rodada.
 *
 * Uso: cd sync && npm run curar
 */
import fs from 'node:fs';

import { chamadoDireto, comoScript } from './cli.js';
import { CATALOG_PATH, ENRICHMENT_PATH } from './env.js';

/** Só entra no totem o que o Bling classifica como perfume. */
const CATEGORIA_PERFUME = /perfume/i;

/**
 * Convenções de nome do mercado de perfumaria: quando a descrição do Bling
 * não diz nada, o próprio nome comercial costuma anunciar o perfil.
 */
const NAME_HINTS = {
  floral: ['fleur', 'blossom', 'bloom', 'rosê', 'rose'],
  citrico: ['citrus', 'lemon', 'sun'],
  amadeirado: ['woody', 'wood', 'oak'],
  doce: ['sweet', 'sugar', 'candy', 'gourmand', 'delice'],
  oriental: ['noir', 'black', 'intense', 'elixir', 'royal', 'gold', 'arab'],
  fresco: ['blue', 'ocean', 'sport', 'fresh', 'aqua', 'ice', 'marine', 'breeze', 'air'],
};

const FAMILY_KEYWORDS = {
  floral: [
    'floral', 'flores', 'flor de', 'rosa', 'rosas', 'jasmim', 'peônia', 'peonia', 'lírio',
    'lirio', 'violeta', 'íris', 'iris', 'gardênia', 'gardenia', 'tuberosa', 'ylang',
    'magnólia', 'magnolia', 'orquídea', 'orquidea', 'néroli', 'neroli', 'freesia', 'frésia',
    'lilás', 'lilas', 'gerânio', 'geranio', 'mimosa', 'narciso', 'jacinto', 'açucena',
    'camélia', 'camelia', 'flor de laranjeira',
  ],
  citrico: [
    'cítric', 'citric', 'limão', 'limao', 'bergamota', 'laranja', 'tangerina', 'mandarina',
    'grapefruit', 'toranja', 'lima', 'cidra', 'yuzu', 'petitgrain',
  ],
  amadeirado: [
    'amadeirad', 'madeira', 'cedro', 'sândalo', 'sandalo', 'vetiver', 'patchouli', 'patchuli',
    'guaiac', 'teca', 'bétula', 'betula', 'cipreste', 'pinho', 'oakmoss', 'musgo de carvalho',
  ],
  doce: [
    'baunilha', 'caramelo', 'mel ', 'chocolate', 'praliné', 'praline', 'açúcar', 'acucar',
    'tonka', 'algodão doce', 'gourmand', 'cacau', 'amêndoa', 'amendoa', 'coco', 'framboesa',
    'morango', 'cereja', 'pêssego', 'pessego', 'frutas vermelhas', 'maracujá', 'maracuja',
    'manga', 'baunilh',
  ],
  oriental: [
    'âmbar', 'ambar', 'especiaria', 'oud', 'agarwood', 'incenso', 'mirra', 'olíbano',
    'olibano', 'canela', 'cardamomo', 'pimenta', 'açafrão', 'acafrao', 'resina', 'benjoim',
    'labdanum', 'cravo', 'noz-moscada', 'almíscar', 'almiscar', 'oriental', 'opoponax',
    'sensual', 'oud ',
  ],
  fresco: [
    'menta', 'hortelã', 'hortela', 'brisa', 'marinho', 'aquátic', 'aquatic', 'aqua ',
    'água', 'agua', 'verde', 'folhas', 'eucalipto', 'alecrim', 'lavanda', 'aromátic',
    'aromatic', 'ozônic', 'ozonic', 'marine', 'fresco', 'chá verde', 'cha verde', 'bambu',
    'pepino', 'sálvia', 'salvia', 'capim-limão',
  ],
};

/**
 * Fragrâncias conhecidas cuja descrição no Bling não traz as notas. A família
 * aqui vem do perfil real do perfume, não de heurística — é curadoria de
 * verdade, só que escrita em código para sobreviver ao próximo sync.
 * A primeira regra que casar com o nome vence.
 */
const CONHECIDOS = [
  [/acqua di gio/i, ['fresco', 'citrico']],
  [/armani code/i, ['oriental', 'amadeirado']],
  [/polo blue/i, ['fresco', 'amadeirado']],
  [/\bch\b.*carolina herrera|carolina herrera\b(?!.*212)/i, ['floral', 'amadeirado']],
  [/212 vip ros/i, ['doce', 'floral']],
  [/la vie est belle/i, ['doce', 'floral']],
  [/le male/i, ['doce', 'oriental']],
  [/\blibre\b.*saint laurent|saint laurent.*\blibre\b/i, ['floral', 'oriental']],
  [/\bone\b.*calvin klein/i, ['citrico', 'fresco']],
  [/silver scent/i, ['fresco', 'amadeirado']],
  [/azarro pour homme|azzaro pour homme/i, ['fresco', 'amadeirado']],
  [/phantom/i, ['citrico', 'doce']],
  [/amber rouge/i, ['oriental', 'doce']],
  [/asad bourbon/i, ['doce', 'oriental']],
  [/baroque rouge/i, ['doce', 'oriental']],
  [/musk abiyad/i, ['floral', 'doce']],
  [/club de nuit intense woman/i, ['floral', 'doce']],
  [/eclaire pistache/i, ['doce', 'amadeirado']],
  [/\bhaya\b/i, ['floral', 'doce']],
  [/hayaati/i, ['amadeirado', 'oriental']],
  [/ameerati/i, ['floral', 'doce']],
  [/icon woman/i, ['floral', 'doce']],
  [/315 prestige pink/i, ['doce', 'floral']],
  [/315 prestige/i, ['oriental', 'doce']],
  [/absolute sport/i, ['fresco', 'citrico']],
];

const GENDER_FROM_NAME = [
  // Feminino antes de masculino: "women" contém "men".
  [/\b(feminin[oa]s?|women|woman|femme|femenino|for her|lady|ladies|girl|elle|mademoiselle|madame|she)\b/i, 'F'],
  [/\b(masculin[oa]s?|men|man|homme|hombre|for him|male|boy|he)\b/i, 'M'],
  [/\b(unissex|unisex)\b/i, 'U'],
];

/** Concentração → intensidade percebida. */
const INTENSITY_RULES = [
  [/\b(extrait|parfum de perfume|elixir|intense|absolu)\b/i, 3],
  [/\b(eau de parfum|edp)\b/i, 2],
  [/\b(eau de toilette|edt)\b/i, 1],
  [/\b(body splash|deo col[ôo]nia|col[ôo]nia|eau fraiche|splash)\b/i, 1],
];

const OCCASION_BY_FAMILY = {
  floral: ['dia', 'trabalho'],
  citrico: ['dia', 'esporte'],
  fresco: ['esporte', 'dia'],
  amadeirado: ['trabalho', 'noite'],
  oriental: ['noite'],
  doce: ['noite', 'dia'],
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

const norm = (s) => (s ?? '').toLowerCase();

function inferGenero(p) {
  // 1. Categoria do Bling é a fonte mais confiável ("... > Perfume Feminino").
  const caminho = norm(p.categoria?.caminho);
  if (/feminin/.test(caminho)) return 'F';
  if (/masculin/.test(caminho)) return 'M';
  if (/unissex|unisex/.test(caminho)) return 'U';

  // 2. Nome do produto.
  for (const [re, genero] of GENDER_FROM_NAME) {
    if (re.test(p.nome)) return genero;
  }

  // 3. Descrição, só quando é explícita.
  const desc = norm(p.descricao);
  if (/perfume feminino|fragr[âa]ncia feminina|para elas\b/.test(desc)) return 'F';
  if (/perfume masculino|fragr[âa]ncia masculina|para eles\b/.test(desc)) return 'M';
  return null;
}

/** Até 2 famílias, pelas palavras que mais aparecem no nome + descrição. */
function inferFamilias(p) {
  for (const [re, familias] of CONHECIDOS) {
    if (re.test(p.nome)) return familias;
  }
  const texto = `${norm(p.nome)} ${norm(p.descricao)}`;
  const nome = norm(p.nome);
  const pontos = [];
  for (const [familia, palavras] of Object.entries(FAMILY_KEYWORDS)) {
    // Pista no nome comercial vale como uma menção — sem dominar as notas reais.
    let n = (NAME_HINTS[familia] ?? []).some((h) => nome.includes(h)) ? 1 : 0;
    for (const palavra of palavras) {
      // Conta ocorrências: 3 menções de notas florais valem mais que 1.
      let from = 0;
      for (;;) {
        const at = texto.indexOf(palavra, from);
        if (at < 0) break;
        n++;
        from = at + palavra.length;
      }
    }
    if (n > 0) pontos.push({ familia, n });
  }
  return pontos
    .sort((a, b) => b.n - a.n)
    .slice(0, 2)
    .map((x) => x.familia);
}

function inferIntensidade(p) {
  const texto = `${p.nome} ${p.descricao ?? ''}`;
  for (const [re, valor] of INTENSITY_RULES) {
    if (re.test(texto)) return valor;
  }
  return 2;
}

function inferOcasioes(familias, intensidade) {
  const set = new Set();
  for (const f of familias) {
    for (const o of OCCASION_BY_FAMILY[f] ?? []) set.add(o);
  }
  if (set.size === 0) {
    // Sem família: a intensidade decide sozinha.
    if (intensidade >= 3) set.add('noite');
    else if (intensidade === 1) set.add('dia');
    else {
      set.add('dia');
      set.add('noite');
    }
  }
  return [...set];
}

/**
 * Completa lacunas da curadoria e inclui perfumes novos que entraram em estoque.
 * @returns {{novos: number, generos: number, familias: number}}
 */
export function runCurate() {
  const catalog = readJson(CATALOG_PATH, { produtos: [] });
  const file = readJson(ENRICHMENT_PATH, { produtos: {} });
  const entries = file.produtos ?? {};

  const inStock = (catalog.produtos ?? []).filter((p) => Number(p.estoque) > 0);
  const chaveDe = (p) => (entries[p.id] ? p.id : p.codigo && entries[p.codigo] ? p.codigo : null);

  /**
   * Ids que este script já incluiu alguma vez. Se um deles não tem mais
   * entrada, foi a equipe que tirou o produto do totem de propósito — e não
   * pode ser re-incluído na próxima rodada automática.
   */
  const autoIncluidos = new Set(
    file._autoIncluidos?.length ? file._autoIncluidos : Object.keys(entries),
  );
  const removidosPelaEquipe = [...autoIncluidos].filter((id) => !entries[id]);

  let novos = 0;
  let generos = 0;
  let familias = 0;
  let semGenero = 0;
  let semFamilia = 0;

  // 1. Perfumes que entraram em estoque e ainda não estão na curadoria.
  for (const p of inStock) {
    if (chaveDe(p)) continue;
    if (!CATEGORIA_PERFUME.test(p.categoria?.caminho ?? '')) continue;
    if (autoIncluidos.has(p.id)) continue; // tirado do totem pela equipe
    const fam = inferFamilias(p);
    const intensidade = inferIntensidade(p);
    entries[p.id] = {
      nome: p.nome,
      genero: inferGenero(p) ?? undefined,
      familias: fam.length ? fam : undefined,
      ocasioes: inferOcasioes(fam, intensidade),
      intensidade,
    };
    // Remove os campos indefinidos para o JSON ficar limpo.
    for (const k of Object.keys(entries[p.id])) {
      if (entries[p.id][k] === undefined) delete entries[p.id][k];
    }
    autoIncluidos.add(p.id);
    novos++;
  }

  // 2. Completa lacunas do que já está na curadoria (sem sobrescrever nada).
  for (const p of inStock) {
    const chave = chaveDe(p);
    if (!chave) continue;
    const entry = entries[chave];

    if (!entry.genero) {
      const g = inferGenero(p);
      if (g) {
        entry.genero = g;
        generos++;
      } else {
        semGenero++;
      }
    }
    if (!entry.familias?.length) {
      const f = inferFamilias(p);
      if (f.length) {
        entry.familias = f;
        familias++;
      } else {
        semFamilia++;
      }
    }
    if (!entry.intensidade) entry.intensidade = inferIntensidade(p);
    if (!entry.ocasioes?.length) {
      entry.ocasioes = inferOcasioes(entry.familias ?? [], entry.intensidade);
    }
    if (!entry.nome) entry.nome = p.nome;
  }

  file.produtos = entries;
  file._autoIncluidos = [...autoIncluidos].sort();
  fs.writeFileSync(ENRICHMENT_PATH, JSON.stringify(file, null, 2), 'utf8');

  const curados = inStock.filter((p) => chaveDe(p));
  console.log(`[ok] ${novos} perfume(s) novo(s) incluído(s) na curadoria.`);
  if (removidosPelaEquipe.length > 0) {
    console.log(
      `[ok] ${removidosPelaEquipe.length} produto(s) removido(s) pela equipe continuam fora do totem.`,
    );
  }
  console.log(`[ok] ${generos} gênero(s) e ${familias} família(s) preenchidos.`);
  console.log(
    `[info] Curadoria: ${curados.length} produtos — ` +
      `${semGenero} ainda sem gênero, ${semFamilia} ainda sem família.`,
  );
  if (semGenero || semFamilia) {
    console.log('[info] Os restantes não têm pista no nome nem na descrição do Bling;');
    console.log('       preencha à mão em data/enrichment.json se quiser cobri-los.');
  }

  return { novos, generos, familias };
}

if (chamadoDireto(import.meta.url)) comoScript(runCurate);
