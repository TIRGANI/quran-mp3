import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Txt } from '@/components/ui';
import { useIsRTL, useT } from '@/i18n';
import { clearCrash, type CrashInfo } from '@/lib/crash';
import { sendFeedback } from '@/lib/feedback';
import { useColors } from '@/theme/colors';

/** Écran affiché à la place d'une fermeture brutale de l'app. */
export function CrashScreen({ error, onRetry }: { error: CrashInfo; onRetry: () => void }) {
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  const [sent, setSent] = useState<'idle' | 'sending' | 'ok' | 'fail'>('idle');
  const report = async () => {
    if (sent === 'sending' || sent === 'ok') return;
    setSent('sending');
    const ok = await sendFeedback({
      subject: `Wirdan — ${t.crashReportTitle}`,
      message: error.message,
      crash: `${error.time}\n${error.platform} · v${error.version}\n\n${error.stack}`,
    });
    if (ok) clearCrash();
    setSent(ok ? 'ok' : 'fail');
  };
  const reportLabel = { idle: t.crashReport, sending: t.feedbackSending, ok: t.crashReportSent, fail: t.feedbackFail }[sent];
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
        <Button label={reportLabel} kind="ghost" icon={<Ionicons name={sent === 'ok' ? 'checkmark-circle' : 'send'} size={18} color={c.text} />} onPress={report} />
        <Txt variant="small" style={{ textAlign: 'center' }}>
          {error.message}
        </Txt>
      </ScrollView>
    </SafeAreaView>
  );
}
