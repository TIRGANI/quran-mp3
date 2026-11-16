import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Segmented, Txt } from '@/components/ui';
import { useIsRTL, useT } from '@/i18n';
import { useSettings } from '@/stores/settings';
import { FONTS } from '@/theme/colors';

const BG = '#0b2920';
const GOLD = '#C6A45C';

/** Présentation au premier lancement : langue, puis une page par grande fonctionnalité. */
export function Onboarding() {
  const t = useT();
  const rtl = useIsRTL();
  const lang = useSettings(s => s.lang);
  const set = useSettings(s => s.set);
  const [step, setStep] = useState(0);
  const pages = t.intro;
  const page = pages[step];
  const last = step === pages.length - 1;
  const finish = () => set({ onboarded: true });

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: BG, zIndex: 100 }}>
      <SafeAreaView style={{ flex: 1, direction: rtl ? 'rtl' : 'ltr' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 16 }}>
          {!last && (
            <Pressable onPress={finish} hitSlop={10} accessibilityRole="button">
              <Txt color="rgba(255,255,255,0.75)" weight="medium">
                {t.skip}
              </Txt>
            </Pressable>
          )}
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 22, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
          {step === 0 ? (
            <Image source={require('../../assets/images/icon.png')} style={{ width: 132, height: 132, borderRadius: 30 }} />
          ) : (
            <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: GOLD, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(198,164,92,0.12)' }}>
              <Ionicons name={page.icon} size={54} color={GOLD} />
            </View>
          )}
          <Txt color="#fff" style={{ fontSize: 26, lineHeight: 40, textAlign: 'center', fontFamily: rtl ? FONTS.arabicBold : FONTS.uiBold }}>
            {page.title}
          </Txt>
          <Txt color="rgba(255,255,255,0.82)" style={{ fontSize: 16, lineHeight: 26, textAlign: 'center' }}>
            {page.body}
          </Txt>
          {step === 0 && (
            <View style={{ alignItems: 'center', gap: 10, marginTop: 6 }}>
              <Txt variant="label" color={GOLD}>
                {t.chooseLanguage}
              </Txt>
              <View style={{ direction: 'ltr' }}>
                <Segmented
                  align="center"
                  options={[
                    ['ar', 'العربية'],
                    ['fr', 'Français'],
                  ]}
                  value={lang}
                  onChange={v => set({ lang: v })}
                />
              </View>
            </View>
          )}
        </View>

        <View style={{ padding: 24, gap: 18, alignItems: 'center' }}>
          {/* Points de progression */}
          <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`${step + 1} / ${pages.length}`}>
            {pages.map((_, i) => (
              <View key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? GOLD : 'rgba(255,255,255,0.25)' }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, width: '100%', maxWidth: 420 }}>
            {step > 0 && (
              <Pressable
                onPress={() => setStep(step - 1)}
                accessibilityRole="button"
                accessibilityLabel={t.previous}
                style={{ width: 52, height: 48, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={rtl ? 'arrow-forward' : 'arrow-back'} size={20} color="#fff" />
              </Pressable>
            )}
            <Button label={last ? t.getStarted : t.next} onPress={() => (last ? finish() : setStep(step + 1))} style={{ flex: 1 }} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
