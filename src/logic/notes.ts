/**
 * Extração da pirâmide olfativa (topo/coração/fundo) a partir da descrição
 * livre que vem do Bling. Heurístico e conservador: quando a descrição não
 * traz notas estruturadas ("Notas de topo: ..."), retorna null e a tela
 * exibe somente o texto original.
 *
 * Validado contra as descrições reais da curadoria (22/30 com pirâmide).
 */

export interface OlfactoryNotes {
  topo?: string[];
  coracao?: string[];
  fundo?: string[];
}

type SectionKey = keyof OlfactoryNotes;

const MARKER =
  /\b(?:as\s+)?notas?\s+d[eo]\s+(topo|sa[ií]da|cora[çc][ãa]o|corpo|fundo|base)\b/gi;

/** Onde a lista de notas termina e o texto de marketing recomeça. */
const STOP_RE =
  /[.;!?]|\b(?:ocasi[õo]es?|benef[ií]cios?|ideal|perfeit[oa]|proporcion\w*|confer\w*|cria(?:m|ndo)?|garant\w*|traz(?:em|endo)?|remet\w*|deix\w*|torna\w*|intensific\w*|surgem|permanecem|envolv\w*|evoc\w*|combin\w*|harmoniz\w*|equilibr\w*|destac\w*|real[çc]\w*|finaliz\w*|complet\w*|adicion\w*|encerr\w*|selam?\b)/i;

/** Itens que começam com conectivo/pronome são sobras de frase, não notas. */
const DROP_START =
  /^(que|com|como|para|em|uma?|uns?|as?|os?|do|da|dos|das|no|na|se|já|logo|geralmente|algumas?|sempre|muito|bem|essa|esse|esta|este|elas?|eles?|numa?|sua?|seu|enquanto|onde|quando)\b/i;

/** Palavras de marketing que denunciam frase solta em vez de nota olfativa. */
const NOISE =
  /\b(fixa[çc][ãa]o|durabilidade|perfume|fragr[âa]ncia|composi[çc][ãa]o|assinatura|aroma|sensa[çc][ãa]o|toque|pele|abertura|respons[áa]v\w*|caracter[íi]stic\w*|conhecid\w*|brilho|vivacidade|sedutor\w*|marcante|elegante|eleg[âa]ncia|sofisticad\w*|envolvente|irresist[íi]vel|aconchegante|luminos[oa]|vibrantes?|rom[âa]ntic[oa]|sexy|delicad[oa]|profundidade|masculin\w*|feminin\w*|explos[ãa]o|buqu[êe]|virilidade|seguran[çc]a|for[çc]a|coragem|refer[êe]ncia)\b/i;

/** "Notas de topo, coração e fundo:" — cabeçalho combinado, sem lista própria. */
const SECTION_HEADER = /^[\s,]*(?:cora[çc][ãa]o|fundo|base|topo|sa[ií]da)\b/i;

function normKey(k: string): SectionKey {
  const s = k.toLowerCase();
  if (s.startsWith('topo') || s.startsWith('sa')) return 'topo';
  if (s.startsWith('cora') || s.startsWith('corpo')) return 'coracao';
  return 'fundo';
}

function parseItems(raw: string): string[] {
  let c = raw.replace(/^[\s:：,–-]*/, '');
  if (SECTION_HEADER.test(c)) return [];
  c = c.replace(/^\([^)]*\)\s*[:：]?\s*/, '');
  // "de <Nome do Perfume> são dominadas por..." — referência ao próprio produto.
  c = c.replace(
    /^d[eo]\s+[A-ZÀ-Ú][\wÀ-ú'’-]*(\s+[\wÀ-ú'’-]+){0,3}?\s+(?=s[ãa]o\b|é\b|dominad|compost|marcad|revelam|trazem)/,
    '',
  );
  c = c.replace(/^s[ãa]o\s*[:：]?\s*/i, '');
  c = c.replace(
    /^(?:dominad[ao]s?\s+(?:por|pel[ao]s?)|compost[ao]s?\s+(?:por|pel[ao]s?)|marcad[ao]s?\s+(?:por|pel[ao]s?)|formad[ao]s?\s+(?:por|pel[ao]s?)|constitu[íi]d[ao]s?\s+(?:por|pel[ao]s?)|trazem|revelam|incluem|apresentam)\s*/i,
    '',
  );
  c = c.replace(
    /^(?:uma?\s+(?:explos[ãa]o|mistura|combina[çc][ãa]o)\s+(?:oriental\s+)?de\s+)/i,
    '',
  );
  c = c.replace(/^d[eo]\s+(?=[a-zà-ú])/, '');
  c = c.replace(/^[\s:：]*/, '');
  const stop = c.search(STOP_RE);
  if (stop >= 0) c = c.slice(0, stop);
  c = c.replace(/\([^)]*\)/g, ' ');
  return c
    .split(/,|\se\s/i)
    .map((s) => s.split(/[:：]/)[0])
    .map((s) => s.trim().replace(/^[eE]\s+/, '').replace(/\s+/g, ' '))
    .filter((s) => s.length >= 3 && s.length <= 42 && s.split(' ').length <= 5)
    .filter((s) => !DROP_START.test(s))
    .filter((s) => !/\bque\b/i.test(s))
    .filter((s) => !NOISE.test(s))
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

interface Section {
  key: SectionKey;
  markerStart: number;
  contentStart: number;
  contentEnd: number;
  items: string[];
}

function findSections(descricao: string): Section[] {
  const sections: Section[] = [];
  const matches = [...descricao.matchAll(MARKER)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const markerStart = m.index ?? 0;
    const contentStart = markerStart + m[0].length;
    const contentEnd = i + 1 < matches.length ? (matches[i + 1].index ?? descricao.length) : descricao.length;
    sections.push({
      key: normKey(m[1]),
      markerStart,
      contentStart,
      contentEnd,
      items: parseItems(descricao.slice(contentStart, contentEnd)),
    });
  }
  return sections;
}

/**
 * Separa a descrição em pirâmide olfativa + texto restante (descrição sem os
 * trechos de notas, para não exibir a mesma informação duas vezes).
 */
export function splitNotes(descricao: string | null | undefined): {
  notas: OlfactoryNotes | null;
  resto: string;
} {
  const texto = (descricao ?? '').trim();
  if (!texto) return { notas: null, resto: '' };

  const sections = findSections(texto);
  const notas: OlfactoryNotes = {};
  for (const s of sections) {
    if (s.items.length > (notas[s.key]?.length ?? 0)) notas[s.key] = s.items;
  }
  const total = Object.values(notas).reduce((sum, arr) => sum + (arr?.length ?? 0), 0);
  if (total < 2) return { notas: null, resto: texto };

  // Remove da descrição a frase inteira de cada seção de notas.
  let resto = '';
  let cursor = 0;
  for (const s of sections) {
    resto += texto.slice(cursor, s.markerStart);
    const period = texto.indexOf('.', s.contentStart);
    cursor = Math.min(
      period >= 0 && period < s.contentEnd ? period + 1 : s.contentEnd,
      texto.length,
    );
  }
  resto += texto.slice(cursor);
  resto = resto.replace(/\s+/g, ' ').replace(/\s+([.,;!?])/g, '$1').trim();
  if (resto.length < 40) resto = '';

  return { notas, resto };
}
