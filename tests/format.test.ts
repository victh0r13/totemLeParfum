import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  daysSince,
  descricaoUtil,
  effectivePrice,
  formatAge,
  formatPrice,
  stockLabel,
} from '@/logic/format';

import { perfume } from './helpers';

describe('formatPrice', () => {
  it('omite os centavos quando são zero', () => {
    expect(formatPrice(300)).toBe('R$ 300');
  });

  it('mostra os centavos quando existem', () => {
    expect(formatPrice(359.9)).toBe('R$ 359,90');
  });

  it('usa separador de milhar brasileiro', () => {
    expect(formatPrice(1250)).toBe('R$ 1.250');
  });
});

describe('effectivePrice', () => {
  it('usa o preço de tabela quando não há oferta', () => {
    expect(effectivePrice(perfume({ preco: 300 }))).toBe(300);
  });

  it('usa o promocional quando há oferta', () => {
    expect(effectivePrice(perfume({ preco: 300, precoPromocional: 199 }))).toBe(199);
  });
});

describe('stockLabel', () => {
  it('avisa "últimas unidades" no limite configurado', () => {
    expect(stockLabel(perfume({ estoque: 3 }))).toEqual({ label: 'Últimas unidades', low: true });
  });

  it('acima do limite, mostra disponível', () => {
    expect(stockLabel(perfume({ estoque: 4 }))).toEqual({ label: 'Disponível', low: false });
  });
});

describe('descricaoUtil', () => {
  it('descarta a descrição que é só o nome repetido', () => {
    const nome = 'Hayaati - Lattafa Eau De Parfum 100ml';
    expect(descricaoUtil(nome, nome)).toBe('');
  });

  it('descarta mesmo com acento, caixa e pontuação diferentes', () => {
    expect(descricaoUtil('Íris - Deo Colônia 100ml', 'IRIS DEO COLONIA 100ML.')).toBe('');
  });

  it('descarta o nome com um sufixo curto de ruído', () => {
    const nome = 'Vodka Wild - Paris Elysees Eau De Toilette 100ml';
    expect(descricaoUtil(nome, `${nome} Original.`)).toBe('');
  });

  it('mantém descrição de verdade', () => {
    const real =
      'Notas de topo: bergamota e limão siciliano. No coração, jasmim e rosa búlgara, ' +
      'com fundo de sândalo e âmbar.';
    expect(descricaoUtil('Perfume X', real)).toBe(real);
  });

  it('trata nulo e vazio', () => {
    expect(descricaoUtil('Perfume X', null)).toBe('');
    expect(descricaoUtil('Perfume X', '   ')).toBe('');
  });
});

describe('formatAge / daysSince', () => {
  afterEach(() => vi.useRealTimers());

  const congelar = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  };

  it('trata data ausente', () => {
    expect(formatAge(null)).toBe('nunca');
    expect(daysSince(null)).toBeNull();
  });

  it('resume os primeiros minutos', () => {
    congelar('2026-07-30T12:00:30Z');
    expect(formatAge('2026-07-30T12:00:00Z')).toBe('agora há pouco');
  });

  it('conta minutos, horas e dias', () => {
    congelar('2026-07-30T12:00:00Z');
    expect(formatAge('2026-07-30T11:30:00Z')).toBe('há 30 min');
    expect(formatAge('2026-07-30T09:00:00Z')).toBe('há 3 h');
    expect(formatAge('2026-07-29T12:00:00Z')).toBe('há 1 dia');
    expect(formatAge('2026-07-25T12:00:00Z')).toBe('há 5 dias');
  });

  it('não quebra com data no futuro (relógio do tablet adiantado)', () => {
    congelar('2026-07-30T12:00:00Z');
    expect(formatAge('2026-07-30T13:00:00Z')).toBe('agora há pouco');
  });

  it('daysSince conta dias completos', () => {
    congelar('2026-07-30T12:00:00Z');
    expect(daysSince('2026-07-30T00:00:00Z')).toBe(0);
    expect(daysSince('2026-07-28T00:00:00Z')).toBe(2);
  });
});
