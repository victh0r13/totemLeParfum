import React, { useRef } from 'react';
import { Animated, Pressable, StyleProp, ViewStyle } from 'react-native';

interface Props {
  onPress?: () => void;
  disabled?: boolean;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  /**
   * Estilo do Pressable EXTERNO — é ele que participa do layout do pai.
   * Necessário para flex/width em containers de linha (ex.: teclado numérico),
   * já que o `style` é aplicado no Animated.View interno.
   */
  containerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/** Feedback de toque padrão do totem: leve escala ao pressionar. */
export function PressableScale({
  onPress,
  disabled,
  scaleTo = 0.96,
  style,
  containerStyle,
  children,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) =>
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={containerStyle}
      onPressIn={() => animateTo(scaleTo)}
      onPressOut={() => animateTo(1)}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
