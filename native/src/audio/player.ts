import { createAudioPlayer, setAudioModeAsync, type AudioStatus } from 'expo-audio';
import { create } from 'zustand';

import { downloadSurah, sourceUri } from '@/audio/downloads';
import { RECITERS, type Reciter } from '@/data/reciters';
import { SURAHS } from '@/data/surahs';
import { getT } from '@/i18n';
import { toast } from '@/lib/toast';
import { getReciter, useSettings } from '@/stores/settings';

// Un seul lecteur audio pour toute l'application (onglets, page de lecture, écran verrouillé).
export const player = createAudioPlayer(null, { updateInterval: 250 });

type PlayerState = {
  /** 'surah' : écoute normale ; 'hifdh' : répétition verset par verset (audio/hifdh.ts) */
  mode: 'surah' | 'hifdh';
  surah: number | null;
  reciterId: string | null;
  playing: boolean;
  buffering: boolean;
  /** Le dernier chargement a échoué (ex. pas de connexion) : « lecture » doit recharger. */
  failed: boolean;
  currentTime: number;
  duration: number;
};

export const usePlayer = create<PlayerState>(() => ({
  mode: 'surah',
  surah: null,
  reciterId: null,
  playing: false,
  buffering: false,
  failed: false,
  currentTime: 0,
  duration: 0,
}));

const ARTWORK = 'https://wirdan.app/icon-512.png';
let pendingSeek: number | null = null;

/** Mode Hifdh : c'est lui qui décide quoi jouer à la fin d'un verset, ou en cas d'erreur. */
type ModeHandlers = { onFinish: () => void; onError: () => boolean; step: (dir: 1 | -1) => void };
let hifdhHandlers: ModeHandlers | null = null;
export const setHifdhHandlers = (h: ModeHandlers) => {
  hifdhHandlers = h;
};
let lastErrorFor = '';

export async function initAudio() {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      // Nécessaire pour les commandes sur l'écran verrouillé
      interruptionMode: 'doNotMix',
    });
  } catch {
    // web : pas de mode audio à configurer
  }
}

export const isAvailable = (r: Reciter, n: number) => r.kb[n - 1] > 0;

function nextAvailable(r: Reciter, from: number, dir: 1 | -1): number | null {
  for (let n = from + dir; n >= 1 && n <= 114; n += dir) if (isAvailable(r, n)) return n;
  return null;
}

export function playSurah(n: number, opts: { startAt?: number; reciter?: Reciter } = {}) {
  const r = opts.reciter ?? getReciter(useSettings.getState().reciterId);
  if (!isAvailable(r, n)) {
    toast(getT().notAvailable);
    return;
  }
  const s = SURAHS[n - 1];
  pendingSeek = opts.startAt && opts.startAt > 0 ? opts.startAt : null;
  lastErrorFor = '';
  player.replace({ uri: sourceUri(r, n) });
  player.setPlaybackRate(useSettings.getState().rate);
  player.play();
  usePlayer.setState({ mode: 'surah', surah: n, reciterId: r.id, currentTime: 0, duration: 0, playing: true, failed: false });
  const ar = useSettings.getState().lang === 'ar';
  try {
    player.setActiveForLockScreen(
      true,
      { title: ar ? `سورة ${s.ar}` : `${s.tr} — ${s.ar}`, artist: ar ? r.ar : r.fr, albumTitle: 'Wirdan', artworkUrl: ARTWORK },
      { showSeekBackward: true, showSeekForward: true },
    );
  } catch {
    // web
  }
}

export function togglePlay() {
  const { surah, failed, mode, reciterId } = usePlayer.getState();
  if (!surah) return playSurah(1);
  // Après un échec (connexion revenue entre-temps), on recharge au lieu de relancer un lecteur en erreur
  if (failed && mode === 'surah') return playSurah(surah, { reciter: getReciter(reciterId ?? useSettings.getState().reciterId) });
  if (player.playing) player.pause();
  else player.play();
}

export function step(dir: 1 | -1) {
  if (usePlayer.getState().mode === 'hifdh') return hifdhHandlers?.step(dir);
  const { surah, reciterId } = usePlayer.getState();
  const r = getReciter(reciterId ?? useSettings.getState().reciterId);
  const n = nextAvailable(r, surah ?? 0, dir);
  if (n) playSurah(n, { reciter: r });
}

export function seekTo(sec: number) {
  player.seekTo(Math.max(0, sec)).catch(() => {});
}

export function setRate(rate: number) {
  useSettings.getState().set({ rate });
  player.setPlaybackRate(rate);
}

/** Changement de récitateur : la sourate en cours reprend avec la nouvelle voix. */
export function onReciterChanged(id: string) {
  const { surah } = usePlayer.getState();
  const r = RECITERS.find(x => x.id === id);
  if (surah && r && player.playing && isAvailable(r, surah)) playSurah(surah, { reciter: r });
}

player.addListener('playbackStatusUpdate', (st: AudioStatus) => {
  usePlayer.setState({
    failed: usePlayer.getState().failed || !!st.error, // remis à zéro par playSurah()
    playing: st.playing,
    buffering: st.isBuffering,
    currentTime: st.currentTime,
    duration: st.duration || usePlayer.getState().duration,
  });
  if (st.isLoaded && pendingSeek !== null) {
    const at = pendingSeek;
    pendingSeek = null;
    seekTo(at);
  }
  const { surah, reciterId, mode } = usePlayer.getState();
  if (mode === 'hifdh') {
    if (st.error && hifdhHandlers?.onError()) return;
    if (st.didJustFinish) hifdhHandlers?.onFinish();
  }
  if (st.error && surah) {
    const key = `${reciterId}:${surah}`;
    if (lastErrorFor !== key) {
      lastErrorFor = key;
      toast(getT().playbackError);
    }
  }
  if (mode !== 'surah') return;
  if (st.didJustFinish && surah) {
    const { repeat, autoNext, autoSave } = useSettings.getState();
    const r = getReciter(reciterId ?? useSettings.getState().reciterId);
    if (repeat) {
      seekTo(0);
      player.play();
    } else if (autoNext) {
      const n = nextAvailable(r, surah, 1);
      if (n) {
        if (autoSave) downloadSurah(r, nextAvailable(r, n, 1) ?? n);
        playSurah(n, { reciter: r });
      }
    }
  }
  // Garder automatiquement la sourate écoutée (et la suivante) pour l'écoute hors connexion
  if (st.playing && surah && useSettings.getState().autoSave) {
    const r = getReciter(reciterId ?? useSettings.getState().reciterId);
    downloadSurah(r, surah);
  }
});
