import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CtaButton } from '@/components/CtaButton';
import { FadeUp } from '@/components/FadeUp';
import { PressableScale } from '@/components/PressableScale';
import { TopBar } from '@/components/TopBar';
import { useCatalog } from '@/data/catalogStore';
import { trackQuizConcluido } from '@/logic/metrics';
import {
  QUIZ_QUESTIONS,
  emptyAnswers,
  rankPerfumes,
  respostasParaParam,
  type QuizOption,
} from '@/logic/quiz';
import { colors, familyTints, fonts } from '@/theme/theme';
import type { Familia, QuizAnswers } from '@/types/catalog';

/** Divide as opções em linhas de `colunas` itens. */
function emLinhas<T>(itens: T[], colunas: number): T[][] {
  const linhas: T[][] = [];
  for (let i = 0; i < itens.length; i += colunas) linhas.push(itens.slice(i, i + colunas));
  return linhas;
}

/** Três barras crescentes, preenchidas até o nível da opção. */
function Medidor({ nivel }: { nivel: number }) {
  return (
    <View style={styles.medidor}>
      {[1, 2, 3].map((n) => (
        <View
          key={n}
          style={[
            styles.medidorBarra,
            { height: 12 + n * 10 },
            n <= nivel && styles.medidorBarraOn,
          ]}
        />
      ))}
    </View>
  );
}

