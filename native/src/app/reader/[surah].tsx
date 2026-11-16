import { Ionicons } from '@expo/vector-icons';
import { FlashList, type FlashListRef, type ViewToken } from '@shopify/flash-list';
import * as Clipboard from 'expo-clipboard';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { playSurah, seekTo, player, togglePlay, usePlayer } from '@/audio/player';
import { TafsirSheet } from '@/components/TafsirSheet';
import { Button, ProgressBar, Row, Segmented, SettingRow, Txt } from '@/components/ui';
import { SURAHS } from '@/data/surahs';
import { arNum, useIsRTL, useT } from '@/i18n';
import { basmala, loadExtra, loadTimings, stripTashkeel, surahVerses, verseStartRatios } from '@/lib/quran';
import { toast } from '@/lib/toast';
import { useAsync } from '@/lib/use-async';
import { READER_SIZES, readCount, TOTAL_AYAT, totalRead, useReading, type ReaderPrefs } from '@/stores/reading';
import { useSettings } from '@/stores/settings';
import { FONTS, PALETTES, useColors, type Colors } from '@/theme/colors';

type Item = { type: 'head' } | { type: 'verses'; from: number; to: number } | { type: 'foot' };
const SCROLL_SPEEDS = [0, 10, 17, 26, 38, 55]; // px/s pour une taille de texte de 29

/** Découpe la sourate en blocs pour une liste virtualisée (fluide même pour Al-Baqara). */
function buildItems(verses: string[], verseMode: boolean): Item[] {
  const items: Item[] = [{ type: 'head' }];
  if (verseMode) verses.forEach((_, i) => items.push({ type: 'verses', from: i + 1, to: i + 1 }));
  else {
    let from = 1;
    let chars = 0;
    verses.forEach((v, i) => {
      chars += v.length;
      if (chars >= 420 || i === verses.length - 1) {
        items.push({ type: 'verses', from, to: i + 1 });
        from = i + 2;
        chars = 0;
      }
    });
  }
  items.push({ type: 'foot' });
  return items;
}

function useReaderColors(theme: ReaderPrefs['theme']): Colors {
  const app = useColors();
  return theme === 'app' ? app : PALETTES[theme === 'night' ? 'dark' : theme];
}

export default function ReaderScreen() {
  const params = useLocalSearchParams<{ surah: string; ayah?: string }>();
  const [n, setN] = useState(() => Math.min(114, Math.max(1, Number(params.surah) || 1)));
  const [target, setTarget] = useState<number | undefined>(() => (Number(params.ayah) > 1 ? Number(params.ayah) : undefined));
  const goTo = useCallback((s: number, a?: number) => {
    setTarget(a);
    setN(s);
  }, []);
  // Une clé par sourate : tout l'état de la page repart à zéro quand on change de sourate.
  return <SurahPage key={n} n={n} target={target} goTo={goTo} />;
}

