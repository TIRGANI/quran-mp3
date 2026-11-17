import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { player as mainPlayer } from '@/audio/player';
import { Button, Card, ProgressBar, Row, Txt } from '@/components/ui';
import { SURAHS } from '@/data/surahs';
import { arNum, useIsRTL, useT } from '@/i18n';
import { getChapter } from '@/lib/adhkar';
import { basmala, surahVerses } from '@/lib/quran';
import { getRuqya, suggest, useRepeatCount, useRuqya, useRuqyaCount, type Answer, type RuqyaCategory } from '@/lib/ruqya';
import { useSettings } from '@/stores/settings';
import { FONTS, useColors } from '@/theme/colors';

type Stage = 'intro' | 'quiz' | 'result' | 'all';
const pad = (x: number) => String(x).padStart(3, '0');
const verseUrl = (s: number, a: number) => `https://everyayah.com/data/Alafasy_128kbps/${pad(s)}${pad(a)}.mp3`;

export default function RuqyaScreen() {
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  const lang = useSettings(s => s.lang);
  const data = getRuqya();
  const saved = useRuqya(s => s.answers);
  const [stage, setStage] = useState<Stage>('intro');
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [q, setQ] = useState(0);
  const audio = useVerseQueue();

  const answer = (a: Answer) => {
    const next = { ...answers, [data.questions[q].id]: a };
    setAnswers(next);
    if (q < data.questions.length - 1) return setQ(q + 1);
    useRuqya.getState().save(next);
    setStage('result');
  };

  const shown = stage === 'all' ? data.categories.map(x => x.id) : suggest(stage === 'result' ? { ...saved, ...answers } : {});
  const cats = shown.map(id => data.categories.find(x => x.id === id)!).filter(Boolean);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: c.hero }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, direction: rtl ? 'rtl' : 'ltr' }}>
          {stage === 'intro' ? (
            <View style={{ width: 40 }} />
          ) : (
            <Pressable onPress={() => setStage('intro')} hitSlop={10} accessibilityLabel={t.back} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={24} color="#fff" />
            </Pressable>
          )}
          <Text style={{ flex: 1, textAlign: 'center', fontFamily: FONTS.arabicBold, fontSize: 21, lineHeight: 36, color: '#fff' }}>الرقية الشرعية</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40, maxWidth: 820, width: '100%', alignSelf: 'center', direction: rtl ? 'rtl' : 'ltr' }}>
        {stage === 'intro' && (
          <>
            <View style={{ gap: 4 }}>
              <Txt variant="title" style={{ color: c.primary }}>
                {t.ruqyaTitle}
              </Txt>
              <Txt variant="small">{t.ruqyaSubtitle}</Txt>
            </View>
            <Card style={{ gap: 8, borderColor: c.accent, backgroundColor: c.accentSoft }}>
              <Row>
                <Ionicons name="information-circle" size={20} color={c.accentStrong} />
                <Txt weight="bold" style={{ flex: 1 }}>
                  {t.ruqyaWarning}
                </Txt>
              </Row>
              <Txt variant="label" weight="regular" style={{ lineHeight: 21 }}>
                {data.disclaimer[lang]}
              </Txt>
            </Card>
            <Button
              label={t.ruqyaStart}
              icon={<Ionicons name="help-circle" size={18} color="#fff" />}
              onPress={() => {
                setAnswers({});
                setQ(0);
                setStage('quiz');
              }}
            />
            {saved && <Button label={t.ruqyaLastResult} kind="ghost" onPress={() => setStage('result')} />}
            <Button label={t.ruqyaAll} kind="ghost" onPress={() => setStage('all')} />
            <Method />
          </>
        )}

        {stage === 'quiz' && (
          <View style={{ gap: 16 }}>
            <Txt variant="label" color={c.accentStrong}>
              {t.ruqyaQuestion(q + 1, data.questions.length)}
            </Txt>
            <ProgressBar value={q / data.questions.length} />
            <Card style={{ minHeight: 140, justifyContent: 'center' }}>
              <Txt style={{ fontSize: 19, lineHeight: 30, fontFamily: rtl ? FONTS.arabicBold : FONTS.uiBold }}>{data.questions[q].text[lang]}</Txt>
            </Card>
            {(
              [
                [0, t.ruqyaNo],
                [1, t.ruqyaSometimes],
                [2, t.ruqyaOften],
              ] as [Answer, string][]
            ).map(([v, label]) => (
              <Pressable
                key={v}
                onPress={() => answer(v)}
                accessibilityRole="button"
                style={({ pressed }) => ({ padding: 16, borderRadius: 16, borderWidth: 2, borderColor: answers[data.questions[q].id] === v ? c.accent : c.line, backgroundColor: pressed ? c.accentSoft : c.surface })}>
                <Txt weight="bold" style={{ textAlign: 'center', fontSize: 17 }}>
                  {label}
                </Txt>
              </Pressable>
            ))}
            {q > 0 && <Button label={t.previousQuestion} kind="ghost" onPress={() => setQ(q - 1)} />}
          </View>
        )}

        {(stage === 'result' || stage === 'all') && (
          <>
            {stage === 'result' && (
              <View style={{ gap: 4 }}>
                <Txt variant="title" style={{ color: c.primary }}>
                  {t.ruqyaResults}
                </Txt>
                <Txt variant="small">{t.ruqyaResultsNote}</Txt>
                {cats.length === 1 && (
                  <Card style={{ marginTop: 8, backgroundColor: c.accentSoft, borderColor: c.accent }}>
                    <Txt variant="label" weight="regular">
                      {t.ruqyaNothing}
                    </Txt>
                  </Card>
                )}
              </View>
            )}
            <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12 }}>
              <Ionicons name="repeat" size={20} color={c.accentStrong} />
              <Txt variant="small" style={{ flex: 1, lineHeight: 19 }}>
                {data.repeatNote[lang]}
              </Txt>
            </Card>
            {cats.map((cat, i) => (
              <Section key={cat.id} cat={cat} open={i < 2} audio={audio} />
            ))}
            <Method />
            <Card style={{ gap: 6 }}>
              <Txt variant="small" style={{ lineHeight: 19 }}>
                {data.disclaimer[lang]}
              </Txt>
            </Card>
            {stage === 'result' && (
              <Button
                label={t.ruqyaRestart}
                kind="ghost"
                onPress={() => {
                  setAnswers({});
                  setQ(0);
                  setStage('quiz');
                }}
              />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Method() {
  const t = useT();
  const c = useColors();
  const lang = useSettings(s => s.lang);
  return (
    <Card style={{ gap: 8 }}>
      <Txt variant="label" color={c.accentStrong}>
        {t.ruqyaMethod}
      </Txt>
      {getRuqya().method[lang].map((line, i) => (
        <Row key={i} style={{ alignItems: 'flex-start' }}>
          <Txt weight="bold" color={c.accentStrong}>
            {lang === 'ar' ? arNum(i + 1) : `${i + 1}.`}
          </Txt>
          <Txt variant="label" weight="regular" style={{ flex: 1, lineHeight: 21 }}>
            {line}
          </Txt>
        </Row>
      ))}
    </Card>
  );
}

type Queue = ReturnType<typeof useVerseQueue>;

const haptic = (style: Haptics.ImpactFeedbackStyle) => {
  if (Platform.OS !== 'web') Haptics.impactAsync(style).catch(() => {});
};

/** Compteur de répétitions d'un passage : barre d'avancement, « n / N » à toucher, annulation. */
function RepeatCounter({ id, repeat }: { id: string; repeat: number }) {
  const c = useColors();
  const t = useT();
  const count = useRepeatCount(id);
  const add = useRuqyaCount(s => s.add);
  const undo = useRuqyaCount(s => s.undo);
  const done = count >= repeat;
  const onCount = () => {
    if (done) return;
    add(id, repeat);
    haptic(count + 1 >= repeat ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
  };
  return (
    <View style={{ gap: 8 }}>
      {repeat > 1 && <ProgressBar value={count / repeat} height={4} color={done ? c.success : c.accent} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {count > 0 && (
          <Pressable
            onPress={() => {
              undo(id);
              haptic(Haptics.ImpactFeedbackStyle.Light);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t.undo}
            style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-undo" size={17} color={c.muted} />
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        {!done && repeat > 1 && <Txt variant="small">{t.times(repeat)}</Txt>}
        <Pressable
          onPress={onCount}
          accessibilityRole="button"
          accessibilityLabel={`${t.tapToCount} ${count}/${repeat}`}
          style={({ pressed }) => ({ minWidth: 72, height: 42, paddingHorizontal: 14, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: done ? c.success : c.accentStrong, transform: [{ scale: pressed && !done ? 0.94 : 1 }] })}>
          {done ? (
            <>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Txt weight="bold" color="#fff">
                {t.dhikrDone}
              </Txt>
            </>
          ) : (
            <Txt weight="bold" color="#fff" style={{ fontSize: 16, writingDirection: 'ltr', direction: 'ltr' }}>
              {repeat > 1 ? `${count} / ${repeat}` : '✓'}
            </Txt>
          )}
        </Pressable>
      </View>
    </View>
  );
}

/** Une catégorie : versets (avec écoute), invocations, chapitres de Hisn al-Muslim. */
function Section({ cat, open: initialOpen, audio }: { cat: RuqyaCategory; open: boolean; audio: Queue }) {
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  const lang = useSettings(s => s.lang);
  const [open, setOpen] = useState(initialOpen);
  const items = cat.verses.flatMap(([s, a, b]) => Array.from({ length: b - a + 1 }, (_, i) => ({ s, a: a + i })));
  const playing = audio.key === cat.id;

  return (
    <Card style={{ gap: 12, padding: 0, overflow: 'hidden' }}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={cat.icon as keyof typeof Ionicons.glyphMap} size={22} color={c.accentStrong} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight="bold">{cat.title[lang]}</Txt>
          <Txt variant="small">{cat.desc[lang]}</Txt>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={c.muted} />
      </Pressable>

      {open && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
          {items.length > 0 && (
            <>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="label" color={c.accentStrong}>
                  {t.ruqyaVerses}
                </Txt>
                <Button
                  label={playing ? t.ruqyaStop : t.ruqyaListenAll}
                  kind="ghost"
                  icon={<Ionicons name={playing ? 'stop' : 'play'} size={16} color={c.text} />}
                  onPress={() => (playing ? audio.stop() : audio.play(cat.id, items))}
                  style={{ paddingVertical: 7 }}
                />
              </Row>
              {cat.verses.map(([s, a, b, repeat]) => {
                const { verses } = surahVerses(s);
                const range = Array.from({ length: b - a + 1 }, (_, i) => a + i);
                return (
                  <View key={`${s}:${a}`} style={{ gap: 6, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 10 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Txt variant="small" weight="bold">{`${rtl ? `سورة ${SURAHS[s - 1].ar}` : SURAHS[s - 1].tr} ${a === b ? a : `${a}–${b}`}`}</Txt>
                      <Pressable onPress={() => router.push({ pathname: '/reader/[surah]', params: { surah: String(s), ayah: String(a) } })} hitSlop={8}>
                        <Txt variant="small" color={c.accentStrong}>
                          {t.ruqyaOpen}
                        </Txt>
                      </Pressable>
                    </Row>
                    {a === 1 && s !== 1 && s !== 9 && <Text style={{ fontFamily: FONTS.arabic, fontSize: 20, lineHeight: 38, color: c.primary, textAlign: 'center' }}>{basmala()}</Text>}
                    <Text style={{ fontFamily: FONTS.arabic, fontSize: 23, lineHeight: 46, color: c.text, writingDirection: 'rtl', textAlign: 'right' }}>
                      {range.map(v => {
                        const cur = playing && audio.current?.s === s && audio.current?.a === v;
                        return (
                          <Text key={v} style={cur ? { backgroundColor: c.following } : undefined}>
                            {verses[v - 1]}
                            <Text style={{ color: c.accentStrong }}>{` ۝${arNum(v)} `}</Text>
                          </Text>
                        );
                      })}
                    </Text>
                    <RepeatCounter id={`${cat.id}:${s}:${a}`} repeat={repeat} />
                  </View>
                );
              })}
            </>
          )}
          <Card style={{ backgroundColor: c.accentSoft, borderColor: c.accent, padding: 12 }}>
            <Txt variant="label" weight="regular" style={{ lineHeight: 21 }}>
              {cat.note[lang]}
            </Txt>
          </Card>
          {cat.duas.length > 0 && (
            <View style={{ gap: 8 }}>
              <Txt variant="label" color={c.accentStrong}>
                {t.ruqyaDuas}
              </Txt>
              {cat.duas.map((d, i) => (
                <View key={i} style={{ gap: 4 }}>
                  <Text style={{ fontFamily: FONTS.arabic, fontSize: 21, lineHeight: 40, color: c.text, writingDirection: 'rtl', textAlign: 'right' }}>{d.text}</Text>
                  <Txt variant="small">{d.source[lang]}</Txt>
                  <RepeatCounter id={`${cat.id}:d${i}`} repeat={d.repeat} />
                </View>
              ))}
            </View>
          )}
          {cat.hisn.length > 0 && (
            <View style={{ gap: 8 }}>
              <Txt variant="label" color={c.accentStrong}>
                {t.ruqyaHisn}
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {cat.hisn.map(id => (
                  <Pressable
                    key={id}
                    onPress={() => router.push({ pathname: '/adhkar/[id]', params: { id: String(id) } })}
                    accessibilityRole="link"
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 33, borderWidth: 1, borderColor: c.line, backgroundColor: c.background }}>
                    <Text style={{ fontFamily: FONTS.arabic, fontSize: 16, lineHeight: 26, color: c.text }}>{getChapter(id)?.title}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

/** Lecture enchaînée de versets (everyayah.com, Al-Afasy), indépendante du lecteur de sourates. */
function useVerseQueue() {
  const player = useAudioPlayer(null);
  const [state, setState] = useState<{ key: string | null; items: { s: number; a: number }[]; idx: number }>({ key: null, items: [], idx: 0 });
  const queue = useRef(state);
  useEffect(() => {
    queue.current = state;
  }, [state]);

  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', st => {
      if (!st.didJustFinish || !queue.current.key) return;
      const { items, idx } = queue.current;
      if (idx + 1 >= items.length) return setState({ key: null, items: [], idx: 0 });
      const next = items[idx + 1];
      player.replace({ uri: verseUrl(next.s, next.a) });
      player.play();
      setState(s => ({ ...s, idx: s.idx + 1 }));
    });
    return () => sub.remove();
  }, [player]);

  return {
    key: state.key,
    current: state.key ? state.items[state.idx] : null,
    play: (key: string, items: { s: number; a: number }[]) => {
      if (!items.length) return;
      if (mainPlayer.playing) mainPlayer.pause();
      player.replace({ uri: verseUrl(items[0].s, items[0].a) });
      player.play();
      setState({ key, items, idx: 0 });
    },
    stop: () => {
      player.pause();
      setState({ key: null, items: [], idx: 0 });
    },
  };
}
