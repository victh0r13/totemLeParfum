import type { Perfume } from '@/types/catalog';

/**
 * Perfume de teste com valores neutros. Cada teste sobrescreve só o campo que
 * está exercitando — assim fica óbvio, lendo o teste, o que importa nele.
 */
export function perfume(over: Partial<Perfume> = {}): Perfume {
  return {
    id: 'p1',
    codigo: null,
    nome: 'Perfume Teste',
    marca: 'Marca Teste',
    preco: 300,
    estoque: 10,
    imagem: null,
    descricao: '',
    fotoVersao: null,
    precoPromocional: null,
    genero: null,
    familias: [],
    ocasioes: [],
    intensidade: null,
    ...over,
  };
}
