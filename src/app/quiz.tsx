import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CtaButton } from '@/components/CtaButton';
import { FadeUp } from '@/components/FadeUp';
import { PressableScale } from '@/components/PressableScale';
import { TopBar } from '@/components/TopBar';
import { useCatalog } from '@/data/catalogStore';
import { trackQuizConcluido } from '@/logic/metrics';
import { QUIZ_QUESTIONS, emptyAnswers, rankPerfumes, type QuizOption } from '@/logic/quiz';
import { colors, fonts } from '@/theme/theme';
import type { Familia, QuizAnswers } from '@/types/catalog';

export default function QuizScreen() {
  const router = useRouter();
  const { perfumes } = useCatalog();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(emptyAnswers);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progress = useRef(new Animated.Value(1 / QUIZ_QUESTIONS.length)).current;

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
      params: { ids: results.map((p) => p.id).join(','), quem: finalAnswers.quem ?? 'mim' },
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
        <View style={styles.optionsGrid}>
          {question.options.map((option, i) => {
            const selected = isSelected(option);
            return (
              <FadeUp
                key={String(option.value)}
                delay={i * 50}
                style={question.columns === 2 ? styles.optionHalf : styles.optionFull}
              >
                <PressableScale
                  scaleTo={0.97}
                  onPress={() => (question.multi ? pickMulti(option) : pickSingle(option))}
                  style={[styles.option, selected && styles.optionOn]}
                >
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  {!!option.sublabel && (
                    <Text style={styles.optionSublabel}>{option.sublabel}</Text>
                  )}
                </PressableScale>
              </FadeUp>
            );
          })}
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
  optionsScroll: { paddingHorizontal: 56, paddingTop: 34, paddingBottom: 20 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  optionFull: { width: '100%' },
  optionHalf: { flexBasis: '47%', flexGrow: 1 },
  option: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 30,
  },
  optionOn: {
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
    fontSize: 27,
    lineHeight: 31,
    color: colors.ink,
  },
  optionSublabel: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
    marginTop: 7,
  },
  ctaBar: { paddingHorizontal: 36, paddingBottom: 28, paddingTop: 8 },
  ctaButton: { width: '100%' },
});
