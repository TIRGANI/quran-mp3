import { Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';
import { Changa_400Regular, Changa_500Medium, Changa_600SemiBold } from '@expo-google-fonts/changa';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import '@/audio/hifdh'; // enregistre le mode Hifdh auprès du lecteur
import { initAudio } from '@/audio/player';
import { Onboarding } from '@/components/Onboarding';
import { Toast } from '@/components/Toast';
import { handleNotificationTaps, syncReminders } from '@/notifications/reminders';
import { useSettings } from '@/stores/settings';
import { useIsDark, useColors } from '@/theme/colors';

SplashScreen.preventAutoHideAsync();
initAudio();
syncReminders();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Amiri_400Regular, Amiri_700Bold, Changa_400Regular, Changa_500Medium, Changa_600SemiBold });
  const c = useColors();
  const dark = useIsDark();
  const onboarded = useSettings(s => s.onboarded);

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
          </Stack>
          <Toast />
          {!onboarded && <Onboarding />}
        </View>
        <StatusBar style={dark ? 'light' : 'dark'} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
