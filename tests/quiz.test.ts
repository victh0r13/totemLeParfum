import { describe, expect, it } from 'vitest';

import {
  emptyAnswers,
  motivosDaEscolha,
  rankPerfumes,
  respostasDoParam,
  respostasParaParam,
  scorePerfume,
} from '@/logic/quiz';
import type { QuizAnswers } from '@/types/catalog';

import { perfume } from './helpers';

const respostas = (over: Partial<QuizAnswers> = {}): QuizAnswers => ({ ...emptyAnswers, ...over });

describe('scorePerfume', () => {
  it('não pontua nada quando não há respostas', () => {
    expect(scorePerfume(perfume(), emptyAnswers)).toBe(0);
  });

  it('família é o critério de maior peso', () => {
    const p = perfume({ familias: ['oriental'] });
    const comFamilia = scorePerfume(p, respostas({ familias: ['oriental'] }));
    const comOcasiao = scorePerfume(
      perfume({ ocasioes: ['noite'] }),
      respostas({ ocasiao: 'noite' }),
    );
    expect(comFamilia).toBeGreaterThan(comOcasiao);
  });

  it('intensidade pontua por proximidade, não só por acerto exato', () => {
    const leve = perfume({ intensidade: 1 });
    const media = perfume({ intensidade: 2 });
    const forte = perfume({ intensidade: 3 });
    const querMedia = respostas({ intensidade: 2 });

    expect(scorePerfume(media, querMedia)).toBeGreaterThan(scorePerfume(leve, querMedia));
    expect(scorePerfume(leve, querMedia)).toBe(scorePerfume(forte, querMedia));
  });

  it('gênero exato vale mais que unissex, e unissex mais que não classificado', () => {
    const querMasculino = respostas({ genero: 'M' });
    const exato = scorePerfume(perfume({ genero: 'M' }), querMasculino);
    const unissex = scorePerfume(perfume({ genero: 'U' }), querMasculino);
    const semGenero = scorePerfume(perfume({ genero: null }), querMasculino);

    expect(exato).toBeGreaterThan(unissex);
    expect(unissex).toBeGreaterThan(semGenero);
  });

  it('"tanto faz" não distorce a pontuação por gênero', () => {
    const tantoFaz = respostas({ genero: 'U' });
    expect(scorePerfume(perfume({ genero: 'M' }), tantoFaz)).toBe(
      scorePerfume(perfume({ genero: 'F' }), tantoFaz),
    );
  });

  it('presente ganha um empurrão para o unissex', () => {
    const paraPresente = respostas({ quem: 'presente' });
    expect(scorePerfume(perfume({ genero: 'U' }), paraPresente)).toBeGreaterThan(
      scorePerfume(perfume({ genero: 'F' }), paraPresente),
    );
  });
});

