import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';
import { norm } from '@/lib/text';
import { today } from '@/stores/reading';

// Hisn al-Muslim (API officielle hisnmuslim.com), inclus dans l'app : voir scripts/fetch-adhkar.mjs
export type Dhikr = { id: number; text: string; repeat: number; audio: string };
export type Chapter = { id: number; title: string; audio: string; items: Dhikr[] };

let chapters: Chapter[] | null = null;
export function getChapters(): Chapter[] {
  if (!chapters) chapters = require('../../assets/data/adhkar.json') as Chapter[];
  return chapters;
}
export const getChapter = (id: number) => getChapters().find(c => c.id === id);

/** Chapitres mis en avant (dans cet ordre) sur l'écran des adhkar. */
export const FEATURED: { id: number; icon: 'sunny' | 'moon' | 'bed' | 'alarm' | 'hand-left' | 'refresh' | 'sparkles' | 'heart' }[] = [
  { id: 27, icon: 'sunny' }, // matin et soir
  { id: 28, icon: 'bed' }, // sommeil
  { id: 1, icon: 'alarm' }, // réveil
  { id: 25, icon: 'hand-left' }, // après la prière
  { id: 129, icon: 'refresh' }, // istighfar
  { id: 130, icon: 'sparkles' }, // tasbih
  { id: 34, icon: 'heart' }, // soucis et tristesse
];

let searchIndex: string[] | null = null;
export function searchChapters(q: string): Chapter[] {
  const all = getChapters();
  const nq = norm(q);
  if (!nq) return all;
  searchIndex ??= all.map(c => norm(`${c.title} ${c.items.map(i => i.text).join(' ')}`));
  return all.filter((_, i) => searchIndex![i].includes(nq));
}

/** Compteurs du jour (remis à zéro chaque jour) : id du dhikr → nombre de fois récité. */
type AdhkarState = {
  day: string;
  counts: Record<number, number>;
  increment: (d: Dhikr) => void;
  /** Annule la dernière répétition (erreur de toucher) */
  decrement: (d: Dhikr) => void;
  resetChapter: (c: Chapter) => void;
};

export const useAdhkar = create<AdhkarState>()(
  persist(
    (set, get) => ({
      day: today(),
      counts: {},
      increment: d => {
        const fresh = get().day !== today();
        const counts = fresh ? {} : { ...get().counts };
        counts[d.id] = Math.min(d.repeat, (counts[d.id] ?? 0) + 1);
        set({ day: today(), counts });
      },
      decrement: d => {
        if (get().day !== today()) return;
        const counts = { ...get().counts };
        const n = (counts[d.id] ?? 0) - 1;
        if (n > 0) counts[d.id] = n;
        else delete counts[d.id];
        set({ counts });
      },
      resetChapter: c => {
        const counts = { ...get().counts };
        for (const d of c.items) delete counts[d.id];
        set({ counts });
      },
    }),
    { name: 'adhkar', storage: zustandStorage, version: 1 },
  ),
);

/** Nombre de fois récité aujourd'hui (0 si le compteur date d'un autre jour). */
export const useCount = (id: number) => useAdhkar(s => (s.day === today() ? (s.counts[id] ?? 0) : 0));

export function chapterProgress(c: Chapter, counts: Record<number, number>, day: string) {
  const fresh = day !== today();
  const n = (d: Dhikr) => (fresh ? 0 : Math.min(d.repeat, counts[d.id] ?? 0));
  return {
    done: c.items.filter(d => n(d) >= d.repeat).length,
    total: c.items.length,
    // Répétitions faites / à faire sur toute la section (avancement plus fin que le nombre d'adhkar)
    reps: c.items.reduce((s, d) => s + n(d), 0),
    totalReps: c.items.reduce((s, d) => s + d.repeat, 0),
    /** Premier dhikr pas encore terminé (pour « Reprendre ») */
    nextIndex: c.items.findIndex(d => n(d) < d.repeat),
  };
}
