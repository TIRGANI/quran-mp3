import { Ionicons } from '@expo/vector-icons';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { Txt } from '@/components/ui';
import { useT, type TipId } from '@/i18n';
import { useSettings } from '@/stores/settings';
import { useTour } from '@/tour/store';
import { useColors } from '@/theme/colors';

/**
 * Astuce affichée la première fois qu'on ouvre une fonctionnalité, jusqu'à « Compris ».
 * Réaffichable depuis Réglages > Aide.
 */
export function Tip({ id, style }: { id: TipId; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const t = useT();
  const seen = useSettings(s => !!s.seenTips[id]);
  const touring = useTour(s => s.active);
  if (seen || touring) return null;
  const tip = t.tips[id];
  const dismiss = () => {
    const { seenTips, set } = useSettings.getState();
    set({ seenTips: { ...seenTips, [id]: true } });
  };
  return (
    <View
      accessibilityRole="summary"
      style={[{ backgroundColor: c.accentSoft, borderRadius: 18, borderWidth: 1, borderColor: c.accent, padding: 14, gap: 8 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="bulb" size={20} color={c.accentStrong} />
        <Txt weight="bold" style={{ flex: 1 }}>
          {tip.title}
        </Txt>
        <Pressable onPress={dismiss} hitSlop={10} accessibilityLabel={t.close}>
          <Ionicons name="close" size={20} color={c.muted} />
        </Pressable>
      </View>
      {tip.items.map((line, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          <Txt color={c.accentStrong} weight="bold">
            •
          </Txt>
          <Txt variant="label" weight="regular" style={{ flex: 1, lineHeight: 20 }}>
            {line}
          </Txt>
        </View>
      ))}
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        style={({ pressed }) => ({ alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 7, borderRadius: 33, backgroundColor: c.accentStrong, opacity: pressed ? 0.8 : 1 })}>
        <Txt variant="label" weight="bold" color="#fff">
          {t.gotIt}
        </Txt>
      </Pressable>
    </View>
  );
}
