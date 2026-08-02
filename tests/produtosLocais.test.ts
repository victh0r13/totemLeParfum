import { describe, expect, it } from 'vitest';

import {
  enfileirar,
  isProdutoLocal,
  mesclarComServidor,
  nomeArquivoFoto,
  novoId,
  parsePreco,
  produtoParaRascunho,
  rascunhoParaProduto,
  removerDaFila,
  temErro,
  validarRascunho,
  RASCUNHO_VAZIO,
  type RascunhoProduto,
} from '@/logic/produtosLocais';
import type { Pendencia, ProdutoLocal } from '@/types/catalog';

const rascunho = (over: Partial<RascunhoProduto> = {}): RascunhoProduto => ({
  ...RASCUNHO_VAZIO,
  nome: 'Âmbar Noturno',
  preco: '199,90',
  estoque: '5',
  ...over,
});

const produto = (over: Partial<ProdutoLocal> = {}): ProdutoLocal => ({
  id: 'local:abc',
  nome: 'Âmbar Noturno',
  marca: 'Le Parfum',
  preco: 199.9,
  estoque: 5,
  descricao: '',
  genero: null,
  familias: [],
  ocasioes: [],
  intensidade: null,
  fotoLocal: null,
  fotoAtualizadaEm: null,
  criadoEm: '2026-07-31T10:00:00.000Z',
  atualizadoEm: '2026-07-31T10:00:00.000Z',
  ...over,
});

const pendencia = (over: Partial<Pendencia> = {}): Pendencia => ({
  opId: 'op1',
  tipo: 'salvar',
  produtoId: 'local:abc',
  criadoEm: '2026-07-31T10:00:00.000Z',
  ...over,
});

describe('parsePreco', () => {
  it('aceita vírgula, que é o que a equipe digita no tablet', () => {
    expect(parsePreco('199,90')).toBe(199.9);
  });

  it('aceita ponto', () => {
    expect(parsePreco('199.90')).toBe(199.9);
  });

  it('devolve null para texto vazio ou inválido', () => {
    expect(parsePreco('')).toBeNull();
    expect(parsePreco('abc')).toBeNull();
  });
});

describe('validarRascunho', () => {
  it('aceita um rascunho completo', () => {
    expect(temErro(validarRascunho(rascunho()))).toBe(false);
  });

  it('exige nome', () => {
    expect(validarRascunho(rascunho({ nome: 'a' })).nome).toBeDefined();
  });

  it('recusa preço zero — mesma regra da vitrine do Bling', () => {
    expect(validarRascunho(rascunho({ preco: '0' })).preco).toBeDefined();
  });

  it('recusa estoque fracionado', () => {
    expect(validarRascunho(rascunho({ estoque: '2,5' })).estoque).toBeDefined();
  });

  it('aceita estoque zero: o produto existe, só não vai para a vitrine', () => {
    expect(validarRascunho(rascunho({ estoque: '0' })).estoque).toBeUndefined();
  });
});

describe('rascunhoParaProduto', () => {
  it('gera id com prefixo local, que nunca colide com id do Bling', () => {
    const p = rascunhoParaProduto(rascunho());
    expect(isProdutoLocal(p.id)).toBe(true);
    expect(isProdutoLocal('16664095230')).toBe(false);
  });

  it('preserva id e criadoEm ao editar, renovando só o atualizadoEm', () => {
    const original = produto();
    const p = rascunhoParaProduto(rascunho({ preco: '149,90' }), original, '2026-08-01T09:00:00.000Z');
    expect(p.id).toBe(original.id);
    expect(p.criadoEm).toBe(original.criadoEm);
    expect(p.atualizadoEm).toBe('2026-08-01T09:00:00.000Z');
    expect(p.preco).toBe(149.9);
  });

  it('marca vazia vira null em vez de string vazia', () => {
    expect(rascunhoParaProduto(rascunho({ marca: '   ' })).marca).toBeNull();
  });

  it('ida e volta pelo formulário não altera o produto', () => {
    const original = produto({ marca: null, descricao: 'Notas de âmbar.' });
    const volta = rascunhoParaProduto(produtoParaRascunho(original), original, original.atualizadoEm);
    expect(volta).toEqual(original);
  });

  it('gera ids distintos em chamadas seguidas', () => {
    expect(novoId()).not.toBe(novoId());
  });
});

describe('enfileirar', () => {
  it('descarta a operação anterior do mesmo produto', () => {
    const fila = enfileirar([pendencia({ opId: 'op1' })], pendencia({ opId: 'op2' }));
    expect(fila).toHaveLength(1);
    expect(fila[0].opId).toBe('op2');
  });

  it('mantém operações de produtos diferentes', () => {
    const fila = enfileirar(
      [pendencia({ opId: 'op1', produtoId: 'local:a' })],
      pendencia({ opId: 'op2', produtoId: 'local:b' }),
    );
    expect(fila).toHaveLength(2);
  });

  it('remoção substitui um salvamento pendente do mesmo produto', () => {
    const fila = enfileirar(
      [pendencia({ opId: 'op1', tipo: 'salvar' })],
      pendencia({ opId: 'op2', tipo: 'remover' }),
    );
    expect(fila).toEqual([expect.objectContaining({ tipo: 'remover' })]);
  });

  it('removerDaFila tira só a operação enviada', () => {
    const fila = [pendencia({ opId: 'op1' }), pendencia({ opId: 'op2', produtoId: 'local:b' })];
    expect(removerDaFila(fila, 'op1')).toEqual([expect.objectContaining({ opId: 'op2' })]);
  });
});