describe('rankPerfumes', () => {
  const catalogo = [
    perfume({ id: 'm1', genero: 'M', familias: ['oriental'], ocasioes: ['noite'], intensidade: 3 }),
    perfume({ id: 'm2', genero: 'M', familias: ['amadeirado'], intensidade: 2 }),
    perfume({ id: 'f1', genero: 'F', familias: ['oriental'], ocasioes: ['noite'], intensidade: 3 }),
    perfume({ id: 'f2', genero: 'F', familias: ['floral'], intensidade: 1 }),
    perfume({ id: 'u1', genero: 'U', familias: ['fresco'], intensidade: 2 }),
  ];

  it('NUNCA sugere o gênero oposto ao pedido', () => {
    const r = rankPerfumes(catalogo, respostas({ genero: 'M', familias: ['oriental'] }));
    expect(r.every((p) => p.genero !== 'F')).toBe(true);
  });

  it('unissex entra em qualquer gênero pedido', () => {
    const r = rankPerfumes(catalogo, respostas({ genero: 'F' }));
    expect(r.some((p) => p.id === 'u1')).toBe(true);
  });

  it('"tanto faz" não descarta ninguém por gênero', () => {
    const r = rankPerfumes(catalogo, respostas({ genero: 'U' }));
    expect(r.some((p) => p.genero === 'F')).toBe(true);
    expect(r.some((p) => p.genero === 'M')).toBe(true);
  });

  it('ignora produtos sem estoque', () => {
    const semEstoque = perfume({ id: 'zerado', estoque: 0, familias: ['oriental'] });
    const r = rankPerfumes([...catalogo, semEstoque], respostas({ familias: ['oriental'] }));
    expect(r.some((p) => p.id === 'zerado')).toBe(false);
  });

  it('devolve no máximo 5 sugestões', () => {
    const muitos = Array.from({ length: 20 }, (_, i) =>
      perfume({ id: `p${i}`, familias: ['oriental'], ocasioes: ['noite'] }),
    );
    expect(rankPerfumes(muitos, respostas({ familias: ['oriental'] }))).toHaveLength(5);
  });

  it('completa até 3 mesmo quando nada pontua — vitrine vazia é pior', () => {
    const r = rankPerfumes(catalogo, respostas({ familias: ['citrico'] }));
    expect(r.length).toBeGreaterThanOrEqual(3);
  });

  it('o preenchimento até 3 continua respeitando o gênero', () => {
    // Nada casa com "citrico", então entra o preenchimento — que não pode
    // trazer perfume feminino para quem pediu masculino.
    const r = rankPerfumes(catalogo, respostas({ genero: 'M', familias: ['citrico'] }));
    expect(r.every((p) => p.genero !== 'F')).toBe(true);
  });

  it('ordena da maior para a menor afinidade', () => {
    const r = rankPerfumes(
      catalogo,
      respostas({ genero: 'M', familias: ['oriental'], ocasiao: 'noite', intensidade: 3 }),
    );
    expect(r[0].id).toBe('m1');
  });

  it('não repete o mesmo perfume', () => {
    const r = rankPerfumes(catalogo, respostas({ familias: ['oriental'] }));
    expect(new Set(r.map((p) => p.id)).size).toBe(r.length);
  });
});

describe('motivosDaEscolha', () => {
  const respostas = {
    ...emptyAnswers,
    quem: 'presente' as const,
    ocasiao: 'noite' as const,
    intensidade: 3 as const,
    familias: ['oriental' as const, 'doce' as const],
  };

  it('lista o que o perfume atende, família primeiro', () => {
    const p = perfume({
      familias: ['doce', 'oriental'],
      ocasioes: ['noite'],
      intensidade: 3,
      genero: 'U',
    });
    expect(motivosDaEscolha(p, respostas)).toEqual(['Doce e Oriental', 'Para a noite', 'Marcante']);
  });

  it('não inventa motivo: perfume que não atende nada volta vazio', () => {
    expect(motivosDaEscolha(perfume({ familias: ['fresco'] }), respostas)).toEqual([]);
  });

  it('presente + unissex vira motivo quando sobra espaço', () => {
    const p = perfume({ genero: 'U', familias: ['doce'] });
    expect(motivosDaEscolha(p, respostas)).toEqual(['Doce', 'Unissex, ótimo para presente']);
  });
});

describe('respostas na URL', () => {
  it('ida e volta preservam as respostas', () => {
    const a = { ...emptyAnswers, genero: 'F' as const, familias: ['floral' as const] };
    expect(respostasDoParam(respostasParaParam(a))).toEqual(a);
  });

  it('parâmetro adulterado não derruba a tela', () => {
    expect(respostasDoParam('{quebrado')).toEqual(emptyAnswers);
    expect(respostasDoParam(undefined)).toEqual(emptyAnswers);
  });
});

describe('duas famílias', () => {
  it('quem bate as duas famílias pedidas fica na frente de quem bate uma', () => {
    const a = respostas({ familias: ['oriental', 'doce'] });
    const umaSo = perfume({ id: 'uma', familias: ['doce'], preco: 50 });
    const asDuas = perfume({ id: 'duas', familias: ['oriental', 'doce'], preco: 300 });
    expect(scorePerfume(asDuas, a)).toBeGreaterThan(scorePerfume(umaSo, a));
    expect(rankPerfumes([umaSo, asDuas], a)[0].id).toBe('duas');
  });
});
