import { Image } from 'expo-image';
import { View } from 'react-native';

import { Txt } from '@/components/ui';
import { RECITER_PHOTOS, type Reciter } from '@/data/reciters';
import { useColors } from '@/theme/colors';

export function ReciterAvatar({ reciter, size = 48 }: { reciter: Reciter; size?: number }) {
  const c = useColors();
  const photo = RECITER_PHOTOS[reciter.photo];
  if (photo) {
    return <Image source={photo} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: c.accent }} contentFit="cover" />;
  }
  const initials = reciter.fr.split(/\s+/).map(w => w[0]).slice(0, 2).join('');
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Txt weight="bold" color={c.background}>
        {initials}
      </Txt>
    </View>
  );
}
