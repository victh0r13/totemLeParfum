import type { Familia, Intensidade, Ocasiao, Perfume, QuizAnswers } from '@/types/catalog';

export interface QuizOption {
  value: string | number;
  label: string;
  sublabel?: string;
}

export interface QuizQuestion {
  key: keyof QuizAnswers;
  title: string;
  subtitle?: string;
  columns: 1 | 2;
  multi?: boolean;
  maxSelections?: number;
  options: QuizOption[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    key: 'quem',
    title: 'Para quem é o perfume?',
    columns: 1,
    options: [
      { value: 'mim', label: 'Para mim', sublabel: 'Minha próxima assinatura' },
      { value: 'presente', label: 'É um presente', sublabel: 'Para surpreender alguém especial' },
    ],
  },
  {
    key: 'ocasiao',
    title: 'Quando você mais vai usá-lo?',
    columns: 2,
    options: [
      { value: 'trabalho', label: 'Trabalho', sublabel: 'Presença discreta e elegante' },
      { value: 'dia', label: 'Dia a dia', sublabel: 'Versátil, para qualquer momento' },
      { value: 'noite', label: 'Noite & eventos', sublabel: 'Para deixar sua marca' },
      { value: 'esporte', label: 'Esporte & ar livre', sublabel: 'Frescor que acompanha o ritmo' },
    ],
  },
  {
    key: 'intensidade',
    title: 'Qual intensidade prefere?',
    columns: 1,
    options: [
      { value: 1, label: 'Leve', sublabel: 'Um sussurro, quase pele' },
      { value: 2, label: 'Moderada', sublabel: 'Presente, sem dominar o ambiente' },
      { value: 3, label: 'Marcante', sublabel: 'Entra na sala antes de você' },
    ],
  },
  {
    key: 'familias',
    title: 'Quais aromas agradam?',
    subtitle: 'Escolha até 2 famílias',
    columns: 2,
    multi: true,
    maxSelections: 2,
    options: [
      { value: 'floral', label: 'Floral', sublabel: 'Rosa, jasmim, pétalas brancas' },
      { value: 'citrico', label: 'Cítrico', sublabel: 'Limão, bergamota, laranja' },
      { value: 'amadeirado', label: 'Amadeirado', sublabel: 'Cedro, sândalo, vetiver' },
      { value: 'doce', label: 'Doce', sublabel: 'Baunilha, caramelo, mel' },
      { value: 'oriental', label: 'Oriental', sublabel: 'Âmbar, especiarias, oud' },
      { value: 'fresco', label: 'Fresco', sublabel: 'Brisa, folhas verdes, menta' },
    ],
  },
  {
    key: 'estilo',
    title: 'Como é o seu estilo?',
    columns: 1,
    options: [
      { value: 'classico', label: 'Clássico & elegante', sublabel: 'Atemporal, refinado, impecável' },
      { value: 'moderno', label: 'Moderno & ousado', sublabel: 'Gosto de causar impressão' },
      { value: 'natural', label: 'Natural & discreto', sublabel: 'Leveza e simplicidade acima de tudo' },
    ],
  },
];

export const emptyAnswers: QuizAnswers = {
  quem: null,
  ocasiao: null,
  intensidade: null,
  familias: [],
  estilo: null,
};

const styleFamilies: Record<NonNullable<QuizAnswers['estilo']>, Familia[]> = {
  classico: ['floral', 'amadeirado'],
  moderno: ['oriental', 'doce'],
  natural: ['fresco', 'citrico'],
};

/**
 * Pontua um perfume contra as respostas. Usa somente dados do enrichment.json —
 * produtos não enriquecidos não pontuam e ficam fora das sugestões.
 */
export function scorePerfume(p: Perfume, a: QuizAnswers): number {
  if (!p.enriquecido) return 0;
  let score = 0;
  if (a.familias.length > 0 && p.familias.some((f) => a.familias.includes(f))) score += 3;
  if (a.ocasiao && p.ocasioes.includes(a.ocasiao)) score += 2;
  if (a.intensidade && p.intensidade !== null) {
    score += Math.max(0, 2 - Math.abs(p.intensidade - a.intensidade));
  }
  if (a.estilo && p.familias.some((f) => styleFamilies[a.estilo!].includes(f))) score += 1;
  if (a.quem === 'presente' && p.genero === 'U') score += 1;
  return score;
}

/** Ranqueia o catálogo (apenas itens com estoque) e retorna 3–5 sugestões reais. */
export function rankPerfumes(perfumes: Perfume[], answers: QuizAnswers): Perfume[] {
  const inStock = perfumes.filter((p) => p.estoque > 0);
  const scored = inStock
    .map((p) => ({ p, score: scorePerfume(p, answers) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.p.preco - b.p.preco);

  const results = scored.slice(0, 5).map(({ p }) => p);

  // Garante ao menos 3 sugestões preenchendo com enriquecidos disponíveis.
  if (results.length < 3) {
    for (const p of inStock) {
      if (results.length >= 3) break;
      if (p.enriquecido && !results.some((r) => r.id === p.id)) results.push(p);
    }
  }
  return results;
}
