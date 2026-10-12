import { describe, expect, it } from 'vitest';

import { capaDoTipo, destaques, embaralhar, sementeDoDia } from '@/logic/vitrine';

import { perfume } from './helpers';

const todosComFoto = () => true;

describe('embaralhar', () => {
  it('mesma semente, mesma ordem; sem perder nem duplicar ninguém', () => {
    const lista = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(embaralhar(lista, 42)).toEqual(embaralhar(lista, 42));
    expect([...embaralhar(lista, 42)].sort()).toEqual(lista);
  });

  it('não mexe na lista original', () => {
    const lista = [1, 2, 3];
    embaralhar(lista, 7);
    expect(lista).toEqual([1, 2, 3]);
  });
});

describe('destaques', () => {
  it('ofertas vêm primeiro', () => {
    const lista = [
      perfume({ id: 'a' }),
      perfume({ id: 'oferta', precoPromocional: 199 }),
      perfume({ id: 'b' }),
    ];
    expect(destaques(lista, todosComFoto, 3, 1)[0].id).toBe('oferta');
  });

  it('só entra produto com foto e com estoque', () => {
    const lista = [
      perfume({ id: 'semFoto' }),
      perfume({ id: 'comFoto' }),
      perfume({ id: 'esgotado', estoque: 0 }),
    ];
    const r = destaques(lista, (p) => p.id !== 'semFoto', 5, 1);
    expect(r.map((p) => p.id)).toEqual(['comFoto']);
  });

  it('alterna os tipos em vez de enfileirar só perfume', () => {
    const lista = [
      ...Array.from({ length: 6 }, (_, i) => perfume({ id: `p${i}`, tipo: 'perfume' })),
      perfume({ id: 'splash', tipo: 'body-splash' }),
      perfume({ id: 'hidratante', tipo: 'corpo' }),
    ];
    const tipos = destaques(lista, todosComFoto, 4, 1).map((p) => p.tipo);
    expect(tipos).toEqual(['perfume', 'body-splash', 'perfume', 'corpo']);
  });
});

describe('capaDoTipo', () => {
  it('devolve um produto do tipo pedido, ou null se não houver', () => {
    const lista = [perfume({ id: 'kit', tipo: 'kit' }), perfume({ id: 'edp', tipo: 'perfume' })];
    expect(capaDoTipo(lista, 'kit', todosComFoto, 1)?.id).toBe('kit');
    expect(capaDoTipo(lista, 'corpo', todosComFoto, 1)).toBeNull();
  });
});

describe('sementeDoDia', () => {
  it('muda de um dia para o outro', () => {
    expect(sementeDoDia(new Date(2026, 9, 12))).toBe(20261012);
    expect(sementeDoDia(new Date(2026, 9, 13))).not.toBe(20261012);
  });
});