describe('foto', () => {
  it('gera nome de arquivo sem os dois-pontos do id', () => {
    // ':' é inválido em nome de arquivo no Windows, onde o servidor roda.
    expect(nomeArquivoFoto('local:abc123')).toBe('local-abc123.jpg');
  });

  it('neutraliza id forjado que tentaria escapar da pasta', () => {
    const nome = nomeArquivoFoto('local:../../etc/passwd');
    expect(nome).not.toContain('/');
    expect(nome).not.toContain('..');
  });

  it('produto novo sem foto nasce com fotoAtualizadaEm nulo', () => {
    expect(rascunhoParaProduto(rascunho()).fotoAtualizadaEm).toBeNull();
  });

  it('escolher a primeira foto carimba a versão', () => {
    const p = rascunhoParaProduto(
      rascunho({ fotoLocal: 'file:///a/1.jpg' }),
      undefined,
      '2026-08-01T12:00:00.000Z',
    );
    expect(p.fotoAtualizadaEm).toBe('2026-08-01T12:00:00.000Z');
  });

  it('editar sem mexer na foto preserva a versão anterior', () => {
    const base = produto({
      fotoLocal: 'file:///a/1.jpg',
      fotoAtualizadaEm: '2026-07-01T00:00:00.000Z',
    });
    const p = rascunhoParaProduto(
      rascunho({ preco: '99', fotoLocal: base.fotoLocal }),
      base,
      '2026-08-01T12:00:00.000Z',
    );
    expect(p.preco).toBe(99);
    expect(p.fotoAtualizadaEm).toBe('2026-07-01T00:00:00.000Z');
  });

  it('trocar a foto renova a versão', () => {
    const base = produto({
      fotoLocal: 'file:///a/1.jpg',
      fotoAtualizadaEm: '2026-07-01T00:00:00.000Z',
    });
    const p = rascunhoParaProduto(
      rascunho({ fotoLocal: 'file:///a/2.jpg' }),
      base,
      '2026-08-01T12:00:00.000Z',
    );
    expect(p.fotoAtualizadaEm).toBe('2026-08-01T12:00:00.000Z');
  });

  it('remover a foto zera a versão', () => {
    const base = produto({
      fotoLocal: 'file:///a/1.jpg',
      fotoAtualizadaEm: '2026-07-01T00:00:00.000Z',
    });
    const p = rascunhoParaProduto(rascunho({ fotoLocal: null }), base);
    expect(p.fotoLocal).toBeNull();
    expect(p.fotoAtualizadaEm).toBeNull();
  });
});

describe('mesclarComServidor', () => {
  it('traz produto que só existe no servidor', () => {
    const r = mesclarComServidor([], [produto({ id: 'local:novo' })], []);
    expect(r.map((p) => p.id)).toEqual(['local:novo']);
  });

  it('versão mais recente do servidor vence a local', () => {
    const [p] = mesclarComServidor(
      [produto({ preco: 100 })],
      [produto({ preco: 250, atualizadoEm: '2026-08-01T00:00:00.000Z' })],
      [],
    );
    expect(p.preco).toBe(250);
  });

  it('versão local mais recente não é sobrescrita pela do servidor', () => {
    const [p] = mesclarComServidor(
      [produto({ preco: 100, atualizadoEm: '2026-08-02T00:00:00.000Z' })],
      [produto({ preco: 250, atualizadoEm: '2026-08-01T00:00:00.000Z' })],
      [],
    );
    expect(p.preco).toBe(100);
  });

  it('produto com operação na fila é intocável, mesmo com servidor mais novo', () => {
    const [p] = mesclarComServidor(
      [produto({ preco: 100 })],
      [produto({ preco: 250, atualizadoEm: '2026-09-01T00:00:00.000Z' })],
      [pendencia()],
    );
    expect(p.preco).toBe(100);
  });

  it('produto ausente no servidor foi removido em outro totem', () => {
    expect(mesclarComServidor([produto()], [], [])).toEqual([]);
  });

  it('mas um cadastro ainda não enviado sobrevive à leitura do servidor', () => {
    const r = mesclarComServidor([produto()], [], [pendencia()]);
    expect(r).toHaveLength(1);
  });

  it('mantém a cópia local da foto quando a versão dela não mudou', () => {
    // O servidor devolve fotoLocal null (o caminho não vale em outro aparelho).
    // Sem preservar, este totem passaria a baixar uma foto que tem no disco.
    const [p] = mesclarComServidor(
      [produto({ fotoLocal: 'file:///a/1.jpg', fotoAtualizadaEm: '2026-07-01T00:00:00.000Z' })],
      [
        produto({
          preco: 400,
          fotoLocal: null,
          fotoAtualizadaEm: '2026-07-01T00:00:00.000Z',
          atualizadoEm: '2026-08-01T00:00:00.000Z',
        }),
      ],
      [],
    );
    expect(p.preco).toBe(400);
    expect(p.fotoLocal).toBe('file:///a/1.jpg');
  });

  it('descarta a cópia local quando outro totem trocou a foto', () => {
    const [p] = mesclarComServidor(
      [produto({ fotoLocal: 'file:///a/1.jpg', fotoAtualizadaEm: '2026-07-01T00:00:00.000Z' })],
      [
        produto({
          fotoLocal: null,
          fotoAtualizadaEm: '2026-07-20T00:00:00.000Z',
          atualizadoEm: '2026-08-01T00:00:00.000Z',
        }),
      ],
      [],
    );
    expect(p.fotoLocal).toBeNull();
  });

  it('ordena do mais recente para o mais antigo', () => {
    const r = mesclarComServidor(
      [],
      [
        produto({ id: 'local:velho', criadoEm: '2026-07-01T00:00:00.000Z' }),
        produto({ id: 'local:novo', criadoEm: '2026-07-30T00:00:00.000Z' }),
      ],
      [],
    );
    expect(r.map((p) => p.id)).toEqual(['local:novo', 'local:velho']);
  });
});
