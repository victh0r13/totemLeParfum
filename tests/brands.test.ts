import { describe, expect, it } from 'vitest';

import { normalizeBrand } from '@/logic/brands';

describe('normalizeBrand', () => {
  it('funde variações de caixa da mesma marca', () => {
    expect(normalizeBrand('jacques bogart')).toBe(normalizeBrand('Jacques Bogart'));
    expect(normalizeBrand('JOOP!')).toBe(normalizeBrand('joop!'));
  });

  it('corrige os erros de digitação conhecidos do cadastro', () => {
    expect(normalizeBrand('Antonio Bandares')).toBe('Antonio Banderas');
    expect(normalizeBrand('Parys Elysees')).toBe('Paris Elysees');
    expect(normalizeBrand('Aarmani')).toBe('Armani');
    expect(normalizeBrand('Ralph Laurent')).toBe('Ralph Lauren');
    expect(normalizeBrand('Azarro')).toBe('Azzaro');
  });

  it('preserva siglas em caixa alta', () => {
    expect(normalizeBrand('ch')).toBe('CH');
    expect(normalizeBrand('ysl')).toBe('YSL');
  });

  it('deixa partículas em minúscula no meio do nome', () => {
    expect(normalizeBrand('jean paul gaultier')).toBe('Jean Paul Gaultier');
    expect(normalizeBrand('maison de parfum')).toBe('Maison de Parfum');
  });

  it('devolve null quando não há marca — "sem marca" não é uma marca', () => {
    expect(normalizeBrand(null)).toBeNull();
    expect(normalizeBrand(undefined)).toBeNull();
    expect(normalizeBrand('   ')).toBeNull();
  });

  it('normaliza espaços em excesso', () => {
    expect(normalizeBrand('  La   Rive  ')).toBe('La Rive');
  });
});
