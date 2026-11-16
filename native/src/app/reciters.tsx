import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { onReciterChanged } from '@/audio/player';
import { ReciterAvatar } from '@/components/ReciterAvatar';
import { Row, Screen, Segmented, Txt } from '@/components/ui';
import { RECITERS } from '@/data/reciters';
import { useIsRTL, useT } from '@/i18n';
import { norm } from '@/lib/text';
import { useSettings } from '@/stores/settings';
import { FONTS, useColors } from '@/theme/colors';

const INDEX = RECITERS.map(r => norm(`${r.fr} ${r.ar}`));

export default function RecitersScreen() {
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  const current = useSettings(s => s.reciterId);
  const [q, setQ] = useState('');
  const [riwaya, setRiwaya] = useState<'all' | 'hafs' | 'warsh'>('all');

  const data = useMemo(() => {
    const nq = norm(q);
    return RECITERS.filter((r, i) => (!nq || INDEX[i].includes(nq)) && (riwaya === 'all' || r.warsh === (riwaya === 'warsh')));
  }, [q, riwaya]);

  const choose = (id: string) => {
    useSettings.getState().set({ reciterId: id });
    onReciterChanged(id);
    router.back();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ padding: 16, gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="title">{t.reciter}</Txt>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t.close}>
            <Ionicons name="close" size={26} color={c.text} />
          </Pressable>
        </Row>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 33, paddingHorizontal: 14, borderWidth: 1, borderColor: c.line }}>
          <Ionicons name="search" size={18} color={c.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            autoFocus={false}
            placeholder={t.searchReciter}
            placeholderTextColor={c.muted}
            style={{ flex: 1, paddingVertical: 11, paddingHorizontal: 10, color: c.text, fontFamily: FONTS.ui, fontSize: 15, textAlign: rtl ? 'right' : 'left' }}
          />
        </View>
        <Segmented
          options={[
            ['all', t.all],
            ['hafs', t.hafs],
            ['warsh', t.warsh],
          ]}
          value={riwaya}
          onChange={setRiwaya}
        />
      </View>
      <FlashList
        data={data}
        keyExtractor={r => r.id}
        extraData={current}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListEmptyComponent={<Txt style={{ textAlign: 'center', padding: 30 }} color={c.muted}>{t.noReciter}</Txt>}
        renderItem={({ item: r }) => {
          const on = r.id === current;
          const count = r.kb.filter(k => k > 0).length;
          return (
            <Pressable
              onPress={() => choose(r.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: on ? c.accentSoft : pressed ? c.line : 'transparent' })}>
              <ReciterAvatar reciter={r} size={48} />
              <View style={{ flex: 1 }}>
                <Txt weight="bold" numberOfLines={1}>
                  {rtl ? r.ar : r.fr}
                </Txt>
                <Txt variant="small" numberOfLines={1}>
                  {`${rtl ? r.fr : r.ar} · ${r.warsh ? t.warsh : t.hafs}${count < 114 ? ` · ${count}/114` : ''}`}
                </Txt>
              </View>
              {on && <Ionicons name="checkmark-circle" size={22} color={c.accentStrong} />}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
