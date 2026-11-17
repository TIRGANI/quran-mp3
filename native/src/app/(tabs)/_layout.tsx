import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar, Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useCallback, useEffect, useRef, type ComponentRef } from 'react';
import { View } from 'react-native';

import { MiniPlayer } from '@/components/MiniPlayer';
import { useIsRTL, useT } from '@/i18n';
import { FONTS, useColors } from '@/theme/colors';
import { STEPS } from '@/tour/steps';
import { setTarget, tourEvent, useTour } from '@/tour/store';

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
          <MeasuredTabBar {...props} rtl={rtl} />
        </View>
      )}
      // Visite guidée : signale l'ouverture de chaque onglet (ex. « tab:read »)
      screenListeners={({ route }) => ({ focus: () => tourEvent(`tab:${route.name}`) })}
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
        name="ruqya"
        options={{ title: t.tabRuqya, tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark" color={color as string} size={size} /> }}
      />
    </Tabs>
  );
}

/**
 * Barre d'onglets mesurée pour la visite guidée : la position de chaque onglet (« tab.read »…)
 * est déduite de celle de la barre (onglets de même largeur, ordre inversé en arabe).
 */
function MeasuredTabBar({ rtl, ...props }: BottomTabBarProps & { rtl: boolean }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const routes = props.state.routes.map(r => r.name);
  const measuring = useTour(s => s.active && !!STEPS[s.step]?.target.startsWith('tab.'));
  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (!width || !height) return;
      const w = width / routes.length;
      routes.forEach((name, i) => {
        const slot = rtl ? routes.length - 1 - i : i;
        setTarget(`tab.${name === 'index' ? 'listen' : name}`, { x: x + slot * w, y, width: w, height: Math.min(height, 64) });
      });
    });
  }, [routes, rtl]);
  useEffect(() => {
    if (!measuring) return;
    measure();
    const timer = setInterval(measure, 400);
    return () => clearInterval(timer);
  }, [measuring, measure]);
  return (
    <View ref={ref} onLayout={measure} collapsable={false}>
      <BottomTabBar {...props} />
    </View>
  );
}