export default function QuizScreen() {
  const router = useRouter();
  const { perfumes } = useCatalog();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(emptyAnswers);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // useState, e não useRef: o valor animado é lido no render (interpolate).
  const [progress] = useState(() => new Animated.Value(1 / QUIZ_QUESTIONS.length));

  const question = QUIZ_QUESTIONS[step];
  const isLast = step === QUIZ_QUESTIONS.length - 1;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: (step + 1) / QUIZ_QUESTIONS.length,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [step, progress]);

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  const finish = (finalAnswers: QuizAnswers) => {
    trackQuizConcluido(finalAnswers);
    const results = rankPerfumes(perfumes, finalAnswers);
    router.replace({
      pathname: '/quiz-result',
      params: {
        ids: results.map((p) => p.id).join(','),
        respostas: respostasParaParam(finalAnswers),
      },
    });
  };

  const advance = (finalAnswers: QuizAnswers) => {
    if (isLast) {
      finish(finalAnswers);
    } else {
      setStep((s) => s + 1);
    }
  };

  const pickSingle = (option: QuizOption) => {
    const next = { ...answers, [question.key]: option.value } as QuizAnswers;
    setAnswers(next);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    // Pequena pausa para o feedback visual da seleção antes de avançar.
    advanceTimer.current = setTimeout(() => advance(next), 280);
  };

  const pickMulti = (option: QuizOption) => {
    const familia = option.value as Familia;
    setAnswers((prev) => {
      const has = prev.familias.includes(familia);
      if (!has && prev.familias.length >= (question.maxSelections ?? 2)) return prev;
      return {
        ...prev,
        familias: has ? prev.familias.filter((f) => f !== familia) : [...prev.familias, familia],
      };
    });
  };

  const isSelected = (option: QuizOption): boolean =>
    question.multi
      ? answers.familias.includes(option.value as Familia)
      : answers[question.key] === option.value;

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar
        title={`Pergunta ${step + 1} de ${QUIZ_QUESTIONS.length}`}
        onBack={() => (step === 0 ? router.back() : setStep((s) => s - 1))}
      />

      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>{question.title}</Text>
        {!!question.subtitle && <Text style={styles.subtitle}>{question.subtitle}</Text>}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.optionsScroll}
        key={step}
      >
        {/* As opções crescem para ocupar a tela: num totem, alvo grande é alvo fácil.
            A grade é montada em linhas explícitas (coluna de linhas) porque o
            flexGrow de um flexWrap estica a largura, não a altura. */}
        <View style={styles.optionsGrid}>
          {emLinhas(question.options, question.columns).map((linha, l) => (
            <View key={l} style={styles.optionLine}>
              {linha.map((option, c) => {
                const i = l * question.columns + c;
                const selected = isSelected(option);
                const tint =
                  question.key === 'familias' ? familyTints[option.value as Familia] : null;
                const conteudo = (
                  <View style={styles.optionRow}>
                    <View style={styles.optionTexts}>
                      <Text style={styles.optionLabel}>{option.label}</Text>
                      {!!option.sublabel && (
                        <Text style={[styles.optionSublabel, tint && styles.optionSublabelTint]}>
                          {option.sublabel}
                        </Text>
                      )}
                    </View>
                    {question.key === 'intensidade' && <Medidor nivel={Number(option.value)} />}
                    {question.multi && (
                      <View style={[styles.check, selected && styles.checkOn]}>
                        {selected && <Text style={styles.checkMark}>{'\u2713'}</Text>}
                      </View>
                    )}
                  </View>
                );
                return (
                  <FadeUp key={String(option.value)} delay={i * 50} style={styles.optionCell}>
                    <PressableScale
                      scaleTo={0.97}
                      onPress={() => (question.multi ? pickMulti(option) : pickSingle(option))}
                      containerStyle={styles.optionFill}
                      style={[styles.option, tint && styles.optionTint, selected && styles.optionOn]}
                    >
                      {tint ? (
                        <LinearGradient
                          colors={tint}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.optionGradient}
                        >
                          {conteudo}
                        </LinearGradient>
                      ) : (
                        conteudo
                      )}
                    </PressableScale>
                  </FadeUp>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      {question.multi && (
        <View style={styles.ctaBar}>
          <CtaButton
            label="Continuar"
            disabled={answers.familias.length === 0}
            onPress={() => advance(answers)}
            style={styles.ctaButton}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(33,29,24,0.08)',
    marginHorizontal: 56,
    marginTop: 22,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: colors.gold },
  header: { paddingHorizontal: 56, paddingTop: 40 },
  title: { fontFamily: fonts.serif, fontSize: 44, lineHeight: 51, color: colors.ink },
  subtitle: { fontFamily: fonts.sans, fontSize: 17, color: colors.muted, marginTop: 10 },
  optionsScroll: { flexGrow: 1, paddingHorizontal: 56, paddingTop: 34, paddingBottom: 28 },
  optionsGrid: { flexGrow: 1, gap: 16 },
  // Cresce até um teto: com 2 opções, dois cartões enormes ficariam caricatos.
  optionLine: { flexGrow: 1, flexDirection: 'row', gap: 16, maxHeight: 210, minHeight: 112 },
  optionCell: { flex: 1 },
  optionFill: { flex: 1 },
  optionTint: { padding: 0, paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden' },
  optionGradient: { flex: 1, justifyContent: 'center', paddingVertical: 28, paddingHorizontal: 30 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  optionTexts: { flex: 1 },
  optionSublabelTint: { color: colors.inkSoft },
  medidor: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  medidorBarra: { width: 10, borderRadius: 3, backgroundColor: 'rgba(33,29,24,0.1)' },
  medidorBarraOn: { backgroundColor: colors.gold },
  check: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: 'rgba(33,29,24,0.35)',
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  checkMark: { color: colors.cream, fontSize: 17, fontFamily: fonts.sansBold },
  option: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 30,
  },
  optionOn: {
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.creamGold,
    shadowColor: colors.gold,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  optionLabel: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 32,
    lineHeight: 36,
    color: colors.ink,
  },
  optionSublabel: {
    fontFamily: fonts.sans,
    fontSize: 17,
    lineHeight: 24,
    color: colors.muted,
    marginTop: 8,
  },
  ctaBar: { paddingHorizontal: 36, paddingBottom: 28, paddingTop: 8 },
  ctaButton: { width: '100%' },
});
