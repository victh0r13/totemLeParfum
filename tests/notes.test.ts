import { describe, expect, it } from 'vitest';

import { splitNotes } from '@/logic/notes';

/**
 * A pirâmide olfativa é extraída por heurística de um texto livre escrito por
 * humanos no Bling — é a lógica mais frágil do projeto. Estes testes fixam o
 * comportamento nos dois sentidos: o que ela DEVE reconhecer e, principalmente,
 * o que ela NÃO pode inventar. Exibir "Notas de topo: uma fragrância marcante"
 * é pior que não exibir pirâmide nenhuma.
 */
describe('splitNotes', () => {
  it('não inventa pirâmide onde não há', () => {
    const texto = 'Um perfume marcante e elegante, ideal para a noite.';
    expect(splitNotes(texto)).toEqual({ notas: null, resto: texto });
  });

  it('trata vazio, nulo e indefinido', () => {
    expect(splitNotes('')).toEqual({ notas: null, resto: '' });
    expect(splitNotes(null)).toEqual({ notas: null, resto: '' });
    expect(splitNotes(undefined)).toEqual({ notas: null, resto: '' });
  });

  it('extrai as três camadas de uma descrição bem estruturada', () => {
    const { notas } = splitNotes(
      'Notas de topo: bergamota, limão e mandarina. ' +
        'Notas de coração: jasmim, rosa e ylang. ' +
        'Notas de fundo: sândalo, âmbar e baunilha.',
    );
    expect(notas?.topo).toEqual(['Bergamota', 'Limão', 'Mandarina']);
    expect(notas?.coracao).toEqual(['Jasmim', 'Rosa', 'Ylang']);
    expect(notas?.fundo).toEqual(['Sândalo', 'Âmbar', 'Baunilha']);
  });

  it('aceita as variações de nome das camadas (saída/corpo/base)', () => {
    const { notas } = splitNotes(
      'Notas de saída: laranja e limão. Notas de corpo: lavanda e cravo. ' +
        'Notas de base: cedro e musgo.',
    );
    expect(notas?.topo).toEqual(['Laranja', 'Limão']);
    expect(notas?.coracao).toEqual(['Lavanda', 'Cravo']);
    expect(notas?.fundo).toEqual(['Cedro', 'Musgo']);
  });

  it('remove da descrição o trecho que virou pirâmide, sem duplicar', () => {
    const { resto } = splitNotes(
      'Uma fragrância criada para durar o dia inteiro e acompanhar você em ' +
        'qualquer ocasião especial. Notas de topo: bergamota, limão e mandarina. ' +
        'Notas de fundo: sândalo, âmbar e baunilha.',
    );
    expect(resto).not.toContain('bergamota');
    expect(resto).not.toContain('Notas de topo');
    expect(resto).toContain('durar o dia inteiro');
  });

  it('não trata frase de marketing como nota olfativa', () => {
    const { notas } = splitNotes(
      'Notas de topo que garantem uma fixação incrível e uma sensação de elegância.',
    );
    expect(notas).toBeNull();
  });

  it('descarta itens que são sobra de frase, não ingrediente', () => {
    const { notas } = splitNotes(
      'Notas de topo: bergamota, limão e mandarina. ' +
        'Notas de fundo: sândalo, âmbar e baunilha, que proporcionam elegância.',
    );
    const todos = [...(notas?.topo ?? []), ...(notas?.fundo ?? [])];
    expect(todos.every((n) => !/que |proporcionam|elegância/i.test(n))).toBe(true);
  });

  it('exige pelo menos duas notas para valer como pirâmide', () => {
    expect(splitNotes('Notas de topo: bergamota.').notas).toBeNull();
  });

  it('não devolve nota absurdamente longa (sinal de frase capturada por engano)', () => {
    const { notas } = splitNotes(
      'Notas de topo: bergamota, limão e uma combinação sofisticada de ingredientes ' +
        'nobres cuidadosamente selecionados ao redor do mundo.',
    );
    const todos = Object.values(notas ?? {}).flat();
    expect(todos.every((n) => n.length <= 42)).toBe(true);
  });

  it('capitaliza a primeira letra de cada nota', () => {
    const { notas } = splitNotes('Notas de topo: bergamota, limão e mandarina.');
    expect(notas?.topo?.every((n) => n[0] === n[0].toUpperCase())).toBe(true);
  });

  it('descarta resto muito curto em vez de deixar um fiapo de frase', () => {
    const { resto } = splitNotes(
      'Ótimo. Notas de topo: bergamota, limão e mandarina. Notas de fundo: cedro e âmbar.',
    );
    expect(resto).toBe('');
  });
});
