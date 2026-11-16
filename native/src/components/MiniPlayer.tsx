import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useHifdh } from '@/audio/hifdh';
import { step, togglePlay, usePlayer } from '@/audio/player';
import { Txt } from '@/components/ui';
import { SURAHS } from '@/data/surahs';
import { useIsRTL, useT } from '@/i18n';
import { getReciter } from '@/stores/settings';
import { FONTS, useColors } from '@/theme/colors';

/** Lecteur compact, au-dessus de la barre d'onglets ; un toucher ouvre le lecteur complet. */
export function MiniPlayer() {
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  const surah = usePlayer(s => s.surah);
  const reciterId = usePlayer(s => s.reciterId);
  const playing = usePlayer(s => s.playing);
  const buffering = usePlayer(s => s.buffering);
  const progress = usePlayer(s => (s.duration ? s.currentTime / s.duration : 0));
  const hifdhMode = usePlayer(s => s.mode === 'hifdh');
  const hifdhAyah = useHifdh(s => s.ayah);
  const hifdhRep = useHifdh(s => `${s.rep}/${s.reps}`);
  if (!surah) return null;
  const s = SURAHS[surah - 1];
  const r = getReciter(reciterId ?? '');
  const subtitle = hifdhMode ? `${t.hifdhTitle} · ${hifdhAyah ? t.verseN(hifdhAyah) : t.hifdhBasmala} · ${hifdhRep}` : rtl ? r.ar : r.fr;

  return (
    <Pressable onPress={() => router.push(hifdhMode ? '/hifdh' : '/player')} accessibilityLabel={t.nowPlaying} style={{ backgroundColor: c.playerBg, direction: rtl ? 'rtl' : 'ltr' }}>
      <View style={{ height: 2, backgroundColor: 'rgba(255,255,255,0.12)' }}>
        <View style={{ width: `${progress * 100}%`, height: 2, backgroundColor: c.accent }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Txt numberOfLines={1} weight="bold" color="#fff" style={{ fontFamily: rtl ? FONTS.arabicBold : FONTS.uiBold, fontSize: rtl ? 18 : 15 }}>
            {rtl ? `سورة ${s.ar}` : `${s.n}. ${s.tr}`}
          </Txt>
          <Txt numberOfLines={1} variant="small" color="rgba(255,255,255,0.7)">
            {subtitle}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, direction: 'ltr' }}>
        <Pressable onPress={() => step(-1)} hitSlop={10} accessibilityLabel={t.prevSurah} style={{ padding: 6 }}>
          <Ionicons name="play-skip-back" size={20} color="#fff" />
        </Pressable>
        <Pressable onPress={togglePlay} hitSlop={10} accessibilityLabel={playing ? t.pause : t.listen} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          {buffering && !playing ? <ActivityIndicator color={c.playerBg} /> : <Ionicons name={playing ? 'pause' : 'play'} size={20} color={c.playerBg} />}
        </Pressable>
        <Pressable onPress={() => step(1)} hitSlop={10} accessibilityLabel={t.nextSurah} style={{ padding: 6 }}>
          <Ionicons name="play-skip-forward" size={20} color="#fff" />
        </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
