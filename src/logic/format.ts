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

export function stockLabel(p: Perfume): { label: string; low: boolean } {
  if (p.estoque <= LOW_STOCK_THRESHOLD) return { label: 'Últimas unidades', low: true };
  return { label: 'Disponível', low: false };
}
