import { useEffect, useState } from 'react';
import { Animated, Pressable, useWindowDimensions, View } from 'react-native';

import { Txt } from '@/components/ui';
import { useIsRTL, useT } from '@/i18n';
import { FONTS } from '@/theme/colors';
import { endTour, nextStep, STEPS } from '@/tour/steps';
import { onTourEvent, useTour } from '@/tour/store';

const DIM = 'rgba(2, 14, 9, 0.72)';
const GOLD = '#C6A45C';
const PAD = 6;

/** Couche de la visite guidée : assombrit l'écran sauf l'élément mis en lumière, avec une bulle d'explication. */
export function TourOverlay() {
  const active = useTour(s => s.active);
  const stepIndex = useTour(s => s.step);
  const step = STEPS[stepIndex];
  const rect = useTour(s => (step ? s.targets[step.target] : undefined));
  const { width: W, height: H } = useWindowDimensions();
  const t = useT();
  const rtl = useIsRTL();
  const [pulse] = useState(() => new Animated.Value(0)); // cadre doré qui « respire »

  // Le geste demandé a été fait : étape suivante
  useEffect(() => {
    if (!active || !step?.waitFor) return;
    return onTourEvent(event => {
      if (event === step.waitFor) nextStep();
    });
  }, [active, step]);

  // Élément absent de l'écran (ex. pas de bouton de téléchargement sur le web) : étape ignorée
  useEffect(() => {
    if (!active || !step?.optional || rect) return;
    const timer = setTimeout(() => {
      if (!useTour.getState().targets[step.target] && useTour.getState().step === stepIndex) nextStep();
    }, 1500);
    return () => clearTimeout(timer);
  }, [active, step, rect, stepIndex]);

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  if (!active || !step) return null;
  const text = t.tour[step.key];
  const last = stepIndex === STEPS.length - 1;

  const onNext = () => {
    // Pour une étape qui attend un geste, « Suivant » fait le geste à la place de l'utilisateur ;
    // l'événement qui en découle fait alors avancer la visite.
    if (step.waitFor && step.onNext) step.onNext();
    else nextStep();
  };

  // Trou autour de l'élément (les touchers y passent : l'utilisateur peut l'utiliser vraiment)
  const hole = rect && { x: rect.x - PAD, y: rect.y - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 };
  const block = () => {}; // les zones assombries absorbent les touchers

  const cardW = Math.min(W - 32, 380);
  let cardStyle: object = { top: H / 2 - 110, left: (W - cardW) / 2 };
  if (hole) {
    const left = Math.min(Math.max(16, hole.x + hole.w / 2 - cardW / 2), W - cardW - 16);
    cardStyle = hole.y + hole.h / 2 < H / 2 ? { top: hole.y + hole.h + 14, left } : { bottom: H - hole.y + 14, left };
  }

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }}>
      {hole ? (
        <>
          <Pressable onPress={block} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(0, hole.y), backgroundColor: DIM }} />
          <Pressable onPress={block} style={{ position: 'absolute', left: 0, right: 0, top: hole.y + hole.h, bottom: 0, backgroundColor: DIM }} />
          <Pressable onPress={block} style={{ position: 'absolute', left: 0, width: Math.max(0, hole.x), top: hole.y, height: hole.h, backgroundColor: DIM }} />
          <Pressable onPress={block} style={{ position: 'absolute', left: hole.x + hole.w, right: 0, top: hole.y, height: hole.h, backgroundColor: DIM }} />
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: hole.x - 2,
              top: hole.y - 2,
              width: hole.w + 4,
              height: hole.h + 4,
              borderRadius: 14,
              borderWidth: 3,
              borderColor: GOLD,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
            }}
          />
        </>
      ) : (
        <Pressable onPress={block} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: DIM }} />
      )}

      <View
        accessibilityLiveRegion="polite"
        style={[
          { position: 'absolute', width: cardW, backgroundColor: '#fffdf6', borderRadius: 18, padding: 16, gap: 8, borderWidth: 2, borderColor: GOLD, direction: rtl ? 'rtl' : 'ltr' },
          { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
          cardStyle,
        ]}>
        <Txt variant="small" color="#8f6c28" weight="bold">
          {t.tourStep(stepIndex + 1, STEPS.length)}
        </Txt>
        <Txt color="#252B28" style={{ fontFamily: FONTS.uiBold, fontSize: 17 }}>
          {text.title}
        </Txt>
        <Txt color="#3c4641" style={{ fontSize: 15, lineHeight: 23 }}>
          {text.body}
        </Txt>
        {step.waitFor && hole && (
          <Txt variant="small" color="#8f6c28">
            {t.tourTapHint}
          </Txt>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <Pressable onPress={endTour} hitSlop={10} accessibilityRole="button">
            <Txt variant="label" color="#5f7268">
              {t.tourQuit}
            </Txt>
          </Pressable>
          <Pressable
            onPress={onNext}
            accessibilityRole="button"
            style={({ pressed }) => ({ paddingHorizontal: 20, paddingVertical: 9, borderRadius: 33, backgroundColor: '#8f6c28', opacity: pressed ? 0.8 : 1 })}>
            <Txt variant="label" weight="bold" color="#fff">
              {last ? t.tourFinish : t.next}
            </Txt>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
