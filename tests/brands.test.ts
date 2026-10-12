import { describe, expect, it } from 'vitest';

import { marcaPeloNome, normalizeBrand } from '@/logic/brands';

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

describe('marcaPeloNome', () => {
  const marcas = ['Ciclo Cosméticos', 'Lattafa', 'La Rive', 'Diversos'];

  it('acha a marca conhecida no nome, sem ligar para acento', () => {
    expect(marcaPeloNome('Body Splash - Ciclo Cosmeticos (Conjunto) Fragância:Kiss', marcas)).toBe(
      'Ciclo Cosméticos',
    );
    expect(marcaPeloNome('Yara · Body Splash Lattafa 250ml', marcas)).toBe('Lattafa');
  });

  it('só palavra inteira: "Rive" solto não é "La Rive"', () => {
    expect(marcaPeloNome('Riverside Musk', ['Rive'])).toBeNull();
    expect(marcaPeloNome('Miss Dream La Rive 100ml', marcas)).toBe('La Rive');
  });

  it('marca genérica não serve de pista', () => {
    expect(marcaPeloNome('Kit Diversos Presentes', marcas)).toBeNull();
  });
});
