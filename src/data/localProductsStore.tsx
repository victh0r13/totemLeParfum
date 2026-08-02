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

import { API_URL } from '@/config';
import { apagarFoto, fotoEmBase64 } from '@/data/fotos';
import {
  enfileirar,
  mesclarComServidor,
  novoOpId,
  rascunhoParaProduto,
  removerDaFila,
  type RascunhoProduto,
} from '@/logic/produtosLocais';
import type { Pendencia, ProdutoLocal } from '@/types/catalog';

const PRODUTOS_KEY = 'leparfum:produtosLocais:v1';
const FILA_KEY = 'leparfum:produtosLocais:fila:v1';
const FETCH_TIMEOUT_MS = 6000;

/** De quanto em quanto tempo a fila tenta subir enquanto houver pendência. */
const TENTATIVA_MS = 15000;
/**
 * Sem nada pendente, só relê o que outros totens cadastraram. Aqui é polling e
 * não WebSocket porque a direção que importa é a oposta — o que este tablet
 * cadastra chega ao PC na hora, pela fila. Um minuto de atraso entre totens é
 * aceitável e evita uma segunda conexão permanente por aparelho.
 */
const LEITURA_MS = 60 * 1000;

interface LocalProductsState {
  produtos: ProdutoLocal[];
  /** Escritas que ainda não subiram para o servidor da loja. */
  pendencias: Pendencia[];
  carregando: boolean;
  sincronizando: boolean;
  /** Última vez que a fila foi esvaziada com sucesso (ISO). */
  ultimoEnvio: string | null;
  salvar: (rascunho: RascunhoProduto, base?: ProdutoLocal) => Promise<ProdutoLocal>;
  remover: (id: string) => Promise<void>;
  sincronizarAgora: () => Promise<void>;
}

const LocalProductsContext = createContext<LocalProductsState | null>(null);

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Produtos cadastrados pela própria loja, sem passar pelo Bling.
 *
 * A escrita segue a regra do projeto: **grava no aparelho primeiro, sempre;
 * sincroniza depois, se der.** Nenhuma operação da tela espera a rede — o
 * cadastro é salvo e a lista já reflete a mudança; a viagem até o servidor
 * acontece por conta desta fila, e falhar nela não desfaz nada.
 *
 * É o que separa isto de um CRUD comum: sem rede, um CRUD comum devolve erro e
 * perde o que o usuário digitou. Aqui a alteração fica registrada como pendente
 * e sobe sozinha quando o PC da loja voltar a responder.
 */
