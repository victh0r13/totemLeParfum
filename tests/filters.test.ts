import { describe, expect, it } from 'vitest';

import {
  applyFilters,
  combinaCom,
  contarPorTipo,
  emptyFilters,
  hasActiveFilters,
  marcasPorContagem,
  matchesSearch,
  similarTo,
} from '@/logic/filters';

import { perfume } from './helpers';

describe('applyFilters', () => {
  it('sem filtro ativo, devolve o catálogo inteiro', () => {
    const lista = [perfume({ id: 'a' }), perfume({ id: 'b' })];
    expect(applyFilters(lista, emptyFilters)).toHaveLength(2);
  });

  it('família casa só quando o perfume tem TODAS as escolhidas', () => {
    const lista = [
      perfume({ id: 'soFloral', familias: ['floral'] }),
      perfume({ id: 'osDois', familias: ['floral', 'doce'] }),
      perfume({ id: 'soDoce', familias: ['doce'] }),
    ];
    const r = applyFilters(lista, { ...emptyFilters, familias: ['floral', 'doce'] });
    expect(r.map((p) => p.id)).toEqual(['osDois']);
  });

  it('uma família só continua trazendo todo mundo que a tem', () => {
    const lista = [
      perfume({ id: 'soFloral', familias: ['floral'] }),
      perfume({ id: 'osDois', familias: ['floral', 'doce'] }),
      perfume({ id: 'outra', familias: ['citrico'] }),
    ];
    const r = applyFilters(lista, { ...emptyFilters, familias: ['floral'] });
    expect(r.map((p) => p.id)).toEqual(['soFloral', 'osDois']);
  });

  it('produto sem família registrada some quando o filtro de família está ativo', () => {
    const lista = [perfume({ id: 'sem', familias: [] })];
    expect(applyFilters(lista, { ...emptyFilters, familias: ['floral'] })).toHaveLength(0);
  });

  it('gênero é exato: unissex não entra na busca por feminino', () => {
    const lista = [
      perfume({ id: 'f', genero: 'F' }),
      perfume({ id: 'u', genero: 'U' }),
      perfume({ id: 'nulo', genero: null }),
    ];
    const r = applyFilters(lista, { ...emptyFilters, genero: 'F' });
    expect(r.map((p) => p.id)).toEqual(['f']);
  });

  it('faixa de preço usa o PROMOCIONAL quando há oferta', () => {
    // R$ 400 de tabela, R$ 200 em oferta: tem de aparecer na faixa "até 250".
    const emOferta = perfume({ id: 'oferta', preco: 400, precoPromocional: 200 });
    const caro = perfume({ id: 'caro', preco: 400 });
    const r = applyFilters([emOferta, caro], { ...emptyFilters, priceBucket: 0 });
    expect(r.map((p) => p.id)).toEqual(['oferta']);
  });

  it('faixa de preço tem limite superior exclusivo (250 cai na faixa de cima)', () => {
    const lista = [perfume({ id: 'em250', preco: 250 })];
    expect(applyFilters(lista, { ...emptyFilters, priceBucket: 0 })).toHaveLength(0);
    expect(applyFilters(lista, { ...emptyFilters, priceBucket: 1 })).toHaveLength(1);
  });

  it('filtros combinam com E, não com OU', () => {
    const lista = [
      perfume({ id: 'match', genero: 'M', familias: ['oriental'], preco: 100 }),
      perfume({ id: 'soGenero', genero: 'M', familias: ['floral'], preco: 100 }),
    ];
    const r = applyFilters(lista, {
      ...emptyFilters,
      genero: 'M',
      familias: ['oriental'],
      priceBucket: 0,
    });
    expect(r.map((p) => p.id)).toEqual(['match']);
  });
});

