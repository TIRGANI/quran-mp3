import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Txt } from '@/components/ui';
import { useIsRTL, useT } from '@/i18n';
import { fmtClock, nextPrayer, usePrayer } from '@/lib/prayer';
import { FONTS, useColors } from '@/theme/colors';

/** Prochaine prière et compte à rebours ; un toucher ouvre les horaires (ou invite à choisir sa ville). */
export function NextPrayerCard() {
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  const place = usePrayer(s => s.place);
  usePrayer(s => s.method + s.hanafi + JSON.stringify(s.offsets)); // recalcul si les réglages changent
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const next = place ? nextPrayer(now) : null;
  const left = next ? Math.max(0, Math.round((next.time.getTime() - now.getTime()) / 60000)) : 0;

  return (
    <Pressable
      onPress={() => router.navigate('/adhan')}
      accessibilityRole="button"
      accessibilityLabel={next ? `${t.nextPrayer} : ${t.prayerNames[next.name]} ${fmtClock(next.time)}` : t.adhanTitle}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.hero, borderRadius: 18, padding: 14, opacity: pressed ? 0.88 : 1 })}>
      <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="time" size={22} color={c.accent} />
      </View>
      {next ? (
        <View style={{ flex: 1 }}>
          <Txt variant="small" color="rgba(255,255,255,0.7)">{`${t.nextPrayer} · ${place?.label ?? ''}`}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={{ fontFamily: rtl ? FONTS.arabicBold : FONTS.uiBold, fontSize: rtl ? 20 : 18, lineHeight: rtl ? 32 : 26, color: c.accent }}>{t.prayerNames[next.name]}</Text>
            <Txt weight="bold" color="#fff" style={{ fontSize: 17, direction: 'ltr' }}>
              {fmtClock(next.time)}
            </Txt>
          </View>
          <Txt variant="small" color="rgba(255,255,255,0.75)">
            {t.inTime(Math.floor(left / 60), left % 60)}
          </Txt>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <Txt weight="bold" color="#fff">
            {t.adhanTitle}
          </Txt>
          <Txt variant="small" color="rgba(255,255,255,0.75)">
            {t.noPlace}
          </Txt>
        </View>
      )}
      <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={20} color={c.accent} />
    </Pressable>
  );
}
