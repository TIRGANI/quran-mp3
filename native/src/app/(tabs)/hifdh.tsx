import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { HIFDH_RECITERS, REPS, rewindHifdh, ROUNDS, startHifdh, stepVerse, stopHifdh, useHifdh } from '@/audio/hifdh';
import { togglePlay, usePlayer } from '@/audio/player';
import { NumberStepper, SurahPicker } from '@/components/SurahPicker';
import { Tip } from '@/components/Tip';
import { Button, Card, Chip, ProgressBar, Row, Screen, Segmented, SettingRow, Txt } from '@/components/ui';
import { SURAHS } from '@/data/surahs';
import { arNum, useIsRTL, useT } from '@/i18n';
import { basmala, surahVerses } from '@/lib/quran';
import { FONTS, useColors } from '@/theme/colors';

export default function HifdhScreen() {
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  const h = useHifdh();
  const s = SURAHS[h.n - 1];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 30 }}>
        <View>
          <Txt variant="title" style={{ color: c.primary }}>
            {t.hifdhTitle}
          </Txt>
          <Txt variant="small">{t.hifdhSubtitle}</Txt>
        </View>
        <Tip id="hifdh" />

        {h.active ? (
          <Session />
        ) : (
          <Card style={{ gap: 2 }}>
            <SettingRow label={t.surah}>
              <SurahPicker value={h.n} onChange={n => h.setConfig({ n, from: 1, to: Math.min(SURAHS[n - 1].verses, 10) })} />
            </SettingRow>
            <Row gap={16} style={{ flexWrap: 'wrap' }}>
              <View style={{ gap: 6, paddingVertical: 10 }}>
                <Txt variant="label">{t.fromVerse}</Txt>
                <NumberStepper label={t.fromVerse} value={h.from} min={1} max={s.verses} onChange={from => h.setConfig({ from, to: Math.max(from, h.to) })} />
              </View>
              <View style={{ gap: 6, paddingVertical: 10 }}>
                <Txt variant="label">{t.toVerse}</Txt>
                <NumberStepper label={t.toVerse} value={h.to} min={h.from} max={s.verses} onChange={to => h.setConfig({ to })} />
              </View>
            </Row>
            <SettingRow label={t.reciter}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {HIFDH_RECITERS.map(r => (
                  <Chip key={r.id} label={rtl ? r.ar : r.fr} on={h.reciter === r.id} onPress={() => h.setConfig({ reciter: r.id })} />
                ))}
              </View>
            </SettingRow>
            <SettingRow label={t.repsPerVerse}>
              <Segmented options={REPS.map(r => [r, `${r}×`] as [number, string])} value={h.reps} onChange={reps => h.setConfig({ reps })} />
            </SettingRow>
            <SettingRow label={t.rangeRepeats}>
              <Segmented options={ROUNDS.map(r => [r, r === 0 ? t.infinite : `${r}×`] as [number, string])} value={h.rounds} onChange={rounds => h.setConfig({ rounds })} />
            </SettingRow>
            <Button label={t.start} icon={<Ionicons name="play" size={18} color="#fff" />} onPress={startHifdh} style={{ marginTop: 14 }} />
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

/** Séance en cours : verset affiché en grand, répétition, commandes. */
function Session() {
  const c = useColors();
  const t = useT();
  const h = useHifdh();
  const playing = usePlayer(st => st.playing);
  const s = SURAHS[h.n - 1];
  const verses = surahVerses(h.n).verses;
  const text = h.ayah === 0 ? basmala() : verses[h.ayah - 1];
  // Texte masqué pour s'entraîner de mémoire : seul le premier mot reste visible
  const shown = h.hideText && h.ayah !== 0 ? `${text.split(' ')[0]} …` : text;
  const total = h.to - h.from + 1;
  const pos = h.ayah === 0 ? 0 : h.ayah - h.from + (h.rep - 1) / h.reps;

  const ctrl = (icon: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, big?: boolean) => (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={8}
      style={{ width: big ? 70 : 46, height: big ? 70 : 46, borderRadius: 35, alignItems: 'center', justifyContent: 'center', backgroundColor: big ? c.accent : 'rgba(255,255,255,0.08)' }}>
      <Ionicons name={icon} size={big ? 32 : 22} color={big ? c.primaryDark : '#fff'} />
    </Pressable>
  );

  return (
    <View style={{ gap: 14 }}>
      <View style={{ backgroundColor: c.hero, borderRadius: 22, padding: 18, gap: 14 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: FONTS.arabicBold, fontSize: 22, lineHeight: 38, color: '#fff' }}>سورة {s.ar}</Text>
          <Txt variant="small" color={c.accent}>
            {h.rounds === 1 ? '' : t.hifdhRound(h.round, h.rounds || h.round)}
          </Txt>
        </Row>
        <Text style={{ fontFamily: FONTS.arabic, fontSize: 28, lineHeight: 56, color: '#fff', textAlign: 'center', writingDirection: 'rtl' }}>
          {shown}
          {h.ayah !== 0 && <Text style={{ color: c.accent }}>{` ۝${arNum(h.ayah)}`}</Text>}
        </Text>
        <Txt color={c.accent} weight="bold" style={{ textAlign: 'center' }}>
          {h.ayah === 0 ? t.hifdhBasmala : t.hifdhStatus(h.ayah, h.rep, h.reps)}
        </Txt>
        <ProgressBar value={pos / total} color={c.accent} />
        <Row gap={12} style={{ justifyContent: 'center', direction: 'ltr' }}>
          {ctrl('play-skip-back', t.prevVerse, () => stepVerse(-1))}
          {ctrl('play-back', '-5 s', rewindHifdh)}
          {ctrl(playing ? 'pause' : 'play', playing ? t.pause : t.listen, togglePlay, true)}
          {ctrl('play-skip-forward', t.nextVerse, () => stepVerse(1))}
          {ctrl('stop', t.stop, stopHifdh)}
        </Row>
      </View>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <Chip label={h.hideText ? t.showText : t.hideText} on={h.hideText} onPress={() => h.setConfig({ hideText: !h.hideText })} />
      </Row>
      <Txt variant="small">{`${s.tr} · ${t.fromVerse} ${h.from} — ${t.toVerse} ${h.to} · ${t.repsPerVerse} : ${h.reps}`}</Txt>
    </View>
  );
}
