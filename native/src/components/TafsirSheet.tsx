import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Row, Txt } from '@/components/ui';
import { SURAHS } from '@/data/surahs';
import { arNum, useIsRTL, useT } from '@/i18n';
import { loadExtra, surahVerses } from '@/lib/quran';
import { useAsync } from '@/lib/use-async';
import { FONTS, useColors } from '@/theme/colors';

/** Tafsir Al-Muyassar + traduction française d'un verset (gardés hors ligne après le 1er chargement). */
export function TafsirSheet({ n, a, onClose }: { n: number; a: number | null; onClose: () => void }) {
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  const tafsir = useAsync(a ? `tafsir:${n}` : null, () => loadExtra(n, 'tafsir'));
  const fr = useAsync(a ? `fr:${n}` : null, () => loadExtra(n, 'fr'));
  const s = SURAHS[n - 1];

  const block = (title: string, res: typeof tafsir, dir: 'rtl' | 'ltr') => (
    <View style={{ gap: 6 }}>
      <Txt variant="label" color={c.accentStrong}>
        {title}
      </Txt>
      {res.status === 'ok' && a ? (
        <Text style={{ fontFamily: dir === 'rtl' ? FONTS.arabic : FONTS.ui, fontSize: dir === 'rtl' ? 19 : 15.5, lineHeight: dir === 'rtl' ? 36 : 26, color: c.text, writingDirection: dir, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          {res.value[a - 1]}
        </Text>
      ) : res.status === 'error' ? (
        <Txt variant="small">{t.extraError}</Txt>
      ) : (
        <ActivityIndicator color={c.accent} style={{ alignSelf: 'flex-start' }} />
      )}
    </View>
  );

  return (
    <Modal visible={a !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose} accessibilityLabel={t.close} />
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '85%', direction: rtl ? 'rtl' : 'ltr' }}>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="h2">{`${t.tafsirTitle} · ${rtl ? s.ar : s.tr} ${a ?? ''}`}</Txt>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t.close}>
              <Ionicons name="close" size={24} color={c.text} />
            </Pressable>
          </Row>
          {a && (
            <Text style={{ fontFamily: FONTS.arabic, fontSize: 24, lineHeight: 48, color: c.text, writingDirection: 'rtl', textAlign: 'right', backgroundColor: c.accentSoft, borderRadius: 12, padding: 12 }}>
              {surahVerses(n).verses[a - 1]}
              <Text style={{ color: c.accentStrong }}>{` ۝${arNum(a)}`}</Text>
            </Text>
          )}
          {block(t.tafsirMuyassar, tafsir, 'rtl')}
          {block(t.translationFr, fr, 'ltr')}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