export function LocalProductsProvider({ children }: { children: React.ReactNode }) {
  const [produtos, setProdutos] = useState<ProdutoLocal[]>([]);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimoEnvio, setUltimoEnvio] = useState<string | null>(null);

  // Espelhos para o cronômetro ler o estado atual sem se reinscrever a cada
  // alteração — o mesmo padrão do KioskProvider.
  const produtosRef = useRef<ProdutoLocal[]>([]);
  const filaRef = useRef<Pendencia[]>([]);
  const ocupado = useRef(false);
  const ultimaLeitura = useRef(0);

  useEffect(() => {
    produtosRef.current = produtos;
  }, [produtos]);
  useEffect(() => {
    filaRef.current = pendencias;
  }, [pendencias]);

  const gravarProdutos = useCallback((lista: ProdutoLocal[]) => {
    produtosRef.current = lista;
    setProdutos(lista);
    AsyncStorage.setItem(PRODUTOS_KEY, JSON.stringify(lista)).catch(() => {});
  }, []);

  const gravarFila = useCallback((fila: Pendencia[]) => {
    filaRef.current = fila;
    setPendencias(fila);
    AsyncStorage.setItem(FILA_KEY, JSON.stringify(fila)).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [[, cruProdutos], [, cruFila]] = await AsyncStorage.multiGet([
          PRODUTOS_KEY,
          FILA_KEY,
        ]);
        if (cancelado) return;
        if (cruProdutos) {
          const lista = JSON.parse(cruProdutos) as ProdutoLocal[];
          if (Array.isArray(lista)) {
            produtosRef.current = lista;
            setProdutos(lista);
          }
        }
        if (cruFila) {
          const fila = JSON.parse(cruFila) as Pendencia[];
          if (Array.isArray(fila)) {
            filaRef.current = fila;
            setPendencias(fila);
          }
        }
      } catch {
        // Cache corrompido: começa vazio em vez de travar a tela.
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  /**
   * Esvazia a fila e depois traz o que os outros totens cadastraram.
   *
   * O envio para na primeira falha de propósito: se o servidor caiu, insistir
   * nas operações seguintes só gera timeout: elas continuam na fila e sobem na
   * próxima tentativa, na ordem em que foram feitas.
   */
  const sincronizar = useCallback(
    async (forcarLeitura: boolean) => {
      if (!API_URL || ocupado.current) return;
      ocupado.current = true;
      setSincronizando(true);
      let enviouAlgo = false;
      try {
        for (const pendencia of [...filaRef.current]) {
          if (pendencia.tipo === 'salvar') {
            await pedir(`${API_URL}/api/produtos-locais`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(pendencia.produto),
            });
            // A foto sobe depois do produto, e só quando há uma nova. Os bytes
            // são lidos do disco agora — nunca ficaram na fila.
            if (pendencia.fotoParaEnviar) {
              const base64 = await fotoEmBase64(pendencia.fotoParaEnviar);
              if (base64) {
                await pedir(
                  `${API_URL}/api/produtos-locais/${encodeURIComponent(pendencia.produtoId)}/foto`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base64 }),
                  },
                );
              }
            } else if (pendencia.produto && !pendencia.produto.fotoAtualizadaEm) {
              // Produto salvo sem foto: se havia uma no servidor, ela foi
              // removida pela equipe e precisa sair de lá também.
              await pedir(
                `${API_URL}/api/produtos-locais/${encodeURIComponent(pendencia.produtoId)}/foto`,
                { method: 'DELETE' },
              ).catch(() => {});
            }
          } else {
            await pedir(`${API_URL}/api/produtos-locais/${encodeURIComponent(pendencia.produtoId)}`, {
              method: 'DELETE',
            });
          }
          gravarFila(removerDaFila(filaRef.current, pendencia.opId));
          enviouAlgo = true;
        }
        if (enviouAlgo) setUltimoEnvio(new Date().toISOString());

        if (enviouAlgo || forcarLeitura) {
          const remoto = await pedir<{ produtos: ProdutoLocal[] }>(
            `${API_URL}/api/produtos-locais`,
          );
          if (Array.isArray(remoto?.produtos)) {
            gravarProdutos(
              mesclarComServidor(produtosRef.current, remoto.produtos, filaRef.current),
            );
          }
          ultimaLeitura.current = Date.now();
        }
      } catch {
        // Sem rede ou servidor fora: a fila permanece e tenta de novo depois.
      } finally {
        ocupado.current = false;
        setSincronizando(false);
      }
    },
    [gravarFila, gravarProdutos],
  );

  const sincronizarAgora = useCallback(() => sincronizar(true), [sincronizar]);

  useEffect(() => {
    if (carregando) return;
    sincronizar(true);
    // Com pendência, tenta de 15 em 15s para a fila subir logo que a rede volta;
    // sem nada a enviar, só relê de 5 em 5 min para não conversar à toa.
    const timer = setInterval(() => {
      const temPendencia = filaRef.current.length > 0;
      const venceuLeitura = Date.now() - ultimaLeitura.current >= LEITURA_MS;
      if (temPendencia || venceuLeitura) sincronizar(venceuLeitura);
    }, TENTATIVA_MS);
    return () => clearInterval(timer);
  }, [carregando, sincronizar]);

  const salvar = useCallback(
    async (rascunho: RascunhoProduto, base?: ProdutoLocal) => {
      const produto = rascunhoParaProduto(rascunho, base);
      const fotoTrocou = (base?.fotoLocal ?? null) !== produto.fotoLocal;
      // A foto anterior perdeu a serventia assim que outra tomou seu lugar.
      if (fotoTrocou && base?.fotoLocal) apagarFoto(base.fotoLocal);

      const semEle = produtosRef.current.filter((p) => p.id !== produto.id);
      gravarProdutos([produto, ...semEle]);
      gravarFila(
        enfileirar(filaRef.current, {
          opId: novoOpId(),
          tipo: 'salvar',
          produtoId: produto.id,
          produto,
          fotoParaEnviar: fotoTrocou && produto.fotoLocal ? produto.fotoLocal : undefined,
          criadoEm: produto.atualizadoEm,
        }),
      );
      // Sem await: a tela já pode seguir: a fila cuida do resto.
      sincronizar(false);
      return produto;
    },
    [gravarFila, gravarProdutos, sincronizar],
  );

  const remover = useCallback(
    async (id: string) => {
      apagarFoto(produtosRef.current.find((p) => p.id === id)?.fotoLocal);
      gravarProdutos(produtosRef.current.filter((p) => p.id !== id));
      gravarFila(
        enfileirar(filaRef.current, {
          opId: novoOpId(),
          tipo: 'remover',
          produtoId: id,
          criadoEm: new Date().toISOString(),
        }),
      );
      sincronizar(false);
    },
    [gravarFila, gravarProdutos, sincronizar],
  );

  const value = useMemo<LocalProductsState>(
    () => ({
      produtos,
      pendencias,
      carregando,
      sincronizando,
      ultimoEnvio,
      salvar,
      remover,
      sincronizarAgora,
    }),
    [
      produtos,
      pendencias,
      carregando,
      sincronizando,
      ultimoEnvio,
      salvar,
      remover,
      sincronizarAgora,
    ],
  );

  return (
    <LocalProductsContext.Provider value={value}>{children}</LocalProductsContext.Provider>
  );
}

export function useLocalProducts(): LocalProductsState {
  const ctx = useContext(LocalProductsContext);
  if (!ctx) {
    throw new Error('useLocalProducts deve ser usado dentro de <LocalProductsProvider>');
  }
  return ctx;
}