describe('hasActiveFilters', () => {
  it('reconhece o estado vazio', () => {
    expect(hasActiveFilters(emptyFilters)).toBe(false);
  });

  it('detecta cada filtro isoladamente', () => {
    expect(hasActiveFilters({ ...emptyFilters, familias: ['doce'] })).toBe(true);
    expect(hasActiveFilters({ ...emptyFilters, genero: 'F' })).toBe(true);
    expect(hasActiveFilters({ ...emptyFilters, busca: 'lattafa' })).toBe(true);
    expect(hasActiveFilters({ ...emptyFilters, busca: '   ' })).toBe(false);
    // priceBucket 0 é uma faixa válida, não "sem filtro" — cuidado com falsy.
    expect(hasActiveFilters({ ...emptyFilters, priceBucket: 0 })).toBe(true);
  });
});

describe('similarTo', () => {
  const base = perfume({ id: 'base', familias: ['oriental'], genero: 'M' });

  it('nunca inclui o próprio perfume', () => {
    const r = similarTo(base, [base, perfume({ id: 'outro', familias: ['oriental'] })]);
    expect(r.map((p) => p.id)).toEqual(['outro']);
  });

  it('prioriza o mesmo gênero', () => {
    const r = similarTo(base, [
      base,
      perfume({ id: 'feminino', familias: ['oriental'], genero: 'F' }),
      perfume({ id: 'masculino', familias: ['oriental'], genero: 'M' }),
    ]);
    expect(r[0].id).toBe('masculino');
  });

  it('perfume sem família não tem similares (não inventamos relação)', () => {
    const semFamilia = perfume({ id: 'x', familias: [] });
    expect(similarTo(semFamilia, [perfume({ id: 'y', familias: ['floral'] })])).toEqual([]);
  });

  it('respeita o limite pedido', () => {
    const muitos = Array.from({ length: 10 }, (_, i) =>
      perfume({ id: `p${i}`, familias: ['oriental'] }),
    );
    expect(similarTo(base, muitos, 4)).toHaveLength(4);
  });
});


describe('matchesSearch (a lupa)', () => {
  const haya = perfume({ nome: 'Haya - Lattafa Eau de Parfum 100ml', marca: 'Lattafa' });

  it('busca vazia não filtra nada', () => {
    expect(matchesSearch(haya, '')).toBe(true);
    expect(matchesSearch(haya, '   ')).toBe(true);
  });

  it('acha por parte do nome', () => {
    expect(matchesSearch(haya, 'haya')).toBe(true);
    expect(matchesSearch(haya, 'parfum')).toBe(true);
  });

  it('acha pela MARCA — é o que substitui o filtro de marca removido', () => {
    expect(matchesSearch(haya, 'lattafa')).toBe(true);
  });

  it('ignora caixa e acento', () => {
    const iris = perfume({ nome: 'Íris Deo Colônia', marca: null });
    expect(matchesSearch(iris, 'IRIS')).toBe(true);
    expect(matchesSearch(iris, 'colonia')).toBe(true);
  });

  it('aceita palavras fora de ordem', () => {
    expect(matchesSearch(haya, 'lattafa haya')).toBe(true);
  });

  it('exige TODAS as palavras digitadas', () => {
    expect(matchesSearch(haya, 'haya armani')).toBe(false);
  });

  it('não casa com termo ausente', () => {
    expect(matchesSearch(haya, 'chanel')).toBe(false);
  });

  it('aguenta produto sem marca', () => {
    expect(matchesSearch(perfume({ nome: 'Vodka Wild', marca: null }), 'vodka')).toBe(true);
  });
});

