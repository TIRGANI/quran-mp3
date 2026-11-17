import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Chip, Row, Segmented, Txt } from '@/components/ui';
import { useIsRTL, useT } from '@/i18n';
import { CITIES, fmtClock, hijriDate, locateMe, METHODS, nextPrayer, PRAYER_ICONS, PRAYERS, prevPrayer, SALAT, timesFor, usePrayer, type PrayerName, type SalatName } from '@/lib/prayer';
import { toast } from '@/lib/toast';
import { CAN_NOTIFY, ensurePermission } from '@/notifications/reminders';
import { useSettings } from '@/stores/settings';
import { FONTS, useColors } from '@/theme/colors';

/** Heure actuelle, rafraîchie toutes les 30 s (compte à rebours, prière en cours). */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function AdhanScreen() {
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  const lang = useSettings(s => s.lang);
  const p = usePrayer();
  const now = useNow();
  const [locating, setLocating] = useState(false);
  const [showCities, setShowCities] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const times = timesFor(now, p);
  const next = p.place ? nextPrayer(now) : null;
  const prev = p.place ? prevPrayer(now) : null;
  // Avancement entre la prière précédente et la suivante (barre du haut)
  const span = next && prev ? next.time.getTime() - prev.time.getTime() : 0;
  const progress = span > 0 ? Math.min(1, (now.getTime() - prev!.time.getTime()) / span) : 0;
  const hijri = hijriDate(now, lang);
  const left = next ? Math.max(0, Math.round((next.time.getTime() - now.getTime()) / 60000)) : 0;

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const place = await locateMe();
      if (place) {
        p.set({ place });
        setShowCities(false);
      } else {
        toast(t.locationDenied);
        setShowCities(true);
      }
    } catch {
      toast(t.locationDenied);
      setShowCities(true);
    } finally {
      setLocating(false);
    }
  };

  const toggleAdhan = async (on: boolean) => {
    if (on && !(await ensurePermission())) return toast(t.notifDenied);
    p.set({ adhanOn: on });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: c.hero }}>
        <View style={{ alignItems: 'center', paddingTop: 10, paddingHorizontal: 16 }}>
          <Text style={{ fontFamily: FONTS.arabicBold, fontSize: 21, lineHeight: 36, color: '#fff' }}>مواقيت الصلاة</Text>
          {hijri && (
            <Txt variant="small" color="rgba(255,255,255,0.7)">
              {hijri}
            </Txt>
          )}
        </View>

        {/* Prochaine prière, en grand */}
        {next && (
          <View style={{ alignItems: 'center', paddingBottom: 18, gap: 2 }}>
            <Txt variant="small" color="rgba(255,255,255,0.7)">
              {t.nextPrayer}
            </Txt>
            <Text style={{ fontFamily: rtl ? FONTS.arabicBold : FONTS.uiBold, fontSize: 30, lineHeight: 48, color: c.accent }}>{t.prayerNames[next.name]}</Text>
            <Txt color="#fff" style={{ fontSize: 22, fontFamily: FONTS.uiBold }}>
              {fmtClock(next.time)}
            </Txt>
            <Txt variant="label" color="rgba(255,255,255,0.8)">
              {t.inTime(Math.floor(left / 60), left % 60)}
            </Txt>
            {/* Temps écoulé depuis la prière précédente */}
            {prev && (
              <View style={{ width: '78%', maxWidth: 420, marginTop: 10, gap: 4 }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden', direction: 'ltr' }}>
                  <View style={{ width: `${progress * 100}%`, height: '100%', borderRadius: 3, backgroundColor: c.accent }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', direction: 'ltr' }}>
                  <Txt variant="small" color="rgba(255,255,255,0.6)">{`${t.prayerNames[prev.name]} ${fmtClock(prev.time)}`}</Txt>
                  <Txt variant="small" color="rgba(255,255,255,0.6)">{`${t.prayerNames[next.name]} ${fmtClock(next.time)}`}</Txt>
                </View>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40, maxWidth: 820, width: '100%', alignSelf: 'center', direction: rtl ? 'rtl' : 'ltr' }}>
        {/* Lieu */}
        <Card style={{ gap: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={6} style={{ flex: 1 }}>
              <Ionicons name="location" size={18} color={c.accentStrong} />
              <Txt weight="bold" numberOfLines={1} style={{ flex: 1 }}>
                {p.place?.label ?? t.noPlace}
              </Txt>
            </Row>
            {p.place && !showCities && (
              <Pressable onPress={() => setShowCities(true)} hitSlop={8}>
                <Txt variant="label" color={c.accentStrong}>
                  {t.change}
                </Txt>
              </Pressable>
            )}
          </Row>
          {(!p.place || showCities) && (
            <>
              <Button
                label={locating ? t.locating : t.myLocation}
                icon={locating ? <ActivityIndicator color="#fff" /> : <Ionicons name="navigate" size={18} color="#fff" />}
                onPress={useMyLocation}
                disabled={locating}
              />
              <Txt variant="small">{t.chooseCity}</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {CITIES.map(city => (
                  <Chip
                    key={city.fr}
                    label={lang === 'ar' ? city.ar : city.fr}
                    on={p.place?.label === (lang === 'ar' ? city.ar : city.fr)}
                    onPress={() => {
                      p.set({ place: { lat: city.lat, lng: city.lng, label: lang === 'ar' ? city.ar : city.fr } });
                      setShowCities(false);
                    }}
                  />
                ))}
              </View>
            </>
          )}
        </Card>

        {/* Horaires du jour */}
        {times && (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {PRAYERS.map((name: PrayerName, i) => {
              const isNext = next?.name === name && next.time.getDate() === now.getDate();
              const salat = (SALAT as readonly string[]).includes(name);
              const on = salat && p.notify[name as SalatName];
              return (
                <View
                  key={name}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, backgroundColor: isNext ? c.accentSoft : 'transparent' }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: isNext ? c.accent : c.background }}>
                    <Ionicons name={PRAYER_ICONS[name]} size={18} color={isNext ? '#fff' : salat ? c.accentStrong : c.muted} />
                  </View>
                  <Text style={{ flex: 1, fontFamily: rtl ? FONTS.arabicBold : FONTS.uiBold, fontSize: rtl ? 19 : 16, lineHeight: rtl ? 32 : 24, color: salat ? c.text : c.muted }}>{t.prayerNames[name]}</Text>
                  <Txt weight="bold" style={{ fontSize: 17, direction: 'ltr' }} color={isNext ? c.accentStrong : c.text}>
                    {fmtClock(times[name])}
                  </Txt>
                  {salat ? (
                    <Pressable
                      onPress={() => p.set({ notify: { ...p.notify, [name]: !on } })}
                      hitSlop={8}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${t.adhanNotifs} : ${t.prayerNames[name]}`}
                      style={{ width: 36, alignItems: 'center', opacity: p.adhanOn ? 1 : 0.35 }}>
                      <Ionicons name={on ? 'notifications' : 'notifications-off-outline'} size={20} color={on ? c.accentStrong : c.muted} />
                    </Pressable>
                  ) : (
                    <View style={{ width: 36 }} />
                  )}
                </View>
              );
            })}
          </Card>
        )}

        {/* Notifications */}
        {CAN_NOTIFY && p.place && (
          <Card style={{ gap: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt weight="bold" style={{ flex: 1 }}>
                {t.adhanNotifs}
              </Txt>
              <Switch value={p.adhanOn} onValueChange={toggleAdhan} trackColor={{ true: c.accentStrong, false: c.line }} thumbColor="#fff" />
            </Row>
            <Txt variant="small">{t.adhanNotifsNote}</Txt>
            {p.adhanOn && (
              <>
                <Txt variant="label">{t.remindBefore}</Txt>
                <Segmented options={[0, 5, 10, 15].map(m => [m, m ? t.minBefore(m) : t.atTime] as [number, string])} value={p.before} onChange={before => p.set({ before })} />
              </>
            )}
            <View style={{ height: 1, backgroundColor: c.line }} />
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt style={{ flex: 1 }}>{t.adhkarWithPrayers}</Txt>
              <Switch value={p.adhkarWithPrayers} onValueChange={adhkarWithPrayers => p.set({ adhkarWithPrayers })} trackColor={{ true: c.accentStrong, false: c.line }} thumbColor="#fff" />
            </Row>
            <Txt variant="small">{t.adhkarWithPrayersNote}</Txt>
          </Card>
        )}

        {/* Méthode et ajustements */}
        {p.place && (
          <Card style={{ gap: 10 }}>
            <Txt variant="label" color={c.accentStrong}>
              {t.calcMethod}
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {METHODS.map(m => (
                <Chip key={m.id} label={lang === 'ar' ? m.ar : m.fr} on={p.method === m.id} onPress={() => p.set({ method: m.id })} />
              ))}
            </View>
            <Txt variant="label" color={c.accentStrong}>
              {t.asrHanafi}
            </Txt>
            <Segmented
              options={[
                [false, t.asrStandard],
                [true, t.asrHanafiLabel],
              ]}
              value={p.hanafi}
              onChange={hanafi => p.set({ hanafi })}
            />
            <Pressable onPress={() => setShowAdjust(!showAdjust)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 }}>
              <Txt variant="label" color={c.accentStrong} style={{ flex: 1 }}>
                {t.adjust}
              </Txt>
              <Ionicons name={showAdjust ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
            </Pressable>
            {showAdjust && (
              <>
                <Txt variant="small">{t.adjustNote}</Txt>
                {PRAYERS.map(name => (
                  <Row key={name} style={{ justifyContent: 'space-between' }}>
                    <Txt style={{ flex: 1 }}>{t.prayerNames[name]}</Txt>
                    <Row gap={8} style={{ direction: 'ltr' }}>
                      <OffsetBtn name={name} step={-1} />
                      <Txt weight="bold" style={{ minWidth: 44, textAlign: 'center' }}>
                        {`${(p.offsets[name] ?? 0) > 0 ? '+' : ''}${p.offsets[name] ?? 0}`}
                      </Txt>
                      <OffsetBtn name={name} step={1} />
                    </Row>
                  </Row>
                ))}
              </>
            )}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

/** − / + : décale une prière d'une minute (entre −30 et +30). */
function OffsetBtn({ name, step }: { name: PrayerName; step: 1 | -1 }) {
  const c = useColors();
  const t = useT();
  const offsets = usePrayer(st => st.offsets);
  const set = usePrayer(st => st.set);
  return (
    <Pressable
      onPress={() => set({ offsets: { ...offsets, [name]: Math.max(-30, Math.min(30, (offsets[name] ?? 0) + step)) } })}
      hitSlop={6}
      accessibilityLabel={`${t.prayerNames[name]} ${step > 0 ? '+1' : '-1'} min`}
      style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={step > 0 ? 'add' : 'remove'} size={16} color={c.text} />
    </Pressable>
  );
}
