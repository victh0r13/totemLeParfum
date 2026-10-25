import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { API_URL, BLING_DIRETO, BLING_SYNC_MS, CATALOG_REFRESH_MS } from '@/config';
import { BlingAuthError, sincronizarComBling } from '@/data/bling';
import { prefetchPhotos } from '@/data/images';
import { useLocalProducts } from '@/data/localProductsStore';
import { usePromotions } from '@/data/promotionsStore';
import { maisRecente, mergeCatalog } from '@/logic/catalog';
import type { Perfume, TotemPayload } from '@/types/catalog';

import bundledCatalog from '../../data/catalog.bundle.json';

const PAYLOAD_KEY = 'leparfum:totem:v2';
const LAST_SYNC_KEY = 'leparfum:ultimoSync:v1';
const FETCH_TIMEOUT_MS = 6000;

/** De onde vieram os dados que estão na tela agora. */
export type CatalogOrigin = 'bundle' | 'cache' | 'servidor' | 'bling';

interface CatalogState {
  /** Curadoria do totem, já enriquecida e com ofertas aplicadas. */
  perfumes: Perfume[];
  loading: boolean;
  /** Data em que o catálogo em uso foi gerado pelo sync com o Bling. */
  generatedAt: string | null;
  origem: CatalogOrigin;
  /** Última vez que o app conseguiu falar com o servidor da loja (ISO). */
  ultimoSync: string | null;
  /** false depois de uma tentativa de atualização que falhou. */
  online: boolean;
  /** Motivo da última falha do sync direto com o Bling, para o painel. */
  erroSync: string | null;
  atualizando: boolean;
  refresh: () => Promise<void>;
}

const CatalogContext = createContext<CatalogState | null>(null);

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

/**
 * Catálogo offline-first em três camadas, sempre nesta ordem:
 *
 *   1. bundle    — vai dentro do APK; garante que o totem abre com catálogo
 *                  e fotos mesmo num tablet recém-formatado e sem rede;
 *   2. cache     — última versão que o aparelho baixou do servidor da loja;
 *   3. servidor  — atualização em segundo plano, de hora em hora.
 *                  Sem servidor, o próprio tablet busca preço e estoque no
 *                  Bling a cada 5 minutos (ver data/bling.ts).
 *
 * A rede nunca bloqueia a interface: falha de atualização só muda o indicador
 * de status no painel da loja.
 */
