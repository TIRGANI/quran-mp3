import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Txt } from '@/components/ui';
import { useToast } from '@/lib/toast';

export function Toast() {
  const msg = useToast(s => s.msg);
  const insets = useSafeAreaInsets();
  if (!msg) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 140, alignItems: 'center' }}>
      <View style={{ backgroundColor: 'rgba(11,41,32,0.95)', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 14, maxWidth: 520 }}>
        <Txt variant="label" color="#fff" style={{ textAlign: 'center' }}>
          {msg}
        </Txt>
      </View>
    </View>
  );
}
