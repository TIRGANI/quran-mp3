import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { RECITERS, type Reciter } from '@/data/reciters';

// Sourates gardées pour l'écoute hors connexion : Documents/audio/<récitateur>/<NNN>.mp3.
// L'état « téléchargé » est lu directement sur le disque (pas de liste séparée qui pourrait
// se désynchroniser des fichiers réels).
export const CAN_DOWNLOAD = Platform.OS !== 'web';

const pad = (n: number) => String(n).padStart(3, '0');
const dirName = (reciterId: string) => reciterId.replace(/[^a-zA-Z0-9_.-]+/g, '_');
export const remoteUrl = (r: Reciter, n: number) => `${r.base}${pad(n)}.mp3`;

const reciterDir = (reciterId: string) => new Directory(Paths.document, 'audio', dirName(reciterId));
const surahFile = (reciterId: string, n: number) => new File(reciterDir(reciterId), `${pad(n)}.mp3`);

type DownloadsState = {
  /** clé `${reciterId}:${n}` → true quand le fichier est complet sur le disque */
  done: Record<string, true>;
  /** clé → progression 0..1 pendant un téléchargement */
  progress: Record<string, number>;
};

export const useDownloads = create<DownloadsState>(() => ({ done: scanDisk(), progress: {} }));
export const dlKey = (reciterId: string, n: number) => `${reciterId}:${n}`;

function scanDisk(): Record<string, true> {
  const done: Record<string, true> = {};
  if (!CAN_DOWNLOAD) return done;
  for (const r of RECITERS) {
    try {
      const dir = reciterDir(r.id);
      if (!dir.exists) continue;
      for (const f of dir.list()) {
        const m = f instanceof File && /^(\d{3})\.mp3$/.exec(f.name);
        if (m && Number(f.size) > 0) done[dlKey(r.id, +m[1])] = true;
      }
    } catch {
      // dossier illisible : on l'ignore
    }
  }
  return done;
}

/** Source à jouer : le fichier local s'il existe, sinon l'adresse en ligne. */
export function sourceUri(r: Reciter, n: number): string {
  if (CAN_DOWNLOAD && useDownloads.getState().done[dlKey(r.id, n)]) {
    const f = surahFile(r.id, n);
    if (f.exists) return f.uri;
  }
  return remoteUrl(r, n);
}

const tasks = new Map<string, { cancel: () => void }>();

export async function downloadSurah(r: Reciter, n: number): Promise<boolean> {
  const key = dlKey(r.id, n);
  if (!CAN_DOWNLOAD || tasks.has(key) || useDownloads.getState().done[key]) return true;
  const dir = reciterDir(r.id);
  dir.create({ idempotent: true, intermediates: true });
  // Téléchargé d'abord dans un fichier temporaire : un téléchargement interrompu ne laisse
  // jamais un MP3 incomplet considéré comme disponible.
  const tmp = new File(dir, `${pad(n)}.part`);
  if (tmp.exists) tmp.delete();
  const setProgress = (p: number | null) =>
    useDownloads.setState(s => {
      const progress = { ...s.progress };
      if (p === null) delete progress[key];
      else progress[key] = p;
      return { progress };
    });
  setProgress(0);
  const expected = r.kb[n - 1] * 1024;
  let lastPct = -1;
  const task = File.createDownloadTask(remoteUrl(r, n), tmp, {
    onProgress: ({ bytesWritten, totalBytes }) => {
      // Sur iOS, les tailles arrivent en BigInt : conversion avant tout calcul
      const written = Number(bytesWritten);
      const total = Number(totalBytes) > 0 ? Number(totalBytes) : expected;
      if (!(total > 0)) return;
      // Mise à jour de l'affichage seulement à chaque pour cent gagné (pas à chaque paquet reçu)
      const pct = Math.min(100, Math.floor((written / total) * 100));
      if (pct === lastPct) return;
      lastPct = pct;
      setProgress(pct / 100);
    },
  });
  tasks.set(key, task);
  try {
    const file = await task.downloadAsync();
    if (!file) throw new Error('annulé');
    const dest = surahFile(r.id, n);
    if (dest.exists) dest.delete();
    file.move(dest);
    useDownloads.setState(s => ({ done: { ...s.done, [key]: true } }));
    return true;
  } catch {
    if (tmp.exists) tmp.delete();
    return false;
  } finally {
    tasks.delete(key);
    setProgress(null);
  }
}

export function cancelDownload(reciterId: string, n: number) {
  tasks.get(dlKey(reciterId, n))?.cancel();
}

export function deleteSurah(reciterId: string, n: number) {
  const f = surahFile(reciterId, n);
  if (f.exists) f.delete();
  useDownloads.setState(s => {
    const done = { ...s.done };
    delete done[dlKey(reciterId, n)];
    return { done };
  });
}

export function deleteAll() {
  const root = new Directory(Paths.document, 'audio');
  if (root.exists) root.delete();
  useDownloads.setState({ done: {} });
}

/** Espace occupé (octets), d'après les tailles connues des MP3. */
export function usedBytes(done: Record<string, true>) {
  let total = 0;
  for (const key of Object.keys(done)) {
    const i = key.lastIndexOf(':');
    const r = RECITERS.find(x => x.id === key.slice(0, i));
    if (r) total += r.kb[+key.slice(i + 1) - 1] * 1024;
  }
  return total;
}
