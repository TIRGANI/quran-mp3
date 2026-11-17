import { Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';
import { Changa_400Regular, Changa_500Medium, Changa_600SemiBold } from '@expo-google-fonts/changa';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import '@/audio/hifdh'; // enregistre le mode Hifdh auprès du lecteur
import { initAudio } from '@/audio/player';
import { CrashScreen } from '@/components/CrashScreen';
import { Onboarding } from '@/components/Onboarding';
import { installCrashGuard, recordError, useCrash } from '@/lib/crash';
import { Toast } from '@/components/Toast';
import { handleNotificationTaps, syncReminders } from '@/notifications/reminders';
import { useSettings } from '@/stores/settings';
import { TourOverlay } from '@/tour/TourOverlay';
import { useIsDark, useColors } from '@/theme/colors';

installCrashGuard(); // une erreur ne ferme plus l'app : écran de reprise à la place
SplashScreen.preventAutoHideAsync();
initAudio();
syncReminders();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Amiri_400Regular, Amiri_700Bold, Changa_400Regular, Changa_500Medium, Changa_600SemiBold });
  const c = useColors();
  const dark = useIsDark();
  const onboarded = useSettings(s => s.onboarded);
  const crash = useCrash(s => s.error);

  const ready = fontsLoaded || !!fontError;
  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync();
    // Toucher une notification de rappel ouvre l'écran correspondant
    return handleNotificationTaps();
  }, [ready]);
  if (!fontsLoaded && !fontError) return null;

  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = { ...base, colors: { ...base.colors, background: c.background, card: c.surface, text: c.text, border: c.line, primary: c.accentStrong } };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navTheme}>
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="reader/[surah]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="adhkar/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="player" options={{ presentation: 'modal' }} />
            <Stack.Screen name="reciters" options={{ presentation: 'modal' }} />
            <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="feedback" options={{ presentation: 'modal' }} />
          </Stack>
          <Toast />
          {crash && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200 }}>
              <CrashScreen error={crash} onRetry={() => useCrash.setState({ error: null })} />
            </View>
          )}
          <TourOverlay />
          {!onboarded && <Onboarding />}
        </View>
        <StatusBar style={dark ? 'light' : 'dark'} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

/** Erreur pendant l'affichage d'un écran : écran de reprise au lieu d'une fermeture de l'app. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const [info] = useState(() => recordError(error));
  return <CrashScreen error={info} onRetry={() => retry()} />;
}
