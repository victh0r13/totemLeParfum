import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { colors, fonts } from '@/theme/theme';

interface ToastState {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastState | null>(null);

/** Toast em pílula escura na base da tela (avisos de atendente/amostra). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (msg: string) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setMessage(msg);
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(
          () => setMessage(null),
        );
      }, 3500);
    },
    [opacity],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message !== null && (
        <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
          <Text style={styles.text}>{message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastState {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 130,
    alignSelf: 'center',
    backgroundColor: colors.ink,
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 999,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    zIndex: 60,
  },
  text: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.cream },
});
