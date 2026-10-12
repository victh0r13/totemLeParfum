/**
 * Configuração do totem.
 *
 * EXPO_PUBLIC_API_URL: URL do backend de sincronização (pasta /sync) na rede local,
 * ex.: http://192.168.0.10:3001 — usado para atualizar o catálogo sem rebuild.
 * Sem ele, o app funciona 100% offline com o catálogo em cache/bundle.
 */
export const API_URL: string | null = process.env.EXPO_PUBLIC_API_URL ?? null;

/**
 * O estoque mostrado é confiável? Só com o servidor da loja atualizando.
 * Sem ele, o número é o do dia em que o APK foi gerado — e "Últimas unidades"
 * num produto que já acabou (ou foi reposto) engana a cliente. Nesse modo o
 * totem mostra só o que está à venda, sem falar em quantidade.
 */
export const ESTOQUE_AO_VIVO = API_URL !== null;

/** Segundos de inatividade até exibir o aviso "Ainda está aí?". */
export const KIOSK_TIMEOUT_SECONDS = 90;

/** Segundos de contagem regressiva do aviso antes de voltar à tela inicial. */
export const KIOSK_WARNING_SECONDS = 15;

/** Estoque igual ou abaixo disso exibe "Últimas unidades". */
export const LOW_STOCK_THRESHOLD = 3;

/**
 * Intervalo de atualização do catálogo com o servidor da loja (o totem fica
 * ligado o dia inteiro; o sync com o Bling roda de 6 em 6 horas no PC).
 */
export const CATALOG_REFRESH_MS = 60 * 60 * 1000;

/** PIN da equipe para ações administrativas (editar ofertas, painel da loja). */
export const ADMIN_PIN = '1301';

/** Faixas de preço dos filtros do catálogo. */
export const PRICE_BUCKETS = [
  { key: 0, label: 'Até R$ 250', min: 0, max: 250 },
  { key: 1, label: 'R$ 250 – 450', min: 250, max: 450 },
  { key: 2, label: 'Acima de R$ 450', min: 450, max: Infinity },
] as const;

/**
 * Segundos parada na tela inicial até entrar o modo atração (vitrine em tela
 * cheia). Um totem parado e estático passa despercebido na loja.
 */
export const ATTRACT_IDLE_SECONDS = 45;

/** Segundos que cada destaque fica na vitrine antes de trocar. */
export const VITRINE_INTERVALO_SECONDS = 5;
