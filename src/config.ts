/**
 * Configuração do totem.
 *
 * EXPO_PUBLIC_API_URL: URL do backend de sincronização (pasta /sync) na rede local,
 * ex.: http://192.168.0.10:3001 — usado pelo consultor virtual (IA) e pela
 * atualização do catálogo sem rebuild. Sem ele, o app funciona offline com o
 * catálogo em cache/bundle, e o consultor exibe o fallback para o quiz.
 */
export const API_URL: string | null = process.env.EXPO_PUBLIC_API_URL ?? null;

/** Segundos de inatividade até exibir o aviso "Ainda está aí?". */
export const KIOSK_TIMEOUT_SECONDS = 90;

/** Segundos de contagem regressiva do aviso antes de voltar à tela inicial. */
export const KIOSK_WARNING_SECONDS = 15;

/** Estoque igual ou abaixo disso exibe "Últimas unidades". */
export const LOW_STOCK_THRESHOLD = 3;

/** Faixas de preço dos filtros do catálogo. */
export const PRICE_BUCKETS = [
  { key: 0, label: 'Até R$ 250', min: 0, max: 250 },
  { key: 1, label: 'R$ 250 – 450', min: 250, max: 450 },
  { key: 2, label: 'Acima de R$ 450', min: 450, max: Infinity },
] as const;
