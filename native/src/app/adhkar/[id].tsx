import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { player as mainPlayer } from '@/audio/player';
import { Button, ProgressBar, Txt } from '@/components/ui';
import { arNum, useIsRTL, useT } from '@/i18n';
import { chapterProgress, getChapter, useAdhkar, useCount, type Dhikr } from '@/lib/adhkar';
import { toast } from '@/lib/toast';
import { FONTS, useColors } from '@/theme/colors';

export default function AdhkarChapterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ch = getChapter(Number(id));
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  const counts = useAdhkar(s => s.counts);
  const day = useAdhkar(s => s.day);
  const resetChapter = useAdhkar(s => s.resetChapter);
  // Lecteur audio propre aux adhkar (courts extraits), indépendant du lecteur de sourates
  const audio = useAudioPlayer(null);
  const status = useAudioPlayerStatus(audio);
  const [playingId, setPlayingId] = useState<number | null>(null);

  if (!ch) return null;
  const p = chapterProgress(ch, counts, day);

  const play = (d: Dhikr) => {
    if (playingId === d.id && status.playing) {
      audio.pause();
      return;
    }
    if (mainPlayer.playing) mainPlayer.pause();
    audio.replace({ uri: d.audio });
    audio.play();
    setPlayingId(d.id);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: c.primaryDark }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 8, direction: rtl ? 'rtl' : 'ltr' }}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t.close} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={24} color="#fff" />
          </Pressable>
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: FONTS.arabicBold, fontSize: 20, lineHeight: 34, color: '#fff', textAlign: 'center' }}>
            {ch.title}
          </Text>
          <Txt variant="label" color={c.accent} style={{ minWidth: 40, textAlign: 'center' }}>{`${p.done}/${p.total}`}</Txt>
        </View>
        <ProgressBar value={p.done / p.total} height={3} style={{ borderRadius: 0 }} color={p.done === p.total ? c.success : c.accent} />
      </SafeAreaView>

      <FlashList
        data={ch.items}
        keyExtractor={d => String(d.id)}
        extraData={[counts, playingId, status.playing]}
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        ListFooterComponent={
          <View style={{ alignItems: 'center', gap: 10, paddingTop: 10 }}>
            {p.done === p.total && <Txt color={c.success} weight="bold">{t.allDone}</Txt>}
            <Button label={t.reset} kind="ghost" icon={<Ionicons name="refresh" size={16} color={c.text} />} onPress={() => resetChapter(ch)} />
          </View>
        }
        renderItem={({ item: d, index }) => (
          <DhikrCard d={d} index={index} playing={playingId === d.id && status.playing} onPlay={() => play(d)} />
        )}
      />
    </View>
  );
}

function DhikrCard({ d, index, playing, onPlay }: { d: Dhikr; index: number; playing: boolean; onPlay: () => void }) {
  const c = useColors();
  const t = useT();
  const count = useCount(d.id);
  const increment = useAdhkar(s => s.increment);
  const done = count >= d.repeat;

  const onCount = () => {
    if (done) return;
    increment(d);
    if (Platform.OS !== 'web') Haptics.impactAsync(count + 1 >= d.repeat ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (count + 1 >= d.repeat && d.repeat > 1) toast('✓');
  };

  return (
    <View style={{ marginBottom: 12, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: done ? c.success : c.line, overflow: 'hidden', opacity: done ? 0.7 : 1 }}>
      {/* Toucher le texte compte aussi : la main reste sur le texte pendant la récitation */}
      <Pressable onPress={onCount} accessibilityRole="button" accessibilityLabel={t.tapToCount} style={{ padding: 16 }}>
        <Text style={{ fontFamily: FONTS.arabic, fontSize: 21, lineHeight: 40, color: c.text, writingDirection: 'rtl', textAlign: 'right' }}>{d.text}</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.background }}>
        <Txt variant="small" style={{ minWidth: 24 }}>
          {arNum(index + 1)}
        </Txt>
        <Pressable onPress={onPlay} hitSlop={8} accessibilityLabel={t.playAudio} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={playing ? 'pause' : 'volume-high'} size={17} color={c.accentStrong} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {d.repeat > 1 && <Txt variant="small">{t.times(d.repeat)}</Txt>}
        <Pressable
          onPress={onCount}
          accessibilityRole="button"
          accessibilityLabel={`${t.tapToCount} ${count}/${d.repeat}`}
          style={({ pressed }) => ({ minWidth: 64, height: 44, paddingHorizontal: 14, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? c.success : c.accentStrong, opacity: pressed ? 0.8 : 1 })}>
          {done ? <Ionicons name="checkmark" size={22} color="#fff" /> : <Txt weight="bold" color="#fff">{d.repeat > 1 ? `${count}/${d.repeat}` : '✓'}</Txt>}
        </Pressable>
      </View>
    </View>
  );
}
