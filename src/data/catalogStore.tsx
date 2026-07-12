import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { API_URL } from '@/config';
import type {
  CatalogFile,
  CatalogProduct,
  EnrichmentEntry,
  EnrichmentFile,
  Perfume,
} from '@/types/catalog';

import bundledCatalog from '../../data/catalog.json';
import bundledEnrichment from '../../data/enrichment.json';

const CATALOG_KEY = 'leparfum:catalog:v1';
const ENRICHMENT_KEY = 'leparfum:enrichment:v1';
const FETCH_TIMEOUT_MS = 6000;

interface CatalogState {
  /** Produtos com estoque disponível, já enriquecidos. */
  perfumes: Perfume[];
  loading: boolean;
  /** Data de geração do catálogo em uso (para diagnóstico). */
  generatedAt: string | null;
  refresh: () => Promise<void>;
}

const CatalogContext = createContext<CatalogState | null>(null);

function mergeCatalog(catalog: CatalogFile, enrichment: EnrichmentFile): Perfume[] {
  const entries = enrichment.produtos ?? {};
  return catalog.produtos
    .filter((p) => p.estoque > 0)
    .map((p: CatalogProduct): Perfume => {
      const entry: EnrichmentEntry | undefined =
        entries[p.id] ?? (p.codigo ? entries[p.codigo] : undefined);
      return {
        id: p.id,
        codigo: p.codigo ?? null,
        nome: p.nome,
        marca: p.marca?.trim() || 'Le Parfum',
        preco: p.preco,
        estoque: p.estoque,
        imagem: p.imagem ?? null,
        descricao: p.descricao?.trim() || '',
        enriquecido: !!entry,
        genero: entry?.genero ?? null,
        familias: entry?.familias ?? [],
        ocasioes: entry?.ocasioes ?? [],
        intensidade: entry?.intensidade ?? null,
      };
    });
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [catalog, setCatalog] = useState<CatalogFile>(bundledCatalog as CatalogFile);
  const [enrichment, setEnrichment] = useState<EnrichmentFile>(
    bundledEnrichment as unknown as EnrichmentFile,
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!API_URL) return;
    try {
      const [remoteCatalog, remoteEnrichment] = await Promise.all([
        fetchJson<CatalogFile>(`${API_URL}/api/catalog`),
        fetchJson<EnrichmentFile>(`${API_URL}/api/enrichment`).catch(() => null),
      ]);
      if (remoteCatalog?.produtos) {
        setCatalog(remoteCatalog);
        await AsyncStorage.setItem(CATALOG_KEY, JSON.stringify(remoteCatalog));
      }
      if (remoteEnrichment?.produtos) {
        setEnrichment(remoteEnrichment);
        await AsyncStorage.setItem(ENRICHMENT_KEY, JSON.stringify(remoteEnrichment));
      }
    } catch {
      // Sem rede ou servidor fora do ar: segue com cache/bundle (modo offline).
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cachedCatalog, cachedEnrichment] = await Promise.all([
          AsyncStorage.getItem(CATALOG_KEY),
          AsyncStorage.getItem(ENRICHMENT_KEY),
        ]);
        if (cancelled) return;
        if (cachedCatalog) setCatalog(JSON.parse(cachedCatalog) as CatalogFile);
        if (cachedEnrichment) setEnrichment(JSON.parse(cachedEnrichment) as EnrichmentFile);
      } catch {
        // Cache corrompido: segue com o bundle.
      } finally {
        if (!cancelled) setLoading(false);
      }
      await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const perfumes = useMemo(() => mergeCatalog(catalog, enrichment), [catalog, enrichment]);

  const value = useMemo<CatalogState>(
    () => ({ perfumes, loading, generatedAt: catalog.generatedAt ?? null, refresh }),
    [perfumes, loading, catalog.generatedAt, refresh],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogState {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog deve ser usado dentro de <CatalogProvider>');
  return ctx;
}

export function usePerfume(id: string | undefined): Perfume | undefined {
  const { perfumes } = useCatalog();
  return useMemo(() => perfumes.find((p) => p.id === id), [perfumes, id]);
}
