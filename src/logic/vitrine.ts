import type { Perfume, TipoProduto } from '@/types/catalog';

/**
 * Embaralhamento determinístico (mulberry32 + Fisher–Yates): a mesma semente
 * dá a mesma ordem. A vitrine muda de um dia para o outro, mas não pula de
 * lugar a cada render nem quando o catálogo é recarregado.
 */
export function embaralhar<T>(lista: T[], semente: number): T[] {
  let s = semente >>> 0;
  const aleatorio = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Semente do dia (AAAAMMDD), no fuso do aparelho. */
export function sementeDoDia(data: Date = new Date()): number {
  return data.getFullYear() * 10000 + (data.getMonth() + 1) * 100 + data.getDate();
}

/**
 * Destaques da tela inicial: só produto com foto (a vitrine é visual), ofertas
 * primeiro — é o que a loja quer mostrar — e depois um rodízio entre os tipos,
 * para o carrossel não virar uma fila de 12 perfumes seguidos.
 */
export function destaques(
  perfumes: Perfume[],
  temFoto: (p: Perfume) => boolean,
  limite = 12,
  semente = sementeDoDia(),
): Perfume[] {
  const comFoto = embaralhar(
    perfumes.filter((p) => p.estoque > 0 && temFoto(p)),
    semente,
  );
  const ofertas = comFoto.filter((p) => p.precoPromocional !== null);
  const resto = comFoto.filter((p) => p.precoPromocional === null);

  const filas = new Map<TipoProduto, Perfume[]>();
  for (const p of resto) filas.set(p.tipo, [...(filas.get(p.tipo) ?? []), p]);

  const rodizio: Perfume[] = [];
  // Perfume é o carro-chefe: entra duas vezes a cada volta do rodízio.
  const ordem: TipoProduto[] = ['perfume', 'body-splash', 'perfume', 'corpo', 'kit'];
  while (rodizio.length + ofertas.length < limite && [...filas.values()].some((f) => f.length)) {
    for (const tipo of ordem) {
      const p = filas.get(tipo)?.shift();
      if (p) rodizio.push(p);
    }
  }
  return [...ofertas, ...rodizio].slice(0, limite);
}

/** Produto que representa cada tipo no ladrilho da tela inicial. */
export function capaDoTipo(
  perfumes: Perfume[],
  tipo: TipoProduto,
  temFoto: (p: Perfume) => boolean,
  semente = sementeDoDia(),
): Perfume | null {
  return embaralhar(perfumes.filter((p) => p.tipo === tipo && temFoto(p)), semente)[0] ?? null;
}
