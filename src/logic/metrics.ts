/**
 * Métricas locais do totem (100% offline, AsyncStorage): o que os clientes
 * mais olham, pedem para experimentar e respondem no quiz. Visível no painel
 * da loja (PIN) e zerável por lá.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { QuizAnswers } from '@/types/catalog';

const KEY = 'leparfum:metricas:v1';

export interface MetricsData {
  /** Início da janela de medição (ISO). */
  desde: string;
  quizConcluidos: number;
  atendenteChamado: number;
  /** id do produto → quantas vezes a página de detalhe foi aberta. */
  produtoVisto: Record<string, number>;
  /** id do produto → toques em "Quero experimentar". */
  amostraPedida: Record<string, number>;
  /** Distribuição das respostas do quiz, por pergunta. */
  quiz: {
    quem: Record<string, number>;
    genero: Record<string, number>;
    ocasiao: Record<string, number>;
    intensidade: Record<string, number>;
    familias: Record<string, number>;
    estilo: Record<string, number>;
  };
}

const emptyMetrics = (): MetricsData => ({
  desde: new Date().toISOString(),
  quizConcluidos: 0,
  atendenteChamado: 0,
  produtoVisto: {},
  amostraPedida: {},
  quiz: { quem: {}, genero: {}, ocasiao: {}, intensidade: {}, familias: {}, estilo: {} },
});

let cache: MetricsData | null = null;

/**
 * Merge com o formato atual: dados gravados por versões anteriores podem não
 * ter todas as chaves (principalmente dentro de `quiz`), e um merge raso
 * deixaria os contadores `undefined`.
 */
function migrate(stored: Partial<MetricsData> | null): MetricsData {
  const base = emptyMetrics();
  if (!stored || typeof stored !== 'object') return base;
  const quiz = (stored.quiz ?? {}) as Partial<MetricsData['quiz']>;
  return {
    ...base,
    ...stored,
    produtoVisto: stored.produtoVisto ?? base.produtoVisto,
    amostraPedida: stored.amostraPedida ?? base.amostraPedida,
    quiz: {
      quem: quiz.quem ?? base.quiz.quem,
      genero: quiz.genero ?? base.quiz.genero,
      ocasiao: quiz.ocasiao ?? base.quiz.ocasiao,
      intensidade: quiz.intensidade ?? base.quiz.intensidade,
      familias: quiz.familias ?? base.quiz.familias,
      estilo: quiz.estilo ?? base.quiz.estilo,
    },
  };
}

async function load(): Promise<MetricsData> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = migrate(raw ? (JSON.parse(raw) as Partial<MetricsData>) : null);
  } catch {
    cache = emptyMetrics();
  }
  return cache;
}

async function persist(): Promise<void> {
  if (!cache) return;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Sem espaço/erro de IO: métricas são melhor-esforço, nunca quebram o app.
  }
}

function bump(record: Record<string, number> | undefined, key: string | null | undefined): void {
  // Métricas são melhor-esforço: nunca deixe um contador ausente quebrar o quiz.
  if (!record || !key) return;
  record[key] = (record[key] ?? 0) + 1;
}

export async function trackProdutoVisto(id: string): Promise<void> {
  const m = await load();
  bump(m.produtoVisto, id);
  await persist();
}

export async function trackAmostraPedida(id: string): Promise<void> {
  const m = await load();
  bump(m.amostraPedida, id);
  await persist();
}

export async function trackAtendenteChamado(): Promise<void> {
  const m = await load();
  m.atendenteChamado += 1;
  await persist();
}

export async function trackQuizConcluido(answers: QuizAnswers): Promise<void> {
  const m = await load();
  m.quizConcluidos += 1;
  bump(m.quiz.quem, answers.quem);
  bump(m.quiz.genero, answers.genero);
  bump(m.quiz.ocasiao, answers.ocasiao);
  bump(m.quiz.intensidade, answers.intensidade !== null ? String(answers.intensidade) : null);
  for (const f of answers.familias) bump(m.quiz.familias, f);
  bump(m.quiz.estilo, answers.estilo);
  await persist();
}

export async function getMetrics(): Promise<MetricsData> {
  const m = await load();
  return JSON.parse(JSON.stringify(m)) as MetricsData;
}

export async function resetMetrics(): Promise<void> {
  cache = emptyMetrics();
  await persist();
}