function SurahPage({ n, target, goTo }: { n: number; target?: number; goTo: (s: number, a?: number) => void }) {
  const t = useT();
  const rtl = useIsRTL();
  const prefs = useReading(s => s.prefs);
  const setPrefs = useReading(s => s.setPrefs);
  const c = useReaderColors(prefs.theme);
  const s = SURAHS[n - 1];
  const show = prefs.tashkeel ? (x: string) => x : stripTashkeel;
  const verseMode = prefs.layout === 'verse' || prefs.extra !== 'none';
  const { verses, hasBasmala } = useMemo(() => surahVerses(n), [n]);
  const items = useMemo(() => buildItems(verses, verseMode), [verses, verseMode]);
  const fontSize = READER_SIZES[prefs.size];
  const listRef = useRef<FlashListRef<Item>>(null);

  const bookmarks = useReading(st => st.bookmarks);
  const bmSet = useMemo(() => new Set(bookmarks.filter(b => b.n === n).map(b => b.a)), [bookmarks, n]);
  const [sel, setSel] = useState<number | null>(target ?? null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [tafsirFor, setTafsirFor] = useState<number | null>(null);
  const [speed, setSpeed] = useState(0);

  const itemIndexOf = useCallback((a: number) => Math.max(0, items.findIndex(it => it.type === 'verses' && a >= it.from && a <= it.to)), [items]);

  /* --- Progression : versets dépassés en lisant, fin de sourate atteinte --- */
  const sessionFrom = useRef(target ?? 1);
  const interactedAt = useRef(0); // dernier défilement fait par l'utilisateur, l'auto-défilement ou le suivi
  const manualAt = useRef(0); // dernier défilement fait à la main
  const endTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const markRange = useReading(st => st.markRange);
  const setLastPos = useReading(st => st.setLastPos);

  const mark = useCallback(
    (from: number, to: number) => {
      const before = totalRead(useReading.getState().read);
      if (markRange(n, from, to) && before < TOTAL_AYAT && totalRead(useReading.getState().read) === TOTAL_AYAT) toast(t.khatmaDone);
    },
    [markRange, n, t],
  );

  // Le gestionnaire de visibilité change à chaque rendu ; la liste appelle toujours le dernier.
  const onViewable = useRef<(info: { viewableItems: ViewToken<Item>[] }) => void>(() => {});
  const handleViewable = ({ viewableItems }: { viewableItems: ViewToken<Item>[] }) => {
    const visible = viewableItems.map(v => v.item).filter(Boolean);
    const firstVerses = visible.find(it => it.type === 'verses') as Extract<Item, { type: 'verses' }> | undefined;
    if (firstVerses) setLastPos(n, firstVerses.from);
    const recent = Date.now() - interactedAt.current < 2500;
    if (recent && firstVerses && firstVerses.from > sessionFrom.current) mark(sessionFrom.current, firstVerses.from - 1);
    // Fin de la sourate à l'écran : comptée comme lue après un temps de lecture raisonnable
    clearTimeout(endTimer.current);
    if (visible.some(it => it.type === 'foot')) {
      const from = firstVerses ? Math.max(firstVerses.from, sessionFrom.current) : sessionFrom.current;
      const delay = Math.min(60, 3 + 1.5 * (s.verses - from + 1)) * 1000;
      endTimer.current = setTimeout(() => mark(sessionFrom.current, s.verses), delay);
    }
  };
  useLayoutEffect(() => {
    onViewable.current = handleViewable;
  });
  useEffect(() => () => clearTimeout(endTimer.current), []);

  const goNext = () => {
    if (n >= 114) return;
    clearTimeout(endTimer.current);
    goTo(n + 1);
  };

  /* --- Traduction / tafsir sous chaque verset --- */
  const extraKind = prefs.extra;
  const extraRes = useAsync(extraKind === 'none' ? null : `${n}:${extraKind}`, () => loadExtra(n, extraKind as 'fr' | 'tafsir'));
  const extra = extraRes.status === 'ok' ? extraRes.value : extraRes.status;

  /* --- Suivi de la récitation --- */
  const pSurah = usePlayer(st => st.surah);
  const pReciter = usePlayer(st => st.reciterId);
  const playing = usePlayer(st => st.playing);
  const time = usePlayer(st => st.currentTime);
  const duration = usePlayer(st => st.duration);
  const listening = pSurah === n;
  const settingsReciter = useSettings(st => st.reciterId);
  const followTimings = useAsync(pReciter ? `${pReciter}:${n}` : null, () => loadTimings(pReciter!, n));
  const timings = followTimings.status === 'ok' ? followTimings.value : null;
  // Verset en cours de récitation : horaires exacts si disponibles, sinon estimation proportionnelle
  const cur = useMemo(() => {
    if (!prefs.follow || !listening) return null;
    let a = -1;
    if (timings) {
      const ms = time * 1000;
      for (const x of timings) {
        if (ms >= x.from) a = x.a;
        else break;
      }
    } else if (duration > 0) {
      const frac = time / duration;
      verseStartRatios(n).forEach((r, i) => {
        if (frac >= r) a = i + 1;
      });
    }
    return a > 0 ? a : null;
  }, [prefs.follow, listening, timings, time, duration, n]);
  // Garder le verset récité à l'écran, sauf si l'utilisateur vient de faire défiler lui-même
  const lastFollowed = useRef<number | null>(null);
  useEffect(() => {
    if (!cur || !playing || cur === lastFollowed.current) return;
    lastFollowed.current = cur;
    if (Date.now() - manualAt.current > 4000) {
      interactedAt.current = Date.now();
      listRef.current?.scrollToIndex({ index: itemIndexOf(cur), animated: true, viewPosition: 0.25 });
    }
  }, [cur, playing, itemIndexOf]);

  /* --- Défilement automatique --- */
  const offset = useRef(0);
  useEffect(() => {
    if (!speed) return;
    const px = (SCROLL_SPEEDS[speed] * fontSize) / 29 / 20;
    const id = setInterval(() => {
      if (Date.now() - manualAt.current < 1500) return; // doigt sur l'écran : on attend
      offset.current += px;
      interactedAt.current = Date.now();
      listRef.current?.scrollToOffset({ offset: offset.current, animated: false });
    }, 50);
    return () => clearInterval(id);
  }, [speed, fontSize]);

  /* --- Écran toujours allumé --- */
  useEffect(() => {
    if (!prefs.keepAwake) return;
    activateKeepAwakeAsync('reader').catch(() => {});
    return () => {
      deactivateKeepAwake('reader').catch(() => {});
    };
  }, [prefs.keepAwake]);

  /* --- Actions sur le verset touché --- */
  const toggleBookmark = useReading(st => st.toggleBookmark);
  // « Écouter d'ici » : seulement si l'on connaît le début exact du verset pour le récitateur choisi
  const ownTimings = useAsync(`${settingsReciter}:${n}`, () => loadTimings(settingsReciter, n));
  const selTiming = sel && ownTimings.status === 'ok' ? ownTimings.value?.find(x => x.a === sel) : undefined;
  const listenFrom = () => {
    if (!selTiming) return;
    if (listening && pReciter === settingsReciter) {
      seekTo(selTiming.from / 1000);
      if (!player.playing) player.play();
    } else playSurah(n, { startAt: selTiming.from / 1000 });
    setSel(null);
  };

  const lineHeight = fontSize * (prefs.spacing === 'airy' ? 2.5 : 2.05);
  const arStyle: TextStyle = { fontFamily: FONTS.arabic, fontSize, lineHeight, color: c.text, writingDirection: 'rtl', textAlign: verseMode ? 'right' : 'justify' };

  const renderVerse = (a: number) => {
    const bg = a === sel ? c.highlight : a === cur ? c.following : undefined;
    return (
      <Text key={a} onPress={() => setSel(x => (x === a ? null : a))} style={bg ? { backgroundColor: bg } : undefined} suppressHighlighting>
        {show(verses[a - 1])}
        <Text style={{ color: bmSet.has(a) ? c.danger : c.accentStrong, fontFamily: FONTS.arabic }}>{` ۝${arNum(a)} `}</Text>
      </Text>
    );
  };

  const renderItem = ({ item }: { item: Item }) => {
    if (item.type === 'head') {
      return (
        <View style={{ paddingTop: 18, gap: 10 }}>
          <View style={{ alignItems: 'center', borderWidth: 2, borderColor: c.accent, borderRadius: 14, paddingVertical: 8, backgroundColor: c.accentSoft }}>
            <Text style={{ fontFamily: FONTS.arabicBold, fontSize: 30, lineHeight: 52, color: c.primary }}>سورة {s.ar}</Text>
            <Txt variant="small" color={c.muted}>{`${s.tr} · ${s.medinan ? 'مدنية' : 'مكية'} · ${arNum(s.verses)} آية`}</Txt>
          </View>
          {hasBasmala && <Text style={[arStyle, { textAlign: 'center', color: c.primary }]}>{show(basmala())}</Text>}
        </View>
      );
    }
    if (item.type === 'foot') {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 30 }}>
          {n < 114 && <Button label={t.nextSurahNamed(SURAHS[n].tr)} kind="ghost" onPress={goNext} />}
        </View>
      );
    }
    if (verseMode) {
      const a = item.from;
      const ex = Array.isArray(extra) ? extra[a - 1] : null;
      return (
        <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line }}>
          <Text style={arStyle}>{renderVerse(a)}</Text>
          {ex ? (
            <Text style={{ fontFamily: FONTS.ui, fontSize: Math.max(14, fontSize * 0.52), lineHeight: Math.max(14, fontSize * 0.52) * 1.7, color: c.muted, textAlign: prefs.extra === 'fr' ? 'left' : 'right', writingDirection: prefs.extra === 'fr' ? 'ltr' : 'rtl' }}>
              {ex}
            </Text>
          ) : a === 1 && extra === 'loading' ? (
            <ActivityIndicator color={c.accent} style={{ alignSelf: 'flex-start' }} />
          ) : a === 1 && extra === 'error' ? (
            <Txt variant="small" color={c.muted}>
              {t.extraError}
            </Txt>
          ) : null}
        </View>
      );
    }
    const range = [];
    for (let a = item.from; a <= item.to; a++) range.push(a);
    return <Text style={arStyle}>{range.map(renderVerse)}</Text>;
  };

  const initialIndex = target ? itemIndexOf(target) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#0b2920' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 6, direction: rtl ? 'rtl' : 'ltr' }}>
          <IconBtn icon={rtl ? 'chevron-forward' : 'chevron-back'} label={t.close} onPress={() => router.back()} />
          <IconBtn icon={rtl ? 'caret-forward' : 'caret-back'} label={t.prevSurah} onPress={() => n > 1 && goTo(n - 1)} disabled={n === 1} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text numberOfLines={1} style={{ fontFamily: FONTS.arabicBold, fontSize: 20, lineHeight: 34, color: '#fff' }}>
              سورة {s.ar}
            </Text>
          </View>
          <IconBtn icon={rtl ? 'caret-back' : 'caret-forward'} label={t.nextSurah} onPress={goNext} disabled={n === 114} />
          <IconBtn icon="library" label={t.tafsir} onPress={() => setPrefs({ extra: prefs.extra === 'none' ? 'tafsir' : 'none' })} on={prefs.extra !== 'none'} />
          <IconBtn icon="text" label={t.readingOptions} onPress={() => setOptionsOpen(true)} />
          <IconBtn icon={listening && playing ? 'pause' : 'play'} label={listening && playing ? t.pause : t.listen} onPress={() => (listening ? togglePlay() : playSurah(n))} accent />
        </View>
        <ProgressBar value={readCount(useReading.getState().read, n) / s.verses} height={3} style={{ borderRadius: 0 }} />
      </SafeAreaView>

      {sel !== null && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: 10, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.line, direction: rtl ? 'rtl' : 'ltr' }}>
          <Txt weight="bold" style={{ marginEnd: 'auto' }} color={c.primary}>{`${rtl ? s.ar : s.tr} · ${t.verseN(sel)}`}</Txt>
          <Pill
            label={bmSet.has(sel) ? t.removeBookmark : t.bookmark}
            on={bmSet.has(sel)}
            c={c}
            onPress={() => {
              if (toggleBookmark(n, sel)) toast(t.bookmarkAdded);
            }}
          />
          <Pill label={t.tafsir} on c={c} onPress={() => setTafsirFor(sel)} />
          <Pill
            label={t.readUpToHere}
            c={c}
            onPress={() => {
              mark(1, sel);
              toast(t.progressSaved);
              setSel(null);
            }}
          />
          {selTiming && <Pill label={t.listenFromHere} c={c} onPress={listenFrom} />}
          <Pill
            label={t.copy}
            c={c}
            onPress={async () => {
              await Clipboard.setStringAsync(`${verses[sel - 1]} ﴿${arNum(sel)}﴾ [${s.ar} ${n}:${sel}]`);
              toast(t.copied);
              setSel(null);
            }}
          />
          <Pressable onPress={() => setSel(null)} hitSlop={10} accessibilityLabel={t.close} style={{ padding: 4 }}>
            <Ionicons name="close" size={20} color={c.muted} />
          </Pressable>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <FlashList
          ref={listRef}
          data={items}
          renderItem={renderItem}
          keyExtractor={(it, i) => (it.type === 'verses' ? `v${it.from}` : `${it.type}${i}`)}
          getItemType={it => it.type}
          extraData={[sel, cur, extra, bmSet, prefs]}
          initialScrollIndex={initialIndex || undefined}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 140 }}
          style={{ backgroundColor: c.page }}
          onViewableItemsChanged={info => onViewable.current(info)}
          viewabilityConfig={{ itemVisiblePercentThreshold: 5 }}
          onScroll={e => {
            offset.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={64}
          onScrollBeginDrag={() => {
            interactedAt.current = manualAt.current = Date.now();
          }}
          onMomentumScrollEnd={() => {
            interactedAt.current = Date.now();
          }}
        />
        {speed > 0 && (
          <View style={{ position: 'absolute', bottom: 24, end: 16, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#0b2920', borderRadius: 33, padding: 4 }}>
            <IconBtn icon="remove" label="-" onPress={() => setSpeed(x => Math.max(1, x - 1))} />
            <Txt color="#fff" weight="bold" style={{ minWidth: 18, textAlign: 'center' }}>
              {speed}
            </Txt>
            <IconBtn icon="add" label="+" onPress={() => setSpeed(x => Math.min(5, x + 1))} />
            <IconBtn icon="stop" label={t.close} onPress={() => setSpeed(0)} />
          </View>
        )}
      </View>

      <TafsirSheet n={n} a={tafsirFor} onClose={() => setTafsirFor(null)} />
      <OptionsSheet open={optionsOpen} onClose={() => setOptionsOpen(false)} n={n} speed={speed} setSpeed={setSpeed} />
    </View>
  );
}

function IconBtn({ icon, label, onPress, disabled, accent, on }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean; accent?: boolean; on?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={on !== undefined ? { selected: on } : undefined}
      style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: accent ? '#8f6c28' : on ? 'rgba(198,164,92,0.35)' : 'rgba(255,255,255,0.08)', opacity: disabled ? 0.35 : 1 }}>
      <Ionicons name={icon} size={20} color="#fff" />
    </Pressable>
  );
}

