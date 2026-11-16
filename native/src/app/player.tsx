import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { seekTo, setRate, step, togglePlay, usePlayer } from '@/audio/player';
import { DownloadButton } from '@/components/DownloadButton';
import { ReciterAvatar } from '@/components/ReciterAvatar';
import { SurahTafsirSheet } from '@/components/SurahTafsirSheet';
import { Tip } from '@/components/Tip';
import { ArText, Button, Row, Screen, Segmented, Txt } from '@/components/ui';
import { SURAHS } from '@/data/surahs';
import { useIsRTL, useT } from '@/i18n';
import { fmtTime } from '@/lib/text';
import { getReciter, useSettings } from '@/stores/settings';
import { FONTS, useColors } from '@/theme/colors';

const RATES: [number, string][] = [
  [0.75, '0.75×'],
  [1, '1×'],
  [1.25, '1.25×'],
  [1.5, '1.5×'],
];

export default function PlayerScreen() {
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  const p = usePlayer();
  const { rate, autoNext, repeat, set } = useSettings();
  const [dragging, setDragging] = useState<number | null>(null);
  const [tafsirOpen, setTafsirOpen] = useState(false);
  const s = p.surah ? SURAHS[p.surah - 1] : null;
  const r = getReciter(p.reciterId ?? '');

  return (
    <Screen edges={['top', 'bottom']} style={{ backgroundColor: c.playerBg }}>
      <Row style={{ justifyContent: 'space-between', padding: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t.close}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </Pressable>
        <Txt variant="label" color="rgba(255,255,255,0.7)">
          {t.nowPlaying}
        </Txt>
        {s ? <DownloadButton reciter={r} n={s.n} /> : <View style={{ width: 36 }} />}
      </Row>

      <Tip id="player" style={{ marginHorizontal: 16, maxWidth: 560, alignSelf: 'center' }} />
      {s && (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 26, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          <View style={{ alignItems: 'center', gap: 14 }}>
            <ReciterAvatar reciter={r} size={150} />
            <ArText style={{ color: '#fff', fontSize: 40, fontFamily: FONTS.arabicBold, lineHeight: 70 }}>سورة {s.ar}</ArText>
            <Txt color={c.accent} weight="bold">
              {`${s.n}. ${s.tr}`}
            </Txt>
            <Txt color="rgba(255,255,255,0.75)">{rtl ? r.ar : r.fr}</Txt>
          </View>

          <View style={{ direction: 'ltr' }}>
            <Slider
              minimumValue={0}
              maximumValue={Math.max(1, p.duration)}
              value={dragging ?? p.currentTime}
              onValueChange={setDragging}
              onSlidingComplete={v => {
                seekTo(v);
                setDragging(null);
              }}
              minimumTrackTintColor={c.accent}
              maximumTrackTintColor="rgba(255,255,255,0.25)"
              thumbTintColor={c.accent}
            />
            <Row style={{ justifyContent: 'space-between', paddingHorizontal: 4, direction: 'ltr' }}>
              <Txt variant="small" color="rgba(255,255,255,0.7)" style={{ writingDirection: 'ltr' }}>
                {fmtTime(dragging ?? p.currentTime)}
              </Txt>
              <Txt variant="small" color="rgba(255,255,255,0.7)" style={{ writingDirection: 'ltr' }}>
                {`-${fmtTime(p.duration - (dragging ?? p.currentTime))}`}
              </Txt>
            </Row>
          </View>

          <Row gap={28} style={{ justifyContent: 'center', direction: 'ltr' }}>
            <Pressable onPress={() => seekTo(p.currentTime - 10)} hitSlop={10} accessibilityLabel="-10 s">
              <Ionicons name="play-back" size={26} color="#fff" />
            </Pressable>
            <Pressable onPress={() => step(-1)} hitSlop={10} accessibilityLabel={t.prevSurah}>
              <Ionicons name="play-skip-back" size={30} color="#fff" />
            </Pressable>
            <Pressable onPress={togglePlay} accessibilityLabel={p.playing ? t.pause : t.listen} style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
              {p.buffering && !p.playing ? <ActivityIndicator color={c.playerBg} /> : <Ionicons name={p.playing ? 'pause' : 'play'} size={34} color={c.playerBg} />}
            </Pressable>
            <Pressable onPress={() => step(1)} hitSlop={10} accessibilityLabel={t.nextSurah}>
              <Ionicons name="play-skip-forward" size={30} color="#fff" />
            </Pressable>
            <Pressable onPress={() => seekTo(p.currentTime + 10)} hitSlop={10} accessibilityLabel="+10 s">
              <Ionicons name="play-forward" size={26} color="#fff" />
            </Pressable>
          </Row>

          <View style={{ gap: 12, alignItems: 'center' }}>
            <View style={{ direction: 'ltr' }}>
              <Segmented options={RATES} value={rate} onChange={setRate} align="center" />
            </View>
            <Row gap={8} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              <Toggle icon="infinite" label={t.autoNext} on={autoNext} onPress={() => set({ autoNext: !autoNext })} />
              <Toggle icon="repeat" label={t.repeat} on={repeat} onPress={() => set({ repeat: !repeat })} />
            </Row>
            <Row gap={8} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button
                label={t.readAlong}
                kind="ghost"
                color="#fff"
                icon={<Ionicons name="book-outline" size={18} color="#fff" />}
                onPress={() => {
                  router.back();
                  router.push({ pathname: '/reader/[surah]', params: { surah: String(s.n) } });
                }}
                style={{ borderColor: 'rgba(255,255,255,0.25)' }}
              />
              <Button
                label={t.tafsir}
                kind="ghost"
                color="#fff"
                icon={<Ionicons name="library-outline" size={18} color="#fff" />}
                onPress={() => setTafsirOpen(true)}
                style={{ borderColor: 'rgba(255,255,255,0.25)' }}
              />
            </Row>
          </View>
        </View>
      )}
      {s && <SurahTafsirSheet n={s.n} open={tafsirOpen} onClose={() => setTafsirOpen(false)} />}
    </Screen>
  );
}

function Toggle({ icon, label, on, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; on: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 33, borderWidth: 1, borderColor: on ? c.accent : 'rgba(255,255,255,0.25)', backgroundColor: on ? 'rgba(198,164,92,0.2)' : 'transparent' }}>
      <Ionicons name={icon} size={16} color={on ? c.accent : '#fff'} />
      <Txt variant="label" color={on ? c.accent : '#fff'}>
        {label}
      </Txt>
    </Pressable>
  );
}
