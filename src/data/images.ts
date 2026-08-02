import { Image } from 'expo-image';

import { API_URL } from '@/config';
import { bundledImage } from '@/data/bundledImages';
import type { Perfume } from '@/types/catalog';

export type PhotoSource = number | { uri: string };

/**
 * Origens da foto de um produto, da mais confiável para a menos:
 *
 *  1. arquivo empacotado no APK  — sempre funciona, inclusive sem rede;
 *  2. servidor da loja           — cobre produtos incluídos depois do build;
 *  3. URL do Bling               — último recurso: é link S3 assinado e
 *                                  expira em ~7 dias.
 *
 * Sem nenhuma delas, a tela cai no degradê da família olfativa.
 */
export function photoSources(p: Perfume): PhotoSource[] {
  const sources: PhotoSource[] = [];
  // Foto tirada neste totem: está no disco do aparelho, então é ainda mais
  // confiável que o APK — não depende de build nem de rede.
  if (p.imagem?.startsWith('file://')) sources.push({ uri: p.imagem });
  const bundled = bundledImage(p.id);
  if (bundled !== undefined) sources.push(bundled);
  if (API_URL) {
    // O ?v= força a releitura quando a equipe troca a foto: sem ele, o cache de
    // disco continuaria servindo a imagem antiga para a mesma URL.
    const versao = p.fotoVersao ? `?v=${encodeURIComponent(p.fotoVersao)}` : '';
    sources.push({ uri: `${API_URL}/images/${encodeURIComponent(p.id)}${versao}` });
  }
  if (p.imagem && !p.imagem.startsWith('file://')) sources.push({ uri: p.imagem });
  return sources;
}

/**
 * Deixa em cache de disco as fotos que ainda não estão no APK, para o totem
 * continuar completo se a rede cair depois. Melhor-esforço: falhas são
 * silenciosas e a tela sempre tem o degradê como fallback.
 */
export async function prefetchPhotos(perfumes: Perfume[]): Promise<number> {
  const urls = perfumes
    .filter((p) => bundledImage(p.id) === undefined)
    .flatMap((p) => photoSources(p))
    .filter((s): s is { uri: string } => typeof s === 'object')
    .map((s) => s.uri)
    // Arquivo local já está no disco: prefetch nele seria trabalho à toa.
    .filter((uri) => !uri.startsWith('file://'));

  if (urls.length === 0) return 0;

  let ok = 0;
  // Em lotes: 200+ downloads simultâneos travariam o Wi-Fi do totem.
  const BATCH = 8;
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map((uri) =>
        Image.prefetch(uri, { cachePolicy: 'disk' }).catch(() => false),
      ),
    );
    ok += results.filter(Boolean).length;
  }
  return ok;
}