function Pill({ label, onPress, on, c }: { label: string; onPress: () => void; on?: boolean; c: Colors }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 33, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : 'transparent' }}>
      <Txt variant="label" color={on ? '#fff' : c.text}>
        {label}
      </Txt>
    </Pressable>
  );
}

function OptionsSheet({ open, onClose, n, speed, setSpeed }: { open: boolean; onClose: () => void; n: number; speed: number; setSpeed: (v: number) => void }) {
  const t = useT();
  const rtl = useIsRTL();
  const c = useColors();
  const prefs = useReading(st => st.prefs);
  const setPrefs = useReading(st => st.setPrefs);
  const read = useReading(st => st.read);
  const markRange = useReading(st => st.markRange);
  const s = SURAHS[n - 1];
  const rc = readCount(read, n);
  const yesNo: [boolean, string][] = [
    [true, t.yes],
    [false, t.no],
  ];
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose} accessibilityLabel={t.close} />
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '80%', direction: rtl ? 'rtl' : 'ltr' }}>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 2 }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <Txt variant="h2">{t.readingOptions}</Txt>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t.close}>
              <Ionicons name="close" size={24} color={c.text} />
            </Pressable>
          </Row>
          <SettingRow label={t.textSize}>
            <Row>
              <Button label="A−" kind="ghost" onPress={() => setPrefs({ size: Math.max(0, prefs.size - 1) })} disabled={prefs.size === 0} />
              <Txt weight="bold" style={{ minWidth: 30, textAlign: 'center' }}>
                {READER_SIZES[prefs.size]}
              </Txt>
              <Button label="A+" kind="ghost" onPress={() => setPrefs({ size: Math.min(READER_SIZES.length - 1, prefs.size + 1) })} disabled={prefs.size === READER_SIZES.length - 1} />
            </Row>
          </SettingRow>
          <SettingRow label={t.theme}>
            <Segmented
              options={[
                ['app', t.themeSystem],
                ['light', t.themeLight],
                ['sepia', t.themeSepia],
                ['night', t.themeNight],
              ]}
              value={prefs.theme}
              onChange={theme => setPrefs({ theme })}
            />
          </SettingRow>
          <SettingRow label={t.layout}>
            <Segmented
              options={[
                ['flow', t.layoutFlow],
                ['verse', t.layoutVerse],
              ]}
              value={prefs.layout}
              onChange={layout => setPrefs({ layout })}
            />
          </SettingRow>
          <SettingRow label={t.underVerse}>
            <Segmented
              options={[
                ['none', t.none],
                ['fr', t.translation],
                ['tafsir', t.tafsir],
              ]}
              value={prefs.extra}
              onChange={extra => setPrefs({ extra })}
            />
          </SettingRow>
          <SettingRow label={t.tashkeel}>
            <Segmented
              options={[
                [true, t.show],
                [false, t.hide],
              ]}
              value={prefs.tashkeel}
              onChange={tashkeel => setPrefs({ tashkeel })}
            />
          </SettingRow>
          <SettingRow label={t.spacing}>
            <Segmented
              options={[
                ['normal', t.normal],
                ['airy', t.airy],
              ]}
              value={prefs.spacing}
              onChange={spacing => setPrefs({ spacing })}
            />
          </SettingRow>
          <SettingRow label={t.followRecitation}>
            <Segmented options={yesNo} value={prefs.follow} onChange={follow => setPrefs({ follow })} />
          </SettingRow>
          <SettingRow label={t.keepAwake}>
            <Segmented options={yesNo} value={prefs.keepAwake} onChange={keepAwake => setPrefs({ keepAwake })} />
          </SettingRow>
          <SettingRow label={t.autoScroll}>
            <Segmented options={[0, 1, 2, 3, 4, 5].map(v => [v, v ? String(v) : t.no] as [number, string])} value={speed} onChange={setSpeed} />
          </SettingRow>
          <SettingRow label={rtl ? `سورة ${s.ar}` : `${t.tabRead} : ${s.tr}`}>
            <ProgressBar value={rc / s.verses} />
            <Txt variant="small">{t.surahProgress(rc, s.verses)}</Txt>
            <Row style={{ flexWrap: 'wrap' }}>
              <Button label={t.markRead} kind="ghost" onPress={() => markRange(n, 1, s.verses)} />
              <Button label={t.markUnread} kind="ghost" onPress={() => markRange(n, 1, s.verses, false)} />
            </Row>
          </SettingRow>
          <Txt variant="small" style={{ marginTop: 10 }}>
            {t.followNote}
          </Txt>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
