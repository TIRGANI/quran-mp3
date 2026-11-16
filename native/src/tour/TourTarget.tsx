import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTourTarget } from '@/tour/useTourTarget';

/** Enveloppe un élément pour qu'il puisse être mis en lumière par la visite guidée. */
export function TourTarget({ id, children, style }: { id: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const target = useTourTarget(id);
  return (
    <View {...target} style={style}>
      {children}
    </View>
  );
}
