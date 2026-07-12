import { API_URL } from '@/config';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConsultantReply {
  /** Texto da resposta do consultor. */
  message: string;
  /** Respostas rápidas sugeridas (chips de toque). */
  quickReplies: string[];
  /** IDs de produtos do catálogo recomendados nesta resposta. */
  recommendations: string[];
  /** true quando o consultor concluiu com as recomendações finais. */
  done: boolean;
}

const REQUEST_TIMEOUT_MS = 30000;

/**
 * Envia a conversa ao backend (/sync), que injeta o catálogo e fala com a
 * API da Anthropic. A chave da API nunca chega ao tablet.
 */
export async function askConsultant(history: ChatTurn[]): Promise<ConsultantReply> {
  if (!API_URL) {
    throw new Error(
      'Consultor indisponível: configure EXPO_PUBLIC_API_URL apontando para o servidor da loja.',
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Servidor respondeu ${res.status}`);
    const data = (await res.json()) as Partial<ConsultantReply>;
    return {
      message: data.message ?? '',
      quickReplies: Array.isArray(data.quickReplies) ? data.quickReplies : [],
      recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
      done: !!data.done,
    };
  } finally {
    clearTimeout(timer);
  }
}
