import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { CAN_DOWNLOAD, cancelDownload, deleteSurah, dlKey, downloadSurah, useDownloads } from '@/audio/downloads';
import { Txt } from '@/components/ui';
import type { Reciter } from '@/data/reciters';
import { useT } from '@/i18n';
import { toast } from '@/lib/toast';
import { useColors } from '@/theme/colors';

/** Télécharger / annuler / supprimer une sourate pour l'écoute hors connexion. */
export function DownloadButton({ reciter, n }: { reciter: Reciter; n: number }) {
  const c = useColors();
  const t = useT();
  const key = dlKey(reciter.id, n);
  const done = useDownloads(s => !!s.done[key]);
  const progress = useDownloads(s => s.progress[key]);
  if (!CAN_DOWNLOAD || !reciter.kb[n - 1]) return null;

  const loading = progress !== undefined;
  const onPress = async () => {
    if (loading) return cancelDownload(reciter.id, n);
    if (done) return deleteSurah(reciter.id, n);
    const ok = await downloadSurah(reciter, n);
    if (!ok) toast(t.downloadError);
  };
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={done ? t.removeDownload : t.download}
      style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: done ? c.success : c.line, backgroundColor: done ? c.success : c.surface, alignItems: 'center', justifyContent: 'center' }}>
      {loading ? (
        <View style={{ alignItems: 'center' }}>
          {progress > 0.02 ? (
            <Txt variant="small" weight="bold" style={{ fontSize: 10, lineHeight: 12 }}>
              {Math.round(progress * 100)}%
            </Txt>
          ) : (
            <ActivityIndicator size="small" color={c.accentStrong} />
          )}
        </View>
      ) : (
        <Ionicons name={done ? 'checkmark' : 'arrow-down'} size={17} color={done ? '#fff' : c.muted} />
      )}
    </Pressable>
  );
}
