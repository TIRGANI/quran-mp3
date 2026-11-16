import { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useIsRTL } from '@/i18n';
import { FONTS, useColors } from '@/theme/colors';

/** Conteneur d'écran : fond, marges de sécurité et sens de lecture (RTL en arabe). */
export function Screen({ children, edges = ['top'], style }: { children: ReactNode; edges?: Edge[]; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const rtl = useIsRTL();
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: c.background, direction: rtl ? 'rtl' : 'ltr' }, style]}>
      {/* Largeur limitée sur tablette / grand écran, pour garder des lignes lisibles */}
      <View style={{ flex: 1, width: '100%', maxWidth: 820, alignSelf: 'center' }}>{children}</View>
    </SafeAreaView>
  );
}

type TxtProps = TextProps & { variant?: 'title' | 'h2' | 'body' | 'small' | 'label'; color?: string; weight?: 'regular' | 'medium' | 'bold' };

/** Texte de l'interface (police Changa, latin et arabe). */
export function Txt({ variant = 'body', color, weight, style, ...rest }: TxtProps) {
  const c = useColors();
  const rtl = useIsRTL();
  const v = VARIANTS[variant];
  const w = weight ?? v.weight;
  return (
    <Text
      {...rest}
      style={[
        { color: color ?? (variant === 'small' ? c.muted : c.text), fontSize: v.size, lineHeight: v.size * 1.45, writingDirection: rtl ? 'rtl' : 'ltr', textAlign: 'auto' },
        { fontFamily: w === 'bold' ? FONTS.uiBold : w === 'medium' ? FONTS.uiMedium : FONTS.ui },
        style,
      ]}
    />
  );
}
const VARIANTS = {
  title: { size: 26, weight: 'bold' },
  h2: { size: 17, weight: 'bold' },
  body: { size: 15, weight: 'regular' },
  small: { size: 12.5, weight: 'regular' },
  label: { size: 13, weight: 'medium' },
} as const;

/** Texte arabe du Coran (police Amiri). */
export function ArText({ style, ...rest }: TextProps) {
  const c = useColors();
  return <Text {...rest} style={[{ fontFamily: FONTS.arabic, color: c.text, writingDirection: 'rtl' } as TextStyle, style]} />;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[{ backgroundColor: c.surface, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, padding: 16 }, style]}>{children}</View>;
}

export function Row({ children, style, gap = 8 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function ProgressBar({ value, color, height = 6, style }: { value: number; color?: string; height?: number; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[{ height, borderRadius: height, backgroundColor: c.line, overflow: 'hidden' }, style]}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%', borderRadius: height, backgroundColor: color ?? c.accent }} />
    </View>
  );
}

/** Choix parmi quelques options (boutons segmentés). */
export function Segmented<V extends string | number | boolean>({
  options,
  value,
  onChange,
  align = 'start',
}: {
  options: [V, string][];
  value: V;
  onChange: (v: V) => void;
  align?: 'start' | 'center';
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignSelf: align === 'center' ? 'center' : 'flex-start', gap: 2, padding: 3, borderRadius: 22, backgroundColor: c.line }}>
      {options.map(([v, label]) => {
        const on = v === value;
        return (
          <Pressable
            key={String(v)}
            onPress={() => onChange(v)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 33, backgroundColor: on ? c.accentStrong : 'transparent' }}>
            <Txt variant="label" color={on ? '#fff' : c.text}>
              {label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 33, borderWidth: 1, borderColor: on ? c.primary : c.line, backgroundColor: on ? c.primary : c.surface }}>
      <Txt variant="label" color={on ? c.background : c.text}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Button({ label, onPress, kind = 'primary', icon, color, style, ...rest }: PressableProps & { label: string; kind?: 'primary' | 'ghost' | 'danger'; icon?: ReactNode; color?: string; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const bg = kind === 'primary' ? c.accentStrong : 'transparent';
  const fg = color ?? (kind === 'primary' ? '#fff' : kind === 'danger' ? c.danger : c.text);
  return (
    <Pressable
      {...rest}
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 33, backgroundColor: bg, opacity: pressed ? 0.75 : 1 },
        kind !== 'primary' && { borderWidth: 1, borderColor: kind === 'danger' ? c.danger : c.line },
        style,
      ]}>
      {icon}
      <Txt variant="label" weight="bold" color={fg}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line, gap: 8 }}>
      <Txt variant="label">{label}</Txt>
      {children}
    </View>
  );
}

/** Numéro de sourate dans un losange doré (comme sur le site). */
export function SurahNumber({ n, active }: { n: number; active?: boolean }) {
  const c = useColors();
  return (
    <View style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: c.accent, backgroundColor: active ? c.accent : 'transparent', transform: [{ rotate: '45deg' }] }} />
      <Txt variant="small" weight="bold" color={active ? '#fff' : c.text}>
        {n}
      </Txt>
    </View>
  );
}
