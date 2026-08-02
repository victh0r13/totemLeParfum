import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FadeUp } from "@/components/FadeUp";
import { PressableScale } from "@/components/PressableScale";
import { colors, fonts } from "@/theme/theme";

function BobbingBottle({ compact }: { compact: boolean }) {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: 10,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [translateY]);

  return (
    <Animated.View
      style={[
        styles.bottle,
        { transform: [{ translateY }] },
        compact && { marginTop: 24 },
      ]}
    >
      <View style={[styles.bottleCap, compact && { width: 18, height: 24 }]} />
      <View
        style={[styles.bottleBody, compact && { width: 84, height: 118 }]}
      />
    </Animated.View>
  );
}

interface OptionCardProps {
  title: string;
  subtitle: string;
  gold?: boolean;
  delay: number;
  compact: boolean;
  onPress: () => void;
}

function OptionCard({
  title,
  subtitle,
  gold,
  delay,
  compact,
  onPress,
}: OptionCardProps) {
  return (
    <FadeUp delay={delay}>
      <PressableScale
        onPress={onPress}
        scaleTo={0.98}
        style={[styles.card, compact && styles.cardCompact]}
      >
        <View style={styles.cardText}>
          <Text style={[styles.cardTitle, compact && styles.cardTitleCompact]}>
            {title}
          </Text>
          <Text
            style={[styles.cardSubtitle, compact && styles.cardSubtitleCompact]}
          >
            {subtitle}
          </Text>
        </View>
        <View
          style={[styles.arrowCircle, gold && { backgroundColor: colors.gold }]}
        >
          <Text style={styles.arrow}>→</Text>
        </View>
      </PressableScale>
    </FadeUp>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  // Telas mais baixas (janela de navegador, tablets menores) usam o layout compacto
  // para as duas opções continuarem visíveis sem rolar.
  const compact = height < 1000;
  const sidePadding = Math.min(64, Math.max(24, width * 0.06));

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={[styles.hero, compact && { paddingTop: 36 }]}>
          <Text style={styles.eyebrow}>PERFUMARIA</Text>
          {/* Toque longo (equipe): o PIN é pedido pela própria tela do painel. */}
          <Pressable delayLongPress={1200} onLongPress={() => router.push('/admin')}>
            <Text style={[styles.logo, compact && styles.logoCompact]}>
              Le Parfum
            </Text>
          </Pressable>
          <View style={[styles.hairline, compact && { marginTop: 16 }]} />
          <Text style={[styles.tagline, compact && styles.taglineCompact]}>
            Encontre a fragrância perfeita para você ou para presentear.
          </Text>
        </View>

        <BobbingBottle compact={compact} />

        <View
          style={[
            styles.options,
            { paddingHorizontal: sidePadding },
            compact && { marginTop: 28, gap: 16 },
          ]}
        >
          <OptionCard
            title="Já conheço meu gosto"
            subtitle="Explore o catálogo com filtros por família olfativa, ocasião e preço."
            delay={100}
            compact={compact}
            onPress={() => router.push("/catalog")}
          />
          <OptionCard
            title="Quero descobrir meu gosto"
            subtitle="Seis perguntas visuais sobre estilo, ocasião e aromas — e uma seleção feita para você."
            gold
            delay={220}
            compact={compact}
            onPress={() => router.push("/quiz")}
          />
        </View>

        <Text
          style={[
            styles.footer,
            compact && { paddingTop: 24, paddingBottom: 20 },
          ]}
        >
          TOQUE PARA COMEÇAR
        </Text>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  hero: { alignItems: "center", paddingTop: 80 },
  eyebrow: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 4.2,
    color: colors.gold,
  },
  logo: {
    fontFamily: fonts.serif,
    fontSize: 82,
    lineHeight: 88,
    color: colors.ink,
    marginTop: 14,
  },
  logoCompact: { fontSize: 58, lineHeight: 64, marginTop: 10 },
  hairline: {
    width: 44,
    height: 1,
    backgroundColor: colors.gold,
    marginTop: 24,
  },
  tagline: {
    fontFamily: fonts.sans,
    fontSize: 19,
    lineHeight: 29,
    color: colors.muted,
    textAlign: "center",
    marginTop: 22,
    maxWidth: 420,
    paddingHorizontal: 32,
  },
  taglineCompact: { fontSize: 16, lineHeight: 24, marginTop: 14 },
  bottle: { alignItems: "center", marginTop: 44 },
  bottleCap: {
    width: 26,
    height: 34,
    backgroundColor: colors.ink,
    borderRadius: 2,
  },
  bottleBody: {
    width: 120,
    height: 170,
    marginTop: 6,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(168,130,63,0.35)",
    backgroundColor: "rgba(168,130,63,0.16)",
  },
  options: { marginTop: 48, gap: 24 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(33,29,24,0.09)",
    borderRadius: 20,
    padding: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardCompact: { padding: 26, gap: 18 },
  cardText: { flex: 1 },
  cardTitle: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 34,
    lineHeight: 39,
    color: colors.ink,
  },
  cardTitleCompact: { fontSize: 27, lineHeight: 32 },
  cardSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 17,
    lineHeight: 25,
    color: colors.muted,
    marginTop: 10,
  },
  cardSubtitleCompact: { fontSize: 15, lineHeight: 22, marginTop: 6 },
  arrowCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: { fontSize: 19, color: colors.cream },
  footer: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    letterSpacing: 2.5,
    color: colors.muted,
    textAlign: "center",
    marginTop: "auto",
    paddingTop: 40,
    paddingBottom: 32,
  },
});
