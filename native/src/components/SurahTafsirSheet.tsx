import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Row, Segmented, Txt } from '@/components/ui';
import { SURAHS } from '@/data/surahs';
import { arNum, useIsRTL, useT } from '@/i18n';
import { loadExtra, surahVerses } from '@/lib/quran';
import { useAsync } from '@/lib/use-async';
import { useReading } from '@/stores/reading';
import { FONTS, useColors } from '@/theme/colors';

/** Tafsir (ou traduction) de toute une sourate, verset par verset — ouvert depuis le lecteur audio. */
export function SurahTafsirSheet({ n, open, onClose }: { n: number; open: boolean; onClose: () => void }) {
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  // Même choix que dans la page de lecture (Tafsir Al-Muyassar ou traduction française)
  const kind = useReading(s => (s.prefs.extra === 'fr' ? 'fr' : 'tafsir'));
  const setPrefs = useReading(s => s.setPrefs);
  const res = useAsync(open ? `${kind}:${n}` : null, () => loadExtra(n, kind));
  const verses = surahVerses(n).verses;
  const s = SURAHS[n - 1];

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background, direction: rtl ? 'rtl' : 'ltr' }}>
        <View style={{ padding: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: c.line }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: FONTS.arabicBold, fontSize: 22, lineHeight: 38, color: c.primary }}>سورة {s.ar}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t.close}>
              <Ionicons name="close" size={26} color={c.text} />
            </Pressable>
          </Row>
          <Segmented
            options={[
              ['tafsir', t.tafsirMuyassar],
              ['fr', t.translationFr],
            ]}
            value={kind}
            onChange={v => setPrefs({ extra: v })}
          />
        </View>
        {res.status === 'ok' ? (
          <FlashList
            data={verses}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            renderItem={({ item: v, index: i }) => (
              <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line, gap: 8 }}>
                <Text style={{ fontFamily: FONTS.arabic, fontSize: 22, lineHeight: 44, color: c.text, writingDirection: 'rtl', textAlign: 'right' }}>
                  {v}
                  <Text style={{ color: c.accentStrong }}>{` ۝${arNum(i + 1)}`}</Text>
                </Text>
                <Text
                  style={{
                    fontFamily: kind === 'fr' ? FONTS.ui : FONTS.arabic,
                    fontSize: kind === 'fr' ? 15 : 18,
                    lineHeight: kind === 'fr' ? 25 : 34,
                    color: c.muted,
                    writingDirection: kind === 'fr' ? 'ltr' : 'rtl',
                    textAlign: kind === 'fr' ? 'left' : 'right',
                  }}>
                  {res.value[i]}
                </Text>
              </View>
            )}
          />
        ) : res.status === 'error' ? (
          <Txt style={{ padding: 24, textAlign: 'center' }} color={c.muted}>
            {t.extraError}
          </Txt>
        ) : (
          <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
        )}
      </SafeAreaView>
    </Modal>
  );
}
