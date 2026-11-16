import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar, Tabs } from 'expo-router/js-tabs';
import { View } from 'react-native';

import { MiniPlayer } from '@/components/MiniPlayer';
import { useIsRTL, useT } from '@/i18n';
import { FONTS, useColors } from '@/theme/colors';

export default function TabsLayout() {
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  return (
    <Tabs
      // Le mini-lecteur est posé juste au-dessus de la barre d'onglets, visible partout.
      tabBar={props => (
        <View>
          <MiniPlayer />
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accentStrong,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line, direction: rtl ? 'rtl' : 'ltr' },
        tabBarLabelStyle: { fontFamily: FONTS.uiMedium, fontSize: 12 },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: t.tabListen, tabBarIcon: ({ color, size }) => <Ionicons name="headset" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="read"
        options={{ title: t.tabRead, tabBarIcon: ({ color, size }) => <Ionicons name="book" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="hifdh"
        options={{ title: t.tabHifdh, tabBarIcon: ({ color, size }) => <Ionicons name="school" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="adhkar"
        options={{ title: t.tabAdhkar, tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t.tabSettings, tabBarIcon: ({ color, size }) => <Ionicons name="settings-sharp" color={color as string} size={size} /> }}
      />
    </Tabs>
  );
}
