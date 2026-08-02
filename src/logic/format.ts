import { LOW_STOCK_THRESHOLD } from '@/config';
import type { Perfume } from '@/types/catalog';

export function formatPrice(value: number): string {
  const hasCents = Math.round(value * 100) % 100 !== 0;
  return `R$ ${value.toLocaleString('pt-BR', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Preço que vale hoje: o promocional quando há oferta ativa. */
export function effectivePrice(p: Perfume): number {
  return p.precoPromocional ?? p.preco;
}

const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

/**
 * Boa parte dos produtos tem "descrição" no Bling que é só o nome repetido
 * ("Hayaati - Lattafa Eau De Parfum 100ml"). Exibir isso como texto do produto
 * parece erro; melhor não mostrar nada.
 */
export function descricaoUtil(nome: string, descricao: string | null | undefined): string {
  const texto = descricao?.trim() ?? '';
  if (!texto) return '';
  const limpa = semAcento(texto);
  const limpoNome = semAcento(nome);
  if (
    limpa.length <= limpoNome.length + 12 &&
    (limpa.includes(limpoNome) || limpoNome.includes(limpa))
  ) {
    return '';
  }
  return texto;
}

/** Idade de uma data ISO em linguagem de loja: "agora há pouco", "há 3 dias". */
export function formatAge(iso: string | null): string {
  if (!iso) return 'nunca';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'agora há pouco';
  const minutos = Math.floor(ms / 60000);
  if (minutos < 2) return 'agora há pouco';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

/** Dias completos desde uma data ISO (null quando a data não existe). */
export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 86400000) : null;
}

export function stockLabel(p: Perfume): { label: string; low: boolean } {
  if (p.estoque <= LOW_STOCK_THRESHOLD) return { label: 'Últimas unidades', low: true };
  return { label: 'Disponível', low: false };
}
