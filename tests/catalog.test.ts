import { describe, expect, it } from 'vitest';

import { mergeCatalog } from '@/logic/catalog';
import type { ProdutoLocal, TotemPayload } from '@/types/catalog';

const payload = (over: Partial<TotemPayload> = {}): TotemPayload => ({
  generatedAt: '2026-07-30T00:00:00Z',
  source: 'bling',
  produtos: [],
  enrichment: {},
  ...over,
});

const produto = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  codigo: 'SKU1',
  nome: 'Perfume Teste',
  marca: 'Marca',
  preco: 300,
  estoque: 10,
  imagem: null,
  descricao: null,
  ...over,
});

describe('mergeCatalog', () => {
  it('aplica o enrichment sobre o produto', () => {
    const [p] = mergeCatalog(
      payload({
        produtos: [produto()],
        enrichment: { p1: { genero: 'F', familias: ['floral'], ocasioes: ['dia'], intensidade: 2 } },
      }),
      {},
    );
    expect(p.genero).toBe('F');
    expect(p.familias).toEqual(['floral']);
    expect(p.intensidade).toBe(2);
  });

  it('produto sem enrichment entra com os campos vazios, não quebra', () => {
    const [p] = mergeCatalog(payload({ produtos: [produto()] }), {});
    expect(p.genero).toBeNull();
    expect(p.familias).toEqual([]);
    expect(p.ocasioes).toEqual([]);
  });

  it('esconde produto sem estoque', () => {
    const r = mergeCatalog(payload({ produtos: [produto({ estoque: 0 })] }), {});
    expect(r).toHaveLength(0);
  });

  it('esconde produto com preço zerado — "R$ 0" na vitrine é pior que ausência', () => {
    const r = mergeCatalog(payload({ produtos: [produto({ preco: 0 })] }), {});
    expect(r).toHaveLength(0);
  });

  it('aplica a oferta quando ela é menor que o preço de tabela', () => {
    const [p] = mergeCatalog(payload({ produtos: [produto()] }), { p1: 199 });
    expect(p.precoPromocional).toBe(199);
  });

  it('ignora oferta maior ou igual ao preço de tabela', () => {
    const [maior] = mergeCatalog(payload({ produtos: [produto()] }), { p1: 400 });
    const [igual] = mergeCatalog(payload({ produtos: [produto()] }), { p1: 300 });
    expect(maior.precoPromocional).toBeNull();
    expect(igual.precoPromocional).toBeNull();
  });

  it('ignora oferta negativa ou zerada', () => {
    const [p] = mergeCatalog(payload({ produtos: [produto()] }), { p1: -50 });
    expect(p.precoPromocional).toBeNull();
  });

  it('deixa a marca nula quando o Bling não traz marca', () => {
    const [semMarca] = mergeCatalog(payload({ produtos: [produto({ marca: null })] }), {});
    const [marcaVazia] = mergeCatalog(payload({ produtos: [produto({ marca: '   ' })] }), {});
    expect(semMarca.marca).toBeNull();
    expect(marcaVazia.marca).toBeNull();
  });

  it('normaliza a marca vinda do Bling', () => {
    const [p] = mergeCatalog(payload({ produtos: [produto({ marca: 'antonio bandares' })] }), {});
    expect(p.marca).toBe('Antonio Banderas');
  });

  it('descarta a descrição que só repete o nome', () => {
    const [p] = mergeCatalog(
      payload({ produtos: [produto({ nome: 'Vodka Wild 100ml', descricao: 'Vodka Wild 100ml' })] }),
      {},
    );
    expect(p.descricao).toBe('');
  });

  it('aguenta payload vazio ou malformado sem lançar', () => {
    expect(mergeCatalog(payload(), {})).toEqual([]);
    expect(mergeCatalog({ ...payload(), produtos: undefined as never }, {})).toEqual([]);
    expect(mergeCatalog({ ...payload(), enrichment: undefined as never }, {})).toEqual([]);
  });
});

const local = (over: Partial<ProdutoLocal> = {}): ProdutoLocal => ({
  id: 'local:abc',
  nome: 'Âmbar Noturno',
  marca: 'Le Parfum',
  preco: 250,
  estoque: 4,
  descricao: '',
  genero: 'U',
  familias: ['amadeirado'],
  ocasioes: ['noite'],
  intensidade: 3,
  fotoLocal: null,
  fotoAtualizadaEm: null,
  criadoEm: '2026-07-31T10:00:00.000Z',
  atualizadoEm: '2026-07-31T10:00:00.000Z',
  ...over,
});

describe('mergeCatalog com produtos cadastrados na loja', () => {
  it('junta as duas origens na mesma vitrine, com os da loja primeiro', () => {
    const r = mergeCatalog(payload({ produtos: [produto()] }), {}, [local()]);
    expect(r.map((p) => p.id)).toEqual(['local:abc', 'p1']);
  });

  it('usa o enriquecimento embutido, sem passar pelo enrichment.json', () => {
    const [p] = mergeCatalog(payload(), {}, [local()]);
    expect(p.genero).toBe('U');
    expect(p.familias).toEqual(['amadeirado']);
    expect(p.intensidade).toBe(3);
  });

  it('aplica a mesma regra de estoque e preço dos produtos do Bling', () => {
    expect(mergeCatalog(payload(), {}, [local({ estoque: 0 })])).toEqual([]);
    expect(mergeCatalog(payload(), {}, [local({ preco: 0 })])).toEqual([]);
  });

  it('aceita oferta da equipe sobre um produto da loja', () => {
    const [p] = mergeCatalog(payload(), { 'local:abc': 199 }, [local()]);
    expect(p.precoPromocional).toBe(199);
  });

  it('entra sem imagem, para o gradiente da família assumir', () => {
    const [p] = mergeCatalog(payload(), {}, [local()]);
    expect(p.imagem).toBeNull();
  });

  it('sem produtos locais o resultado é idêntico ao de antes', () => {
    const antes = mergeCatalog(payload({ produtos: [produto()] }), {});
    expect(mergeCatalog(payload({ produtos: [produto()] }), {}, [])).toEqual(antes);
  });
});
