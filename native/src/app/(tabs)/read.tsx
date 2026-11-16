import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Tip } from '@/components/Tip';
import { ArText, Button, Card, ProgressBar, Row, Screen, Segmented, SurahNumber, Txt } from '@/components/ui';
import { SURAHS } from '@/data/surahs';
import { useIsRTL, useT } from '@/i18n';
import { GOALS, readCount, streak, surahsDone, today, TOTAL_AYAT, totalRead, useReading } from '@/stores/reading';
import { FONTS, useColors } from '@/theme/colors';

const openReader = (n: number, a?: number) =>
  router.push({ pathname: '/reader/[surah]', params: a ? { surah: String(n), ayah: String(a) } : { surah: String(n) } });

export default function ReadScreen() {
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  const { read, bookmarks, days, goal, khatmas, lastPos, setGoal, removeBookmark, resetKhatma } = useReading();
  const [armed, setArmed] = useState(false);

  const tot = totalRead(read);
  const done = surahsDone(read);
  const td = days[today()] ?? 0;
  const st = streak(days);
  const pct = (tot / TOTAL_AYAT) * 100;
  const complete = tot === TOTAL_AYAT;
  const sortedBm = [...bookmarks].sort((x, y) => x.n - y.n || x.a - y.a);
  const name = (n: number) => (rtl ? SURAHS[n - 1].ar : SURAHS[n - 1].tr);

  const header = (
    <View style={{ gap: 14, paddingBottom: 12 }}>
      <Txt variant="title" style={{ color: c.primary }}>
        {t.tabRead}
      </Txt>
      <Tip id="read" />

      {/* Reprendre */}
      <Pressable onPress={() => openReader(lastPos?.n ?? 1, lastPos?.a)} accessibilityRole="button">
        <View style={{ backgroundColor: c.hero, borderRadius: 20, padding: 18, gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="label" color={c.accent}>
              {lastPos ? t.continueReading : t.startReading}
            </Txt>
            <Ionicons name="book" size={20} color={c.accent} />
          </Row>
          <ArText style={{ color: '#fff', fontSize: 30, lineHeight: 52, fontFamily: FONTS.arabicBold, textAlign: rtl ? 'right' : 'left' }}>
            سورة {SURAHS[(lastPos?.n ?? 1) - 1].ar}
          </ArText>
          <Txt color="rgba(255,255,255,0.75)">{lastPos ? t.surahVerse(SURAHS[lastPos.n - 1].tr, lastPos.a) : SURAHS[0].tr}</Txt>
        </View>
      </Pressable>

      {/* Khatma + objectif du jour */}
      <Row gap={12} style={{ alignItems: 'stretch' }}>
        <Card style={{ flex: 1, gap: 6 }}>
          <Txt variant="label" color={c.accentStrong}>
            {t.khatma}
          </Txt>
          <Txt variant="title">{pct > 0 && pct < 10 ? pct.toFixed(1) : Math.floor(pct)}%</Txt>
          <ProgressBar value={pct / 100} />
          <Txt variant="small">{t.khatmaStat(tot, done)}</Txt>
          {khatmas > 0 && <Txt variant="small">{t.khatmasDone(khatmas)}</Txt>}
        </Card>
        <Card style={{ flex: 1, gap: 6 }}>
          <Txt variant="label" color={c.accentStrong}>
            {t.today}
          </Txt>
          <Txt variant="title">
            {td}
            <Txt variant="small">{` / ${goal}`}</Txt>
          </Txt>
          <ProgressBar value={td / goal} color={td >= goal ? c.success : c.accent} />
          <Txt variant="small">{t.todayStat(goal, st)}</Txt>
        </Card>
      </Row>
      <Card style={{ gap: 8 }}>
        <Txt variant="label">{t.dailyGoal}</Txt>
        <Segmented options={GOALS.map(g => [g, g === 208 ? t.juz : String(g)] as [number, string])} value={goal} onChange={setGoal} />
      </Card>

      {/* Marque-pages */}
      <Card style={{ gap: 4 }}>
        <Txt variant="label" color={c.accentStrong}>
          {t.bookmarks}
        </Txt>
        {sortedBm.length === 0 ? (
          <Txt variant="small">{t.noBookmarks}</Txt>
        ) : (
          sortedBm.map(b => (
            <Row key={`${b.n}:${b.a}`} style={{ borderBottomWidth: 1, borderBottomColor: c.line }}>
              <Pressable onPress={() => openReader(b.n, b.a)} style={{ flex: 1, paddingVertical: 9 }} accessibilityRole="button">
                <Row>
                  <Ionicons name="bookmark" size={16} color={c.accent} />
                  <Txt>{`${name(b.n)} — ${t.verseN(b.a)}`}</Txt>
                </Row>
              </Pressable>
              <Pressable onPress={() => removeBookmark(b.n, b.a)} hitSlop={10} accessibilityLabel={t.removeBookmark} style={{ padding: 6 }}>
                <Ionicons name="close" size={18} color={c.muted} />
              </Pressable>
            </Row>
          ))
        )}
      </Card>

      <Button
        label={armed ? t.confirmReset : complete ? t.newKhatma : t.resetKhatma}
        kind="danger"
        onPress={() => {
          if (!armed) return setArmed(true);
          resetKhatma();
          setArmed(false);
        }}
        style={armed ? { backgroundColor: c.danger } : undefined}
      />
      <Txt variant="small">{t.savedNote}</Txt>

      <Txt variant="h2" style={{ marginTop: 6 }}>
        {t.allSurahs}
      </Txt>
    </View>
  );

  return (
    <Screen>
      <FlashList
        data={SURAHS}
        keyExtractor={s => String(s.n)}
        ListHeaderComponent={header}
        extraData={read}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}
        renderItem={({ item: s }) => {
          const rc = readCount(read, s.n);
          return (
            <Pressable
              onPress={() => openReader(s.n)}
              accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 14, backgroundColor: pressed ? c.line : 'transparent' })}>
              <SurahNumber n={s.n} active={rc === s.verses} />
              <View style={{ flex: 1, gap: 4 }}>
                <Txt weight="bold" numberOfLines={1}>
                  {s.tr}
                </Txt>
                {rc > 0 ? (
                  <ProgressBar value={rc / s.verses} height={4} color={rc === s.verses ? c.success : c.accent} />
                ) : (
                  <Txt variant="small">{t.verses(s.verses)}</Txt>
                )}
              </View>
              <ArText numberOfLines={1} style={{ fontSize: 22, fontFamily: FONTS.arabicBold, flexShrink: 0 }}>{s.ar}</ArText>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
