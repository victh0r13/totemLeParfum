import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const PROMO_KEY = 'leparfum:promocoes:v1';

interface PromotionsState {
  /** id do produto no Bling → preço promocional em reais. */
  promocoes: Record<string, number>;
  /** Define (preco em reais) ou remove (null) a oferta de um produto. */
  setPromocao: (id: string, preco: number | null) => void;
}

const PromotionsContext = createContext<PromotionsState | null>(null);

/**
 * Ofertas definidas pela equipe direto no totem (protegidas por PIN).
 * Ficam somente neste aparelho (AsyncStorage) — o Bling não é alterado.
 */
export function PromotionsProvider({ children }: { children: React.ReactNode }) {
  const [promocoes, setPromocoes] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PROMO_KEY);
        if (!cancelled && raw) setPromocoes(JSON.parse(raw) as Record<string, number>);
      } catch {
        // Cache corrompido: começa sem ofertas.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPromocao = useCallback((id: string, preco: number | null) => {
    setPromocoes((prev) => {
      const next = { ...prev };
      if (preco === null || !Number.isFinite(preco) || preco <= 0) {
        delete next[id];
      } else {
        next[id] = Math.round(preco * 100) / 100;
      }
      AsyncStorage.setItem(PROMO_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ promocoes, setPromocao }), [promocoes, setPromocao]);
  return <PromotionsContext.Provider value={value}>{children}</PromotionsContext.Provider>;
}

export function usePromotions(): PromotionsState {
  const ctx = useContext(PromotionsContext);
  if (!ctx) throw new Error('usePromotions deve ser usado dentro de <PromotionsProvider>');
  return ctx;
}
