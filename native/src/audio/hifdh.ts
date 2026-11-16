import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { player, seekTo, setHifdhHandlers, usePlayer } from '@/audio/player';
import { SURAHS } from '@/data/surahs';
import { getT } from '@/i18n';
import { zustandStorage } from '@/lib/storage';
import { toast } from '@/lib/toast';
import { useSettings } from '@/stores/settings';

// Mode Hifdh : chaque verset est joué `reps` fois, du verset `from` au verset `to`, le passage
// entier étant répété `rounds` fois (0 = sans fin). Audio verset par verset d'everyayah.com
// (fichiers SSSAAA.mp3 ; SSS000.mp3 = Basmala de la sourate), comme sur le site.
export const HIFDH_RECITERS = [
  { id: 'Alafasy_128kbps', fr: 'Mishary Al-Afasy', ar: 'مشاري العفاسي' },
  { id: 'Abdul_Basit_Murattal_192kbps', fr: 'Abdul Basit (Murattal)', ar: 'عبد الباسط عبد الصمد' },
  { id: 'Husary_128kbps', fr: 'Mahmoud Al-Husary', ar: 'محمود خليل الحصري' },
  { id: 'Minshawy_Murattal_128kbps', fr: 'Al-Minshawi', ar: 'محمد صديق المنشاوي' },
  { id: 'Abdurrahmaan_As-Sudais_192kbps', fr: 'As-Sudais', ar: 'عبد الرحمن السديس' },
  { id: 'Saood_ash-Shuraym_128kbps', fr: 'Ash-Shuraim', ar: 'سعود الشريم' },
];
export const REPS = [1, 3, 5, 7, 10, 20];
export const ROUNDS = [1, 2, 3, 5, 0];

export type HifdhConfig = { n: number; from: number; to: number; reps: number; rounds: number; reciter: string; hideText: boolean };

type HifdhState = HifdhConfig & {
  active: boolean;
  ayah: number; // 0 = Basmala
  rep: number;
  round: number;
  setConfig: (patch: Partial<HifdhConfig>) => void;
};

export const useHifdh = create<HifdhState>()(
  persist(
    set => ({
      n: 1,
      from: 1,
      to: 7,
      reps: 3,
      rounds: 1,
      reciter: HIFDH_RECITERS[0].id,
      hideText: false,
      active: false,
      ayah: 1,
      rep: 1,
      round: 1,
      setConfig: patch => set(patch),
    }),
    {
      name: 'hifdh',
      storage: zustandStorage,
      version: 1,
      // Seule la configuration est gardée ; une séance ne reprend jamais toute seule au démarrage
      partialize: s => ({ n: s.n, from: s.from, to: s.to, reps: s.reps, rounds: s.rounds, reciter: s.reciter, hideText: s.hideText }),
    },
  ),
);

const pad = (x: number) => String(x).padStart(3, '0');
const hasBasmala = (n: number) => n !== 1 && n !== 9;

function playCurrent() {
  const { n, ayah, reciter } = useHifdh.getState();
  player.replace({ uri: `https://everyayah.com/data/${reciter}/${pad(n)}${pad(ayah)}.mp3` });
  player.setPlaybackRate(useSettings.getState().rate);
  player.play();
  usePlayer.setState({ mode: 'hifdh', surah: n, playing: true, currentTime: 0, duration: 0 });
  const s = SURAHS[n - 1];
  const t = getT();
  try {
    player.setActiveForLockScreen(true, { title: `${t.hifdhTitle} · ${s.tr} ${ayah || ''}`.trim(), artist: `سورة ${s.ar}`, albumTitle: 'Wirdan' });
  } catch {
    // web
  }
}

function replay() {
  player
    .seekTo(0)
    .then(() => player.play())
    .catch(() => playCurrent());
}

export function startHifdh() {
  const { n, from, to } = useHifdh.getState();
  const v = SURAHS[n - 1].verses;
  const f = Math.min(Math.max(1, from), v);
  const last = Math.min(Math.max(f, to), v);
  useHifdh.setState({ active: true, from: f, to: last, ayah: f === 1 && hasBasmala(n) ? 0 : f, rep: 1, round: 1 });
  playCurrent();
}

export function stopHifdh() {
  player.pause();
  useHifdh.setState({ active: false });
  usePlayer.setState({ mode: 'surah', surah: null, playing: false });
  try {
    player.clearLockScreenControls();
  } catch {
    // web
  }
}

function goTo(ayah: number) {
  useHifdh.setState({ ayah, rep: 1 });
  playCurrent();
}

/** Verset suivant dans le passage ; à la fin, nouveau tour ou fin de la séance. */
function nextVerse() {
  const { ayah, from, to, round, rounds } = useHifdh.getState();
  if (ayah === 0) return goTo(from);
  if (ayah < to) return goTo(ayah + 1);
  if (rounds === 0 || round < rounds) {
    useHifdh.setState({ round: round + 1 });
    return goTo(from);
  }
  stopHifdh();
  toast(getT().hifdhDone);
}

export function stepVerse(dir: 1 | -1) {
  const { ayah, from, to, active } = useHifdh.getState();
  if (!active) return;
  if (dir === 1) return ayah < to ? goTo(Math.max(from, ayah + 1)) : undefined;
  if (ayah > from) goTo(ayah - 1);
  else goTo(ayah); // recommencer le premier verset
}

setHifdhHandlers({
  onFinish: () => {
    const { active, ayah, rep, reps } = useHifdh.getState();
    if (!active) return;
    if (ayah !== 0 && rep < reps) {
      useHifdh.setState({ rep: rep + 1 });
      return replay();
    }
    nextVerse();
  },
  // Certains récitateurs n'ont pas de fichier Basmala séparé : on passe directement au verset.
  onError: () => {
    const { active, ayah, from } = useHifdh.getState();
    if (!active) return false;
    if (ayah === 0) {
      goTo(from);
      return true;
    }
    toast(getT().hifdhNeedsNet);
    stopHifdh();
    return true;
  },
  step: dir => stepVerse(dir),
});

/** Avance manuelle dans le verset en cours (−5 s), utile pour réécouter un passage difficile. */
export const rewindHifdh = () => seekTo(player.currentTime - 5);

// Lancer une sourate normale (ou toute autre écoute) met fin à la séance de Hifdh
usePlayer.subscribe((s, prev) => {
  if (prev.mode === 'hifdh' && s.mode === 'surah' && useHifdh.getState().active) useHifdh.setState({ active: false });
});
