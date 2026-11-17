import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { CAN_DOWNLOAD, dlKey, useDownloads } from '@/audio/downloads';
import { isAvailable, playSurah, togglePlay, usePlayer } from '@/audio/player';
import { TourTarget } from '@/tour/TourTarget';
import { DownloadButton } from '@/components/DownloadButton';
import { Tip } from '@/components/Tip';
import { ReciterAvatar } from '@/components/ReciterAvatar';
import { ArText, Chip, Row, Screen, SurahNumber, Txt } from '@/components/ui';
import { SURAHS, type Surah } from '@/data/surahs';
import { useIsRTL, useT } from '@/i18n';
import { norm } from '@/lib/text';
import { useReciter } from '@/stores/settings';
import { FONTS, useColors } from '@/theme/colors';

type Filter = 'all' | 'meccan' | 'medinan' | 'downloaded';
const SEARCH_INDEX = SURAHS.map(s => norm(`${s.n} ${s.tr} ${s.tr.replace(/-/g, ' ')} ${s.fr} ${s.ar} سورة ${s.ar}`));

export default function ListenScreen() {
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  const reciter = useReciter();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const done = useDownloads(s => s.done);
  const current = usePlayer(s => (s.reciterId === reciter.id ? s.surah : null));

  const data = useMemo(() => {
    const nq = norm(q);
    return SURAHS.filter(s => {
      if (nq && !SEARCH_INDEX[s.n - 1].includes(nq)) return false;
      if (filter === 'meccan') return !s.medinan;
      if (filter === 'medinan') return s.medinan;
      if (filter === 'downloaded') return !!done[dlKey(reciter.id, s.n)];
      return true;
    });
  }, [q, filter, done, reciter.id]);

  const onPress = (s: Surah) => (s.n === current ? togglePlay() : playSurah(s.n));

  const header = (
    <View style={{ gap: 14, paddingBottom: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="title" style={{ fontFamily: rtl ? FONTS.arabicBold : FONTS.uiBold, color: c.primary }}>
          {t.appName}
        </Txt>
        <TourTarget id="listen.settings">
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t.tabSettings}
            style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="settings-sharp" size={20} color={c.text} />
          </Pressable>
        </TourTarget>
      </Row>
      <Tip id="listen" />
      <TourTarget id="listen.reciter">
        <Pressable
          onPress={() => router.push('/reciters')}
          accessibilityRole="button"
          accessibilityLabel={`${t.reciter} : ${rtl ? reciter.ar : reciter.fr}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: c.line }}>
          <ReciterAvatar reciter={reciter} size={52} />
          <View style={{ flex: 1 }}>
            <Txt variant="small">{t.reciter}</Txt>
            <Txt variant="h2" numberOfLines={1}>
              {rtl ? reciter.ar : reciter.fr}
            </Txt>
            <Txt variant="small">{reciter.warsh ? t.warsh : t.hafs}</Txt>
          </View>
          <Row gap={4}>
            <Txt variant="label" color={c.accentStrong}>
              {t.changeReciter}
            </Txt>
            <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={16} color={c.accentStrong} />
          </Row>
        </Pressable>
      </TourTarget>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 33, paddingHorizontal: 14, borderWidth: 1, borderColor: c.line }}>
        <Ionicons name="search" size={18} color={c.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t.searchSurah}
          placeholderTextColor={c.muted}
          returnKeyType="search"
          style={{ flex: 1, paddingVertical: 11, paddingHorizontal: 10, color: c.text, fontFamily: FONTS.ui, fontSize: 15, textAlign: rtl ? 'right' : 'left' }}
        />
        {!!q && (
          <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityLabel={t.close}>
            <Ionicons name="close-circle" size={18} color={c.muted} />
          </Pressable>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        <Chip label={t.all} on={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label={t.meccanPl} on={filter === 'meccan'} onPress={() => setFilter('meccan')} />
        <Chip label={t.medinanPl} on={filter === 'medinan'} onPress={() => setFilter('medinan')} />
        {CAN_DOWNLOAD && <Chip label={t.downloaded} on={filter === 'downloaded'} onPress={() => setFilter('downloaded')} />}
      </ScrollView>
    </View>
  );

  return (
    <Screen>
      <FlashList
        data={data}
        keyExtractor={s => String(s.n)}
        ListHeaderComponent={header}
        ListEmptyComponent={<Txt style={{ textAlign: 'center', padding: 30 }} color={c.muted}>{t.noSurah}</Txt>}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}
        extraData={current}
        renderItem={({ item: s }) => {
          const active = s.n === current;
          const available = isAvailable(reciter, s.n);
          const row = (
            <Pressable
              onPress={() => onPress(s)}
              disabled={!available}
              accessibilityRole="button"
              accessibilityLabel={`${s.n}. ${s.tr}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 11,
                paddingHorizontal: 10,
                borderRadius: 14,
                opacity: available ? 1 : 0.4,
                backgroundColor: active ? c.accentSoft : pressed ? c.line : 'transparent',
              })}>
              <SurahNumber n={s.n} active={active} />
              <View style={{ flex: 1 }}>
                <Txt weight="bold" numberOfLines={1}>
                  {s.tr}
                </Txt>
                <Txt variant="small" numberOfLines={1}>
                  {`${rtl ? '' : `${s.fr} · `}${t.verses(s.verses)} · ${s.medinan ? t.medinan : t.meccan}${reciter.kb[s.n - 1] ? ` · ${t.mb(reciter.kb[s.n - 1] / 1024)}` : ''}`}
                </Txt>
              </View>
              <ArText numberOfLines={1} style={{ fontSize: 22, fontFamily: FONTS.arabicBold, flexShrink: 0 }}>{s.ar}</ArText>
              {s.n === 1 ? (
                <TourTarget id="listen.download">
                  <DownloadButton reciter={reciter} n={s.n} />
                </TourTarget>
              ) : (
                <DownloadButton reciter={reciter} n={s.n} />
              )}
            </Pressable>
          );
          // Première sourate : cible de la visite guidée (« touchez Al-Fatiha »)
          return s.n === 1 ? <TourTarget id="listen.surah">{row}</TourTarget> : row;
        }}
      />
    </Screen>
  );
}
