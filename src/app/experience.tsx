import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeUp } from '@/components/FadeUp';
import { PressableScale } from '@/components/PressableScale';
import { TopBar } from '@/components/TopBar';
import { colors, fonts } from '@/theme/theme';

function QuizGlyph() {
  return (
    <View style={styles.glyphRow}>
      {[true, true, false, false, false].map((on, i) => (
        <View key={i} style={[styles.diamond, !on && styles.diamondOff]} />
      ))}
    </View>
  );
}

function ChatGlyph() {
  return (
    <View style={styles.chatGlyph}>
      <View style={[styles.chatLine, { width: 150 }]} />
      <View style={[styles.chatLine, { width: 96 }]} />
      <View style={[styles.chatLine, { width: 60, backgroundColor: 'rgba(168,130,63,0.45)' }]} />
    </View>
  );
}

interface CardProps {
  glyph: React.ReactNode;
  title: string;
  subtitle: string;
  tag: string;
  delay: number;
  onPress: () => void;
}

function ExperienceCard({ glyph, title, subtitle, tag, delay, onPress }: CardProps) {
  return (
    <FadeUp delay={delay}>
      <PressableScale onPress={onPress} scaleTo={0.98} style={styles.card}>
        {glyph}
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
        <Text style={styles.cardTag}>{tag}</Text>
      </PressableScale>
    </FadeUp>
  );
}

export default function ExperienceScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar title="Descobrir meu gosto" />
      <View style={styles.header}>
        <Text style={styles.eyebrow}>DESCOBERTA</Text>
        <Text style={styles.title}>Como você prefere{'\n'}descobrir seu perfume?</Text>
      </View>

      <View style={styles.cards}>
        <ExperienceCard
          glyph={<QuizGlyph />}
          title="Quiz rápido"
          subtitle="Cinco perguntas visuais sobre ocasião, intensidade e aromas — e uma seleção feita para você."
          tag="≈ 1 MINUTO →"
          delay={80}
          onPress={() => router.push('/quiz')}
        />
        <ExperienceCard
          glyph={<ChatGlyph />}
          title="Consultor virtual"
          subtitle="Converse com nosso consultor: ele entende seu estilo e a ocasião, e recomenda na hora."
          tag="CONVERSA GUIADA →"
          delay={200}
          onPress={() => router.push('/chat')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 56, paddingTop: 48 },
  eyebrow: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 4.2,
    color: colors.gold,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 48,
    lineHeight: 56,
    color: colors.ink,
    marginTop: 14,
  },
  cards: { paddingHorizontal: 56, marginTop: 44, gap: 24 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.09)',
    borderRadius: 20,
    padding: 40,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  glyphRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  diamond: {
    width: 9,
    height: 9,
    backgroundColor: colors.goldSoft,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  diamondOff: { backgroundColor: 'rgba(33,29,24,0.15)' },
  chatGlyph: { gap: 8, maxWidth: 170 },
  chatLine: { height: 10, borderRadius: 5, backgroundColor: 'rgba(33,29,24,0.12)' },
  cardTitle: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 36,
    lineHeight: 42,
    color: colors.ink,
    marginTop: 20,
  },
  cardSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 17,
    lineHeight: 26,
    color: colors.muted,
    marginTop: 10,
    maxWidth: 460,
  },
  cardTag: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    letterSpacing: 2.5,
    color: colors.gold,
    marginTop: 20,
  },
});
