import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Segmented, Txt } from '@/components/ui';
import { useIsRTL, useT } from '@/i18n';
import { useSettings } from '@/stores/settings';
import { FONTS } from '@/theme/colors';
import { startTour } from '@/tour/steps';

const BG = '#0b2920';
const GOLD = '#C6A45C';

/**
 * Accueil au premier lancement : bienvenue et choix de la langue, puis la visite guidée
 * interactive (tour/), qui montre chaque fonctionnalité directement sur les vrais écrans.
 */
export function Onboarding() {
  const t = useT();
  const rtl = useIsRTL();
  const lang = useSettings(s => s.lang);
  const set = useSettings(s => s.set);
  const welcome = t.intro[0];

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: BG, zIndex: 100 }}>
      <SafeAreaView style={{ flex: 1, direction: rtl ? 'rtl' : 'ltr' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 22, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
          <Image source={require('../../assets/images/icon.png')} style={{ width: 132, height: 132, borderRadius: 30 }} />
          <Txt color="#fff" style={{ fontSize: 26, lineHeight: 40, textAlign: 'center', fontFamily: rtl ? FONTS.arabicBold : FONTS.uiBold }}>
            {welcome.title}
          </Txt>
          <Txt color="rgba(255,255,255,0.82)" style={{ fontSize: 16, lineHeight: 26, textAlign: 'center' }}>
            {welcome.body}
          </Txt>
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
        </View>

        <View style={{ padding: 24, gap: 14, alignItems: 'center' }}>
          <Button
            label={t.tourStart}
            onPress={() => {
              set({ onboarded: true });
              startTour();
            }}
            style={{ width: '100%', maxWidth: 420 }}
          />
          <Pressable onPress={() => set({ onboarded: true })} hitSlop={10} accessibilityRole="button">
            <Txt color="rgba(255,255,255,0.7)" weight="medium">
              {t.skip}
            </Txt>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
