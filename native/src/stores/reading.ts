import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { SURAHS } from '@/data/surahs';
import { fromAbs, TOTAL, toAbs, unitAt, type WirdUnit } from '@/lib/divisions';
import { zustandStorage } from '@/lib/storage';

export const TOTAL_AYAT = 6236;
export const GOALS = [5, 10, 20, 50, 100, 208]; // 208 ≈ un juz' (6236 / 30)
export const READER_SIZES = [20, 23, 26, 29, 32, 36, 40, 46];

export type Bookmark = { n: number; a: number; ts: number };
export type ReaderPrefs = {
  size: number; // index dans READER_SIZES
  theme: 'app' | 'light' | 'sepia' | 'night';
  layout: 'flow' | 'verse';
  extra: 'none' | 'fr' | 'tafsir';
  tashkeel: boolean;
  spacing: 'normal' | 'airy';
  follow: boolean;
  keepAwake: boolean;
};

type ReadingState = {
  /** Versets lus : une chaîne de '0'/'1' par sourate (index = verset - 1). */
  read: Record<number, string>;
  bookmarks: Bookmark[];
  /** Nombre de versets nouvellement lus par jour (AAAA-MM-JJ), pour l'objectif et la série. */
  days: Record<string, number>;
  goal: number;
  /** Unité du wird quotidien : un nombre de versets, ou une division du Mushaf (thumun, hizb…) */
  goalUnit: WirdUnit;
  /** Passage du wird du jour (index absolus inclus), fixé pour la journée */
  wird: { day: string; unit: WirdUnit; start: number; end: number } | null;
  khatmas: number;
  lastPos: { n: number; a: number } | null;
  prefs: ReaderPrefs;
  markRange: (n: number, from: number, to: number, value?: boolean) => number;
  toggleBookmark: (n: number, a: number) => boolean;
  removeBookmark: (n: number, a: number) => void;
  setLastPos: (n: number, a: number) => void;
  setGoal: (goal: number) => void;
  setGoalUnit: (unit: WirdUnit) => void;
  /** Calcule (une fois par jour) le passage du wird à partir de la dernière position lue */
  ensureWird: () => void;
  setPrefs: (patch: Partial<ReaderPrefs>) => void;
  resetKhatma: () => void;
};

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => dayKey(new Date());

const bitsOf = (read: Record<number, string>, n: number) => {
  const v = SURAHS[n - 1].verses;
  return (read[n] ?? '').padEnd(v, '0').slice(0, v);
};

export const useReading = create<ReadingState>()(
  persist(
    (set, get) => ({
      read: {},
      bookmarks: [],
      days: {},
      goal: 20,
      goalUnit: 'verses',
      wird: null,
      khatmas: 0,
      lastPos: null,
      prefs: {
        size: 3,
        theme: 'app',
        layout: 'flow',
        extra: 'none',
        tashkeel: true,
        spacing: 'normal',
        follow: true,
        keepAwake: false,
      },

      markRange: (n, from, to, value = true) => {
        const v = SURAHS[n - 1].verses;
        from = Math.max(1, from);
        to = Math.min(v, to);
        if (to < from) return 0;
        const { read, days } = get();
        const before = bitsOf(read, n);
        const b = before.split('');
        const ch = value ? '1' : '0';
        let added = 0;
        for (let a = from; a <= to; a++) {
          if (b[a - 1] !== ch) {
            if (value) added++;
            b[a - 1] = ch;
          }
        }
        const s = b.join('');
        if (s === before) return 0;
        const nextRead = { ...read };
        if (s.includes('1')) nextRead[n] = s;
        else delete nextRead[n];
        let nextDays = days;
        if (added) {
          const d = today();
          nextDays = { ...days, [d]: (days[d] ?? 0) + added };
          const keys = Object.keys(nextDays).sort();
          for (const k of keys.slice(0, Math.max(0, keys.length - 400))) delete nextDays[k];
        }
        set({ read: nextRead, days: nextDays });
        return added;
      },

      toggleBookmark: (n, a) => {
        const { bookmarks } = get();
        const exists = bookmarks.some(b => b.n === n && b.a === a);
        set({
          bookmarks: exists
            ? bookmarks.filter(b => !(b.n === n && b.a === a))
            : [...bookmarks, { n, a, ts: Date.now() }],
        });
        return !exists;
      },
      removeBookmark: (n, a) => set({ bookmarks: get().bookmarks.filter(b => !(b.n === n && b.a === a)) }),
      setLastPos: (n, a) => {
        const p = get().lastPos;
        if (p?.n !== n || p?.a !== a) set({ lastPos: { n, a } });
      },
      setGoal: goal => set({ goal }),
      setGoalUnit: goalUnit => {
        set({ goalUnit, wird: null });
        get().ensureWird();
      },
      ensureWird: () => {
        const { goalUnit, wird, lastPos, read } = get();
        if (goalUnit === 'verses') return;
        if (wird && wird.day === today() && wird.unit === goalUnit) return;
        // On reprend là où l'on s'est arrêté ; une division déjà entièrement lue est sautée
        let u = unitAt(goalUnit, lastPos ? toAbs(lastPos.n, lastPos.a) : 0);
        while (rangeRead(read, u.start, u.end) === u.end - u.start + 1 && u.end < TOTAL - 1) u = unitAt(goalUnit, u.end + 1);
        set({ wird: { day: today(), unit: goalUnit, start: u.start, end: u.end } });
      },
      setPrefs: patch => set({ prefs: { ...get().prefs, ...patch } }),
      resetKhatma: () => {
        const complete = totalRead(get().read) === TOTAL_AYAT;
        set({ read: {}, khatmas: get().khatmas + (complete ? 1 : 0) });
      },
    }),
    { name: 'reading', storage: zustandStorage, version: 1 },
  ),
);

export const readCount = (read: Record<number, string>, n: number) => {
  const s = read[n];
  return s ? s.split('1').length - 1 : 0;
};
export const totalRead = (read: Record<number, string>) => {
  let c = 0;
  for (let n = 1; n <= 114; n++) c += readCount(read, n);
  return c;
};
export const surahsDone = (read: Record<number, string>) =>
  SURAHS.filter(s => readCount(read, s.n) === s.verses).length;

export function streak(days: Record<string, number>) {
  const d = new Date();
  if (!days[today()]) d.setDate(d.getDate() - 1); // la série n'est pas perdue avant la fin de la journée
  let s = 0;
  while (days[dayKey(d)]) {
    s++;
    d.setDate(d.getDate() - 1);
  }
  return s;
}

/** Nombre de versets lus dans un passage (index absolus inclus). */
export function rangeRead(read: Record<number, string>, start: number, end: number) {
  let c = 0;
  for (let i = start; i <= end; i++) {
    const { n, a } = fromAbs(i);
    if (read[n]?.[a - 1] === '1') c++;
  }
  return c;
}

/** Premier verset non lu du passage (ou son début s'il est entièrement lu). */
export function firstUnread(read: Record<number, string>, start: number, end: number) {
  for (let i = start; i <= end; i++) {
    const { n, a } = fromAbs(i);
    if (read[n]?.[a - 1] !== '1') return { n, a };
  }
  return fromAbs(start);
}
