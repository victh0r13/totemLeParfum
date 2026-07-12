import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { askConsultant, type ChatTurn } from '@/api/consultant';
import { FadeUp } from '@/components/FadeUp';
import { MiniCard } from '@/components/MiniCard';
import { PressableScale } from '@/components/PressableScale';
import { useCatalog } from '@/data/catalogStore';
import { colors, fonts } from '@/theme/theme';

type ChatMessage =
  | { key: string; kind: 'bot'; text: string }
  | { key: string; kind: 'user'; text: string }
  | { key: string; kind: 'products'; ids: string[] };

type ChipSpecial = 'retry' | 'quiz' | 'restart' | 'catalog';

interface ChipAction {
  label: string;
  special?: ChipSpecial;
}

function TypingDot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.25, duration: 500, useNativeDriver: true }),
        Animated.delay(400 - delay > 0 ? 400 - delay : 0),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, delay]);
  return <Animated.View style={[styles.typingDot, { opacity }]} />;
}

const OFFLINE_MESSAGE =
  'Puxa, não consegui me conectar agora. Você pode tentar de novo em instantes — ou fazer nosso quiz rápido, que também encontra a fragrância perfeita para você.';

export default function ChatScreen() {
  const router = useRouter();
  const { perfumes } = useCatalog();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chips, setChips] = useState<ChipAction[]>([]);
  const [typing, setTyping] = useState(false);
  const historyRef = useRef<ChatTurn[]>([]);
  const keyRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  const nextKey = () => `m${keyRef.current++}`;

  const requestReply = useCallback(async () => {
    setTyping(true);
    setChips([]);
    try {
      const reply = await askConsultant(historyRef.current);
      if (reply.message) {
        historyRef.current.push({ role: 'assistant', content: reply.message });
      }
      setMessages((prev) => {
        const added: ChatMessage[] = [];
        if (reply.message) added.push({ key: nextKey(), kind: 'bot', text: reply.message });
        if (reply.recommendations.length > 0) {
          added.push({ key: nextKey(), kind: 'products', ids: reply.recommendations });
        }
        return [...prev, ...added];
      });
      if (reply.done) {
        setChips([
          { label: 'Recomeçar conversa', special: 'restart' },
          { label: 'Explorar catálogo', special: 'catalog' },
        ]);
      } else {
        setChips(reply.quickReplies.map((label) => ({ label })));
      }
    } catch {
      setMessages((prev) => [...prev, { key: nextKey(), kind: 'bot', text: OFFLINE_MESSAGE }]);
      setChips([
        { label: 'Tentar novamente', special: 'retry' },
        { label: 'Fazer o quiz', special: 'quiz' },
      ]);
    } finally {
      setTyping(false);
    }
  }, []);

  useEffect(() => {
    // Saudação inicial do consultor.
    requestReply();
  }, [requestReply]);

  const onChip = (chip: ChipAction) => {
    if (typing) return;
    switch (chip.special) {
      case 'retry':
        requestReply();
        return;
      case 'quiz':
        router.replace('/quiz');
        return;
      case 'catalog':
        router.replace('/catalog');
        return;
      case 'restart':
        historyRef.current = [];
        setMessages([]);
        requestReply();
        return;
      default: {
        historyRef.current.push({ role: 'user', content: chip.label });
        setMessages((prev) => [...prev, { key: nextKey(), kind: 'user', text: chip.label }]);
        requestReply();
      }
    }
  };

  const renderMessage = (m: ChatMessage) => {
    if (m.kind === 'products') {
      const items = m.ids
        .map((id) => perfumes.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p);
      if (items.length === 0) return null;
      return (
        <FadeUp key={m.key}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.productsRow}
          >
            {items.map((p) => (
              <MiniCard
                key={p.id}
                perfume={p}
                width={190}
                showBrand
                onPress={() => router.push({ pathname: '/perfume/[id]', params: { id: p.id } })}
              />
            ))}
          </ScrollView>
        </FadeUp>
      );
    }
    const isBot = m.kind === 'bot';
    return (
      <FadeUp key={m.key} style={isBot ? styles.botAlign : styles.userAlign}>
        <View style={[styles.bubble, isBot ? styles.botBubble : styles.userBubble]}>
          <Text style={isBot ? styles.botText : styles.userText}>{m.text}</Text>
        </View>
      </FadeUp>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <PressableScale
          scaleTo={0.92}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/experience'))}
          style={styles.backButton}
        >
          <Text style={styles.backArrow}>←</Text>
        </PressableScale>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>L</Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>Consultor Le Parfum</Text>
          <Text style={styles.headerSubtitle}>Sempre disponível para você</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map(renderMessage)}
        {typing && (
          <FadeUp style={styles.botAlign}>
            <View style={[styles.bubble, styles.botBubble, styles.typingBubble]}>
              <TypingDot delay={0} />
              <TypingDot delay={200} />
              <TypingDot delay={400} />
            </View>
          </FadeUp>
        )}
      </ScrollView>

      <View style={styles.chipsBar}>
        <View style={styles.chipsRow}>
          {chips.map((chip, i) => (
            <FadeUp key={`${chip.label}-${i}`} delay={i * 70}>
              <PressableScale scaleTo={0.94} onPress={() => onChip(chip)} style={styles.chip}>
                <Text style={styles.chipText}>{chip.label}</Text>
              </PressableScale>
            </FadeUp>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingLeft: 24,
    paddingRight: 150,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  backButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(33,29,24,0.16)',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { fontSize: 20, color: colors.ink },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.serifSemiBold, fontSize: 22, color: colors.goldSoft },
  headerTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink },
  headerSubtitle: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.muted, marginTop: 1 },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 28, paddingVertical: 26, gap: 14 },
  botAlign: { alignItems: 'flex-start' },
  userAlign: { alignItems: 'flex-end' },
  bubble: { maxWidth: 600, paddingVertical: 16, paddingHorizontal: 22 },
  botBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
  },
  userBubble: {
    backgroundColor: colors.ink,
    borderRadius: 18,
    borderBottomRightRadius: 6,
    maxWidth: 520,
  },
  botText: { fontFamily: fonts.sans, fontSize: 17, lineHeight: 26, color: colors.ink },
  userText: { fontFamily: fonts.sansMedium, fontSize: 17, lineHeight: 25, color: colors.cream },
  typingBubble: { flexDirection: 'row', gap: 8, paddingVertical: 20, paddingHorizontal: 24 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.muted },
  productsRow: { gap: 14, paddingVertical: 4 },
  chipsBar: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 30,
    minHeight: 90,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
  },
  chip: {
    paddingVertical: 18,
    paddingHorizontal: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(168,130,63,0.5)',
    backgroundColor: colors.surface,
  },
  chipText: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.ink },
});
