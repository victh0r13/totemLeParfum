import { describe, expect, it } from 'vitest';

import { inferTipo, TIPOS_NO_TOTEM } from '../sync/src/tipos.js';

const tipo = (nome: string, caminho?: string) =>
  inferTipo({ nome, categoria: caminho ? { caminho } : null });

describe('inferTipo', () => {
  it('o nome vence a categoria: body splash dentro de "Perfumes & Colônias"', () => {
    expect(
      tipo('Move - Body Splash Ciclo Cosméticos 200ml', 'Perfumes & Colônias > Ciclo Cosméticos'),
    ).toBe('body-splash');
  });

  it('reconhece perfume sem categoria pelo nome comercial', () => {
    expect(tipo('Dior Sauvage Edp 100ml Masculino Original')).toBe('perfume');
    expect(tipo('Billion For Men - Paris Elysees Eau De Toilette 100ml')).toBe('perfume');
    expect(tipo('La Rive Brave (Conjunto) Volume:100ml')).toBe('perfume');
  });

  it('kit de perfume é kit; kit de maquiagem é maquiagem', () => {
    expect(tipo('Kit Cuté La Rive - Perfume 100ml + Desodorante 150ml')).toBe('kit');
    expect(tipo('Niina Secrets - Kit Queridinhos (batom rose+gloss crystal)')).toBe('maquiagem');
  });

  it('corpo & banho: hidratante, esfoliante, body spray', () => {
    expect(tipo('Pear Glace Victoria\'s Secret - Hidratante - 236ml')).toBe('corpo');
    expect(tipo('Watermelon - Tree Hut Shea Sugar Scrub Esfoliante Corporal 510g')).toBe('corpo');
    expect(tipo('Fakhar Black - Lattafa Deo Body Spray 200ml')).toBe('corpo');
  });

  it('palavra que começa com acento também casa ("Óleo")', () => {
    expect(tipo('Óleo Corporal Desodorante 200ml')).toBe('corpo');
  });

  it('capilar vence body splash ("Mist Capilar")', () => {
    expect(tipo('Body Mist Capilar Perfumado 120ml')).toBe('capilar');
  });

  it('cai na categoria quando o nome não diz nada', () => {
    expect(tipo('Melancia - Labotrat dia a dia 190ml', 'Hidratantes > Labotrat')).toBe('corpo');
    expect(tipo('Verbena + Bamboo 3 Itens', "Kit's > Labotrat")).toBe('kit');
  });

  it('vale-presente e sem pista nenhuma ficam fora do totem', () => {
    expect(tipo('Vale Presente Le Parfum - 0053')).toBe('outro');
    expect(TIPOS_NO_TOTEM.has('outro')).toBe(false);
    expect(tipo('Acido Salicilico')).toBeNull();
  });

  it('"Nova Embalagem" no nome não tira o perfume do totem', () => {
    expect(tipo('Hello Hello! Deo Colônia Lata - Perfume Feminino 100ml Nova Embalagem')).toBe(
      'perfume',
    );
  });
});
