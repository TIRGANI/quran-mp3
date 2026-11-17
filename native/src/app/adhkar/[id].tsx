import { Ionicons } from '@expo/vector-icons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { player as mainPlayer } from '@/audio/player';
import { Button, ProgressBar, Txt } from '@/components/ui';
import { arNum, useIsRTL, useT } from '@/i18n';
import { chapterProgress, getChapter, useAdhkar, useCount, type Dhikr } from '@/lib/adhkar';
import { toast } from '@/lib/toast';
import { FONTS, useColors } from '@/theme/colors';

const haptic = (style: Haptics.ImpactFeedbackStyle) => {
  if (Platform.OS !== 'web') Haptics.impactAsync(style).catch(() => {});
};

export default function AdhkarChapterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ch = getChapter(Number(id));
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  const counts = useAdhkar(s => s.counts);
  const day = useAdhkar(s => s.day);
  const resetChapter = useAdhkar(s => s.resetChapter);
  const listRef = useRef<FlashListRef<Dhikr>>(null);
  // Lecteur audio propre aux adhkar (courts extraits), indépendant du lecteur de sourates
  const audio = useAudioPlayer(null);
  const status = useAudioPlayerStatus(audio);
  const [playingId, setPlayingId] = useState<number | null>(null);

  if (!ch) return null;
  const p = chapterProgress(ch, counts, day);
  const complete = p.done === p.total;

  const play = (d: Dhikr) => {
    if (playingId === d.id && status.playing) return audio.pause();
    if (mainPlayer.playing) mainPlayer.pause();
    audio.replace({ uri: d.audio });
    audio.play();
    setPlayingId(d.id);
  };

  // Dhikr terminé : on fait défiler jusqu'au suivant pas encore fait (la main reste au même endroit)
  const goToNext = (from: number) => {
    const next = ch.items.findIndex((d, i) => i > from && (useAdhkar.getState().counts[d.id] ?? 0) < d.repeat);
    const target = next >= 0 ? next : ch.items.findIndex(d => (useAdhkar.getState().counts[d.id] ?? 0) < d.repeat);
    if (target >= 0) setTimeout(() => listRef.current?.scrollToIndex({ index: target, animated: true, viewPosition: 0.05 }), 350);
    else toast(t.allDone);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: c.hero }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingTop: 8, direction: rtl ? 'rtl' : 'ltr' }}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t.close} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={24} color="#fff" />
          </Pressable>
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: FONTS.arabicBold, fontSize: 20, lineHeight: 34, color: '#fff', textAlign: 'center' }}>
            {ch.title}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        {/* Avancement de la section : adhkar terminés, répétitions, reprendre au bon endroit */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, gap: 8, direction: rtl ? 'rtl' : 'ltr' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="label" color={complete ? '#8fd3ae' : c.accent}>
                {complete ? `✓ ${t.allDone}` : t.adhkarDoneCount(p.done, p.total)}
              </Txt>
              <Txt variant="small" color="rgba(255,255,255,0.7)">{`${t.repetitions} : ${p.reps} / ${p.totalReps}`}</Txt>
            </View>
            {!complete && p.reps > 0 && (
              <Pressable
                onPress={() => listRef.current?.scrollToIndex({ index: p.nextIndex, animated: true, viewPosition: 0.05 })}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 33, borderWidth: 1, borderColor: c.accent }}>
                <Ionicons name="arrow-down" size={14} color={c.accent} />
                <Txt variant="label" color={c.accent}>
                  {t.resume}
                </Txt>
              </Pressable>
            )}
          </View>
          <ProgressBar value={p.totalReps ? p.reps / p.totalReps : 0} height={6} color={complete ? c.success : c.accent} style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
        </View>
      </SafeAreaView>

      <FlashList
        ref={listRef}
        data={ch.items}
        keyExtractor={d => String(d.id)}
        extraData={[counts, playingId, status.playing]}
        contentContainerStyle={{ padding: 14, paddingBottom: 60 }}
        ListFooterComponent={
          <View style={{ alignItems: 'center', gap: 10, paddingTop: 10 }}>
            {complete && (
              <Txt color={c.success} weight="bold">
                {t.allDone}
              </Txt>
            )}
            <Button label={t.reset} kind="ghost" icon={<Ionicons name="refresh" size={16} color={c.text} />} onPress={() => resetChapter(ch)} />
          </View>
        }
        renderItem={({ item: d, index }) => (
          <DhikrCard d={d} index={index} playing={playingId === d.id && status.playing} onPlay={() => play(d)} onComplete={() => goToNext(index)} />
        )}
      />
    </View>
  );
}

