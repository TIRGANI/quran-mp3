import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Txt } from '@/components/ui';
import { useIsRTL, useT } from '@/i18n';
import type { CrashInfo } from '@/lib/crash';
import { useColors } from '@/theme/colors';

const WHATSAPP = '212602834831';

/** Écran affiché à la place d'une fermeture brutale de l'app. */
export function CrashScreen({ error, onRetry }: { error: CrashInfo; onRetry: () => void }) {
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  const report = () => {
    const text = `Wirdan — ${t.crashReportTitle}\n${error.message}\n${error.platform} · v${error.version}\n\n${error.stack}`;
    Linking.openURL(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`).catch(() => {});
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background, direction: rtl ? 'rtl' : 'ltr' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Ionicons name="refresh-circle" size={64} color={c.accent} />
          <Txt variant="title" style={{ textAlign: 'center', color: c.primary }}>
            {t.crashTitle}
          </Txt>
          <Txt style={{ textAlign: 'center' }} color={c.muted}>
            {t.crashBody}
          </Txt>
        </View>
        <Button
          label={t.crashRetry}
          icon={<Ionicons name="home" size={18} color="#fff" />}
          onPress={() => {
            onRetry();
            try {
              router.replace('/');
            } catch {
              // navigation pas encore prête : le nouvel affichage suffit
            }
          }}
        />
        <Button label={t.crashReport} kind="ghost" icon={<Ionicons name="logo-whatsapp" size={18} color={c.text} />} onPress={report} />
        <Txt variant="small" style={{ textAlign: 'center' }}>
          {error.message}
        </Txt>
      </ScrollView>
    </SafeAreaView>
  );
}
