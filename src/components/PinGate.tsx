import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PinModal } from '@/components/PinModal';
import { colors } from '@/theme/theme';

interface Props {
  /** Contexto exibido no teclado do PIN, ex.: "Painel da loja". */
  title: string;
  children: React.ReactNode;
}

/**
 * Trava de PIN em volta do CONTEÚDO de uma tela, não do caminho até ela.
 *
 * Antes, o PIN vivia no ponto de entrada (o toque longo no logo) e a rota
 * `/admin` ficava aberta: bastava um deep link `leparfum://admin` — ou a URL
 * direta, na versão web — para entrar sem senha. Envolvendo a tela, a trava
 * vale para qualquer forma de chegar nela.
 *
 * O destravamento é por montagem: sair da tela e voltar exige o PIN de novo,
 * que é o comportamento certo para um aparelho compartilhado no balcão.
 */
export function PinGate({ title, children }: Props) {
  const router = useRouter();
  const [liberado, setLiberado] = useState(false);

  if (liberado) return <>{children}</>;

  return (
    <View style={styles.bloqueio}>
      <PinModal
        visible
        title={title}
        onClose={() => router.replace('/')}
        onSuccess={() => setLiberado(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Fundo opaco: o conteúdo protegido não pode piscar atrás do teclado.
  bloqueio: { flex: 1, backgroundColor: colors.bg },
});
