import {
  CormorantGaramond_500Medium,
  CormorantGaramond_500Medium_Italic,
  CormorantGaramond_600SemiBold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { Stack } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';

import { RestartButton } from '@/components/RestartButton';
import { ToastProvider } from '@/components/ToastProvider';
import { CatalogProvider } from '@/data/catalogStore';
import { PromotionsProvider } from '@/data/promotionsStore';
import { KioskProvider } from '@/kiosk/KioskProvider';
import { colors } from '@/theme/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Totem: a tela nunca dorme enquanto o app está aberto.
  useKeepAwake();

  const [fontsLoaded] = useFonts({
    CormorantGaramond_500Medium,
    CormorantGaramond_500Medium_Italic,
    CormorantGaramond_600SemiBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  useEffect(() => {
    // Trava a orientação em retrato (modo quiosque).
    if (Platform.OS !== 'web') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <PromotionsProvider>
      <CatalogProvider>
        <ToastProvider>
          <KioskProvider>
            <StatusBar style="dark" hidden />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'fade_from_bottom',
                animationDuration: 300,
              }}
            />
            <RestartButton />
          </KioskProvider>
        </ToastProvider>
      </CatalogProvider>
    </PromotionsProvider>
  );
}