export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const { promocoes } = usePromotions();
  const { produtos: produtosLocais } = useLocalProducts();
  const [payload, setPayload] = useState<TotemPayload>(bundledCatalog as TotemPayload);
  const [origem, setOrigem] = useState<CatalogOrigin>('bundle');
  const [ultimoSync, setUltimoSync] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [erroSync, setErroSync] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [loading, setLoading] = useState(true);
  const prefetched = useRef(false);
  // O sync direto parte do payload em uso; o ref evita refazer o `refresh` a
  // cada atualização (e com ele o intervalo e o WebSocket).
  const payloadAtual = useRef<TotemPayload>(bundledCatalog as TotemPayload);

  const aplicar = useCallback((novo: TotemPayload, de: CatalogOrigin) => {
    payloadAtual.current = novo;
    setPayload(novo);
    setOrigem(de);
  }, []);

  const sincronizarBling = useCallback(async () => {
    setAtualizando(true);
    try {
      const { payload: novo } = await sincronizarComBling(payloadAtual.current);
      const agora = new Date().toISOString();
      aplicar(novo, 'bling');
      setUltimoSync(agora);
      setOnline(true);
      setErroSync(null);
      await AsyncStorage.multiSet([
        [PAYLOAD_KEY, JSON.stringify(novo)],
        [LAST_SYNC_KEY, agora],
      ]);
    } catch (err) {
      setOnline(false);
      setErroSync(
        err instanceof BlingAuthError
          ? 'O acesso ao Bling expirou. Instale a versão mais nova do aplicativo.'
          : 'Sem conexão com o Bling. Confira a internet do tablet.',
      );
    } finally {
      setAtualizando(false);
    }
  }, [aplicar]);

  const refresh = useCallback(async () => {
    if (!API_URL) {
      if (BLING_DIRETO) await sincronizarBling();
      return;
    }
    setAtualizando(true);
    try {
      const remoto = await fetchJson<TotemPayload>(`${API_URL}/api/totem`);
      if (remoto?.produtos?.length) {
        const agora = new Date().toISOString();
        aplicar(remoto, 'servidor');
        setUltimoSync(agora);
        setOnline(true);
        await AsyncStorage.multiSet([
          [PAYLOAD_KEY, JSON.stringify(remoto)],
          [LAST_SYNC_KEY, agora],
        ]);
      }
    } catch {
      // Sem rede ou servidor fora do ar: segue com cache/bundle.
      setOnline(false);
    } finally {
      setAtualizando(false);
    }
  }, [aplicar, sincronizarBling]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [[, cached], [, lastSync]] = await AsyncStorage.multiGet([
          PAYLOAD_KEY,
          LAST_SYNC_KEY,
        ]);
        if (cancelled) return;
        if (cached) {
          const parsed = JSON.parse(cached) as TotemPayload;
          // Um APK novo traz catálogo novo: o cache gravado pelo APK anterior
          // só vale se for mais recente que o que veio empacotado.
          if (parsed?.produtos?.length && maisRecente(parsed, bundledCatalog as TotemPayload)) {
            aplicar(parsed, 'cache');
          }
        }
        if (lastSync) setUltimoSync(lastSync);
      } catch {
        // Cache corrompido: segue com o bundle.
      } finally {
        if (!cancelled) setLoading(false);
      }
      await refresh();
    })();
    // O totem fica ligado o dia todo: busca o catálogo novo periodicamente.
    const interval = setInterval(refresh, BLING_DIRETO ? BLING_SYNC_MS : CATALOG_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refresh, aplicar]);

  // Tempo real: o servidor avisa quando o catálogo muda, em vez de o totem
  // ficar perguntando. A janela de 1 hora abaixo vira só uma rede de segurança
  // para o caso de a conexão cair sem o app perceber.
  useEffect(() => {
    if (!API_URL) return;
    const url = `${API_URL.replace(/^http/, 'ws')}/ws`;
    let socket: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    let tentativas = 0;
    let encerrado = false;

    const conectar = () => {
      if (encerrado) return;
      socket = new WebSocket(url);

      socket.onopen = () => {
        tentativas = 0;
        setOnline(true);
      };
      socket.onmessage = (evento) => {
        try {
          if (JSON.parse(String(evento.data))?.tipo === 'catalogo-atualizado') refresh();
        } catch {
          // Mensagem fora do formato: ignora.
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (encerrado) return;
        // Backoff até 30s: o PC da loja pode estar desligado a noite toda.
        const espera = Math.min(30000, 1000 * 2 ** tentativas++);
        reconnect = setTimeout(conectar, espera);
      };
    };

    conectar();
    return () => {
      encerrado = true;
      if (reconnect) clearTimeout(reconnect);
      socket?.close();
    };
  }, [refresh]);

  const perfumes = useMemo(
    () => mergeCatalog(payload, promocoes, produtosLocais),
    [payload, promocoes, produtosLocais],
  );

  // Uma vez por sessão, guarda em disco as fotos que não vieram no APK.
  useEffect(() => {
    if (loading || prefetched.current || perfumes.length === 0) return;
    prefetched.current = true;
    prefetchPhotos(perfumes).catch(() => {});
  }, [loading, perfumes]);

  const value = useMemo<CatalogState>(
    () => ({
      perfumes,
      loading,
      generatedAt: payload.generatedAt ?? null,
      origem,
      ultimoSync,
      online,
      erroSync,
      atualizando,
      refresh,
    }),
    [
      perfumes,
      loading,
      payload.generatedAt,
      origem,
      ultimoSync,
      online,
      erroSync,
      atualizando,
      refresh,
    ],
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