function DhikrCard({ d, index, playing, onPlay, onComplete }: { d: Dhikr; index: number; playing: boolean; onPlay: () => void; onComplete: () => void }) {
  const c = useColors();
  const t = useT();
  const count = useCount(d.id);
  const increment = useAdhkar(s => s.increment);
  const decrement = useAdhkar(s => s.decrement);
  const done = count >= d.repeat;

  const onCount = () => {
    if (done) return;
    increment(d);
    const finished = count + 1 >= d.repeat;
    haptic(finished ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
    if (finished) onComplete();
  };
  const onUndo = () => {
    if (!count) return;
    decrement(d);
    haptic(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={{ marginBottom: 12, backgroundColor: c.surface, borderRadius: 18, borderWidth: done ? 2 : 1, borderColor: done ? c.success : c.line, overflow: 'hidden' }}>
      {/* Toucher le texte compte aussi : la main reste sur le texte pendant la récitation */}
      <Pressable onPress={onCount} accessibilityRole="button" accessibilityLabel={`${t.tapToCount} ${count}/${d.repeat}`} style={({ pressed }) => ({ padding: 16, opacity: done ? 0.6 : pressed ? 0.85 : 1 })}>
        <Text style={{ fontFamily: FONTS.arabic, fontSize: 21, lineHeight: 40, color: c.text, writingDirection: 'rtl', textAlign: 'right' }}>{d.text}</Text>
      </Pressable>
      {/* Avancement de ce dhikr */}
      {d.repeat > 1 && <ProgressBar value={count / d.repeat} height={4} color={done ? c.success : c.accent} style={{ borderRadius: 0 }} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: d.repeat > 1 ? 0 : 1, borderTopColor: c.line, backgroundColor: c.background }}>
        <Txt variant="small" style={{ minWidth: 22 }}>
          {arNum(index + 1)}
        </Txt>
        <Pressable onPress={onPlay} hitSlop={8} accessibilityLabel={t.playAudio} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={playing ? 'pause' : 'volume-high'} size={17} color={c.accentStrong} />
        </Pressable>
        {count > 0 && (
          <Pressable onPress={onUndo} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.undo} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-undo" size={17} color={c.muted} />
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        {d.repeat > 1 && !done && <Txt variant="small">{t.times(d.repeat)}</Txt>}
        <Pressable
          onPress={onCount}
          accessibilityRole="button"
          accessibilityLabel={`${t.tapToCount} ${count}/${d.repeat}`}
          style={({ pressed }) => ({ minWidth: 72, height: 46, paddingHorizontal: 14, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: done ? c.success : c.accentStrong, transform: [{ scale: pressed && !done ? 0.94 : 1 }] })}>
          {done ? (
            <>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Txt weight="bold" color="#fff">
                {t.dhikrDone}
              </Txt>
            </>
          ) : (
            <Txt weight="bold" color="#fff" style={{ fontSize: 17, writingDirection: 'ltr', direction: 'ltr' }}>
              {d.repeat > 1 ? `${count} / ${d.repeat}` : '✓'}
            </Txt>
          )}
        </Pressable>
      </View>
    </View>
  );
}
