import { usePathname, useRouter } from 'expo-router';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { KIOSK_TIMEOUT_SECONDS, KIOSK_WARNING_SECONDS } from '@/config';
import { colors, fonts } from '@/theme/theme';

interface KioskState {
  /** Volta à tela inicial e limpa a sessão atual. */
  resetSession: () => void;
  /**
   * Pausa o relógio de inatividade enquanto a equipe usa uma tela de trabalho.
   *
   * Existe porque digitar NÃO conta como toque: o teclado do Android é uma
   * janela nativa, fora da árvore de views do app, então o
   * `onStartShouldSetResponderCapture` abaixo nunca dispara enquanto alguém
   * preenche um formulário. Sem esta pausa, um cadastro que leve mais de 90s
   * seria interrompido pelo aviso "Ainda está aí?" e perderia o que foi
   * digitado.
   */
  suspender: (pausado: boolean) => void;
}

const KioskContext = createContext<KioskState | null>(null);

/**
 * Modo quiosque: fora da tela inicial, 90s de inatividade exibem o aviso
 * "Ainda está aí?" com contagem regressiva; ao zerar, volta ao início.
 * Qualquer toque na tela reinicia o cronômetro.
 */
export function KioskProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const lastTouch = useRef(0);
  const suspenso = useRef(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  // Espelho do countdown para o intervalo ler sem se reinscrever a cada segundo.
  const countdownRef = useRef<number | null>(null);
  useEffect(() => {
    countdownRef.current = countdown;
  }, [countdown]);

  const isHome = pathname === '/';

  const registerTouch = useCallback(() => {
    lastTouch.current = Date.now();
    if (countdownRef.current !== null) setCountdown(null);
  }, []);

  const suspender = useCallback((pausado: boolean) => {
    suspenso.current = pausado;
    // Ao voltar, o relógio recomeça do zero: quem acabou de sair do formulário
    // ganha os 90s inteiros, não o resto de uma contagem antiga.
    lastTouch.current = Date.now();
    setCountdown(null);
  }, []);

  const resetSession = useCallback(() => {
    lastTouch.current = Date.now();
    setCountdown(null);
    try {
      router.dismissAll();
    } catch {
      // Pilha já está na raiz.
    }
    router.replace('/');
  }, [router]);

  useEffect(() => {
    // O relógio de inatividade começa a contar quando a tela aparece.
    if (lastTouch.current === 0) lastTouch.current = Date.now();
    const timer = setInterval(() => {
      if (isHome || suspenso.current) {
        if (countdownRef.current !== null) setCountdown(null);
        return;
      }
      const current = countdownRef.current;
      if (current !== null) {
        if (current <= 1) {
          resetSession();
        } else {
          setCountdown(current - 1);
        }
        return;
      }
      const idleSeconds = (Date.now() - lastTouch.current) / 1000;
      if (idleSeconds >= KIOSK_TIMEOUT_SECONDS) {
        setCountdown(KIOSK_WARNING_SECONDS);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isHome, resetSession]);

  return (
    <KioskContext.Provider value={{ resetSession, suspender }}>
      <View
        style={styles.root}
        onStartShouldSetResponderCapture={() => {
          registerTouch();
          return false;
        }}
      >
        {children}
        {countdown !== null && (
          <View style={styles.overlay}>
            <View style={styles.card}>
              <Text style={styles.eyebrow}>Ainda está aí?</Text>
              <Text style={styles.count}>{countdown}</Text>
              <Text style={styles.hint}>A sessão será reiniciada para o próximo cliente.</Text>
              <PressableScale style={styles.cta} onPress={registerTouch}>
                <Text style={styles.ctaText}>Continuar navegando</Text>
              </PressableScale>
            </View>
          </View>
        )}
      </View>
    </KioskContext.Provider>
  );
}

export function useKiosk(): KioskState {
  const ctx = useContext(KioskContext);
  if (!ctx) throw new Error('useKiosk deve ser usado dentro de <KioskProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(24,20,16,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: colors.bg,
    borderRadius: 26,
    paddingVertical: 56,
    paddingHorizontal: 70,
    alignItems: 'center',
    maxWidth: 480,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 24 },
    elevation: 16,
  },
  eyebrow: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: colors.gold,
  },
  count: {
    fontFamily: fonts.serif,
    fontSize: 80,
    lineHeight: 84,
    color: colors.ink,
    marginTop: 20,
  },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 17,
    lineHeight: 25,
    color: colors.muted,
    marginTop: 16,
    textAlign: 'center',
  },
  cta: {
    marginTop: 30,
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingVertical: 22,
    paddingHorizontal: 34,
  },
  ctaText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    color: colors.cream,
    letterSpacing: 0.5,
  },
});
