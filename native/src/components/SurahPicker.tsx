import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ArText, Row, SurahNumber, Txt } from '@/components/ui';
import { SURAHS } from '@/data/surahs';
import { useIsRTL, useT } from '@/i18n';
import { norm } from '@/lib/text';
import { FONTS, useColors } from '@/theme/colors';

const INDEX = SURAHS.map(s => norm(`${s.n} ${s.tr} ${s.fr} ${s.ar}`));

/** Bouton affichant la sourate choisie ; ouvre une liste avec recherche. */
export function SurahPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const data = useMemo(() => {
    const nq = norm(q);
    return SURAHS.filter((_, i) => !nq || INDEX[i].includes(nq));
  }, [q]);
  const s = SURAHS[value - 1];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${t.surah} : ${s.tr}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.background }}>
        <SurahNumber n={s.n} />
        <Txt weight="bold" style={{ flex: 1 }} numberOfLines={1}>
          {s.tr}
        </Txt>
        <ArText numberOfLines={1} style={{ fontSize: 20, fontFamily: FONTS.arabicBold, flexShrink: 0 }}>{s.ar}</ArText>
        <Ionicons name="chevron-down" size={18} color={c.muted} />
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)} presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: c.background, direction: rtl ? 'rtl' : 'ltr' }}>
          <View style={{ padding: 16, gap: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="h2">{t.surah}</Txt>
              <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityLabel={t.close}>
                <Ionicons name="close" size={26} color={c.text} />
              </Pressable>
            </Row>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={t.searchSurah}
              placeholderTextColor={c.muted}
              style={{ backgroundColor: c.surface, borderRadius: 33, borderWidth: 1, borderColor: c.line, paddingHorizontal: 16, paddingVertical: 11, color: c.text, fontFamily: FONTS.ui, fontSize: 15, textAlign: rtl ? 'right' : 'left' }}
            />
          </View>
          <FlashList
            data={data}
            keyExtractor={x => String(x.n)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
            renderItem={({ item: x }) => (
              <Pressable
                onPress={() => {
                  onChange(x.n);
                  setOpen(false);
                  setQ('');
                }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 12, backgroundColor: x.n === value ? c.accentSoft : pressed ? c.line : 'transparent' })}>
                <SurahNumber n={x.n} active={x.n === value} />
                <View style={{ flex: 1 }}>
                  <Txt weight="bold">{x.tr}</Txt>
                  <Txt variant="small">{t.verses(x.verses)}</Txt>
                </View>
                <ArText numberOfLines={1} style={{ fontSize: 20, fontFamily: FONTS.arabicBold, flexShrink: 0 }}>{x.ar}</ArText>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

/** Nombre réglable : − / champ / +. */
export function NumberStepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  const c = useColors();
  const [text, setText] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const btn = (icon: 'remove' | 'add', delta: number) => (
    <Pressable onPress={() => onChange(clamp(value + delta))} hitSlop={6} accessibilityLabel={`${label} ${icon === 'add' ? '+' : '−'}`} style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={18} color={c.text} />
    </Pressable>
  );
  return (
    <Row gap={8} style={{ direction: 'ltr' }}>
      {btn('remove', -1)}
      <TextInput
        value={text ?? String(value)}
        onChangeText={setText}
        onBlur={() => {
          const v = parseInt(text ?? '', 10);
          if (!Number.isNaN(v)) onChange(clamp(v));
          setText(null);
        }}
        keyboardType="number-pad"
        accessibilityLabel={label}
        selectTextOnFocus
        style={{ minWidth: 58, textAlign: 'center', fontFamily: FONTS.uiBold, fontSize: 17, color: c.text, borderBottomWidth: 1, borderBottomColor: c.line, paddingVertical: 4 }}
      />
      {btn('add', 1)}
    </Row>
  );
}
