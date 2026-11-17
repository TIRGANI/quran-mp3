import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Tip } from '@/components/Tip';
import { ProgressBar, Row, Screen, Txt } from '@/components/ui';
import { useIsRTL, useT } from '@/i18n';
import { chapterProgress, FEATURED, getChapter, searchChapters, useAdhkar } from '@/lib/adhkar';
import { FONTS, useColors } from '@/theme/colors';

export default function AdhkarScreen() {
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  const [q, setQ] = useState('');
  const counts = useAdhkar(s => s.counts);
  const day = useAdhkar(s => s.day);
  const data = useMemo(() => searchChapters(q), [q]);
  const open = (id: number) => router.push({ pathname: '/adhkar/[id]', params: { id: String(id) } });

  const header = (
    <View style={{ gap: 14, paddingBottom: 12 }}>
      <View>
        <Txt variant="title" style={{ color: c.primary }}>
          {t.adhkarTitle}
        </Txt>
        <Txt variant="small">{t.adhkarSubtitle}</Txt>
      </View>
      <Tip id="adhkar" />
      <Pressable
        onPress={() => router.navigate('/ruqya')}
        accessibilityRole="button"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.hero, borderRadius: 18, padding: 16, opacity: pressed ? 0.85 : 1 })}>
        <View style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="shield-checkmark" size={24} color={c.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt color="#fff" style={{ fontFamily: FONTS.arabicBold, fontSize: 20, lineHeight: 32, textAlign: rtl ? 'auto' : 'left' }}>
            الرقية الشرعية
          </Txt>
          <Txt variant="small" color="rgba(255,255,255,0.75)">
            {t.ruqyaCard}
          </Txt>
        </View>
        <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={20} color={c.accent} />
      </Pressable>
      {!q && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {FEATURED.map(({ id, icon }) => {
            const ch = getChapter(id);
            if (!ch) return null;
            const p = chapterProgress(ch, counts, day);
            const complete = p.done === p.total;
            return (
              <Pressable
                key={id}
                onPress={() => open(id)}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  width: '48%',
                  flexGrow: 1,
                  backgroundColor: id === 27 ? c.hero : c.surface,
                  borderRadius: 18,
                  padding: 14,
                  gap: 8,
                  borderWidth: 1,
                  borderColor: id === 27 ? c.hero : c.line,
                  opacity: pressed ? 0.85 : 1,
                })}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Ionicons name={icon} size={22} color={c.accent} />
                  {complete && <Ionicons name="checkmark-circle" size={20} color={c.success} />}
                </Row>
                <Txt weight="bold" numberOfLines={2} color={id === 27 ? '#fff' : c.text} style={{ fontFamily: FONTS.arabicBold, fontSize: 18, lineHeight: 30, textAlign: rtl ? 'auto' : 'left' }}>
                  {ch.title}
                </Txt>
                <ProgressBar value={p.done / p.total} height={4} color={complete ? c.success : c.accent} />
                <Txt variant="small" color={id === 27 ? 'rgba(255,255,255,0.7)' : c.muted}>{`${p.done} / ${p.total}`}</Txt>
              </Pressable>
            );
          })}
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 33, paddingHorizontal: 14, borderWidth: 1, borderColor: c.line }}>
        <Ionicons name="search" size={18} color={c.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t.searchAdhkar}
          placeholderTextColor={c.muted}
          style={{ flex: 1, paddingVertical: 11, paddingHorizontal: 10, color: c.text, fontFamily: FONTS.ui, fontSize: 15, textAlign: rtl ? 'right' : 'left' }}
        />
      </View>
      {!q && <Txt variant="h2">{t.allChapters}</Txt>}
    </View>
  );

  return (
    <Screen>
      <FlashList
        data={data}
        keyExtractor={ch => String(ch.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}
        extraData={counts}
        renderItem={({ item: ch }) => {
          const p = chapterProgress(ch, counts, day);
          return (
            <Pressable
              onPress={() => open(ch.id)}
              accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: pressed ? c.line : 'transparent' })}>
              <Txt style={{ flex: 1, fontFamily: FONTS.arabic, fontSize: 18, lineHeight: 30, writingDirection: 'rtl', textAlign: rtl ? 'auto' : 'right' }}>{ch.title}</Txt>
              {p.done === p.total ? (
                <Ionicons name="checkmark-circle" size={18} color={c.success} />
              ) : (
                <Txt variant="small">{ch.items.length}</Txt>
              )}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