describe('tipo de produto', () => {
  it('a aba filtra por tipo; null mostra tudo', () => {
    const lista = [
      perfume({ id: 'edp', tipo: 'perfume' }),
      perfume({ id: 'splash', tipo: 'body-splash' }),
    ];
    expect(applyFilters(lista, { ...emptyFilters, tipo: 'body-splash' }).map((p) => p.id)).toEqual([
      'splash',
    ]);
    expect(applyFilters(lista, emptyFilters)).toHaveLength(2);
  });

  it('a aba não conta como filtro ativo ("Limpar filtros" não aparece só por ela)', () => {
    expect(hasActiveFilters({ ...emptyFilters, tipo: 'kit' })).toBe(false);
  });

  it('contarPorTipo conta cada prateleira', () => {
    const lista = [
      perfume({ id: 'a', tipo: 'perfume' }),
      perfume({ id: 'b', tipo: 'perfume' }),
      perfume({ id: 'c', tipo: 'kit' }),
    ];
    expect(contarPorTipo(lista)).toEqual({ perfume: 2, 'body-splash': 0, corpo: 0, kit: 1 });
  });

  it('similares são do mesmo tipo', () => {
    const base = perfume({ id: 'base', tipo: 'perfume', familias: ['floral'] });
    const lista = [
      base,
      perfume({ id: 'outroPerfume', tipo: 'perfume', familias: ['floral'] }),
      perfume({ id: 'splash', tipo: 'body-splash', familias: ['floral'] }),
    ];
    expect(similarTo(base, lista).map((p) => p.id)).toEqual(['outroPerfume']);
  });
});

describe('combinaCom', () => {
  const edp = perfume({
    id: 'edp',
    tipo: 'perfume',
    nome: 'Kiss Me More - Ciclo Cosméticos Eau de Parfum 100ml',
    marca: 'Ciclo Cosméticos',
    familias: ['doce'],
  });

  it('a mesma linha da mesma marca vem primeiro, e nunca o mesmo tipo', () => {
    const lista = [
      edp,
      perfume({ id: 'outroEdp', tipo: 'perfume', marca: 'Ciclo Cosméticos', familias: ['doce'] }),
      perfume({
        id: 'mesmaMarca',
        tipo: 'corpo',
        nome: 'Velvety - Ciclo Cosméticos Hidratante 240ml',
        marca: 'Ciclo Cosméticos',
        preco: 50,
      }),
      perfume({
        id: 'mesmaLinha',
        tipo: 'body-splash',
        nome: 'Ciclo Body Splash Kiss Me More 200ml',
        marca: 'Ciclo Cosméticos',
        preco: 90,
      }),
    ];
    expect(combinaCom(edp, lista).map((p) => p.id)).toEqual(['mesmaLinha', 'mesmaMarca']);
  });

  it('só a família em comum, de outra marca, não basta', () => {
    const lista = [
      edp,
      perfume({ id: 'estranho', tipo: 'corpo', marca: 'Outra', familias: ['doce'] }),
    ];
    expect(combinaCom(edp, lista)).toEqual([]);
  });
});

describe('combinaCom sem marca', () => {
  it('variação do Bling sem marca ainda casa pela linha', () => {
    const edp = perfume({ id: 'edp', tipo: 'perfume', nome: 'Kiss Me More 100ml', marca: null });
    const lista = [
      edp,
      perfume({ id: 'splash', tipo: 'body-splash', nome: 'Kiss me More · Body Splash', marca: null }),
      perfume({ id: 'outro', tipo: 'body-splash', nome: 'Forever · Body Splash', marca: null }),
    ];
    expect(combinaCom(edp, lista).map((p) => p.id)).toEqual(['splash']);
  });
});

describe('marca', () => {
  it('filtra pela marca e conta como filtro ativo', () => {
    const lista = [perfume({ id: 'a', marca: 'Lattafa' }), perfume({ id: 'b', marca: 'Armaf' })];
    const f = { ...emptyFilters, marca: 'Lattafa' };
    expect(applyFilters(lista, f).map((p) => p.id)).toEqual(['a']);
    expect(hasActiveFilters(f)).toBe(true);
  });

  it('marcasPorContagem ordena da maior para a menor e ignora sem marca', () => {
    const lista = [
      perfume({ id: 'a', marca: 'Armaf' }),
      perfume({ id: 'b', marca: 'Lattafa' }),
      perfume({ id: 'c', marca: 'Lattafa' }),
      perfume({ id: 'd', marca: null }),
    ];
    expect(marcasPorContagem(lista)).toEqual([
      { marca: 'Lattafa', total: 2 },
      { marca: 'Armaf', total: 1 },
    ]);
  });
});
