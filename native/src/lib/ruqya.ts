import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Lang } from '@/stores/settings';
import { zustandStorage } from '@/lib/storage';

// Ruqya shar'iyya : catégories (versets, invocations, chapitres de Hisn al-Muslim) et
// questionnaire d'orientation. Données : assets/data/ruqya.json (aussi utilisées par le site).
type Txt2 = Record<Lang, string>;
export type RuqyaCategory = {
  id: string;
  icon: string;
  title: Txt2;
  desc: Txt2;
  /** [sourate, premier verset, dernier verset] */
  verses: [number, number, number][];
  note: Txt2;
  duas: { text: string; source: Txt2 }[];
  /** Chapitres de Hisn al-Muslim liés (voir assets/data/adhkar.json) */
  hisn: number[];
};
export type RuqyaQuestion = { id: string; text: Txt2; weights: Record<string, number> };
type RuqyaData = {
  disclaimer: Txt2;
  method: Record<Lang, string[]>;
  categories: RuqyaCategory[];
  questions: RuqyaQuestion[];
};

let data: RuqyaData | null = null;
export function getRuqya(): RuqyaData {
  if (!data) data = require('../../assets/data/ruqya.json') as RuqyaData;
  return data;
}

/** Réponses : 0 = non, 1 = parfois, 2 = souvent. */
export type Answer = 0 | 1 | 2;
const THRESHOLD = 2;

/**
 * Catégories suggérées d'après les réponses, de la plus marquée à la moins marquée.
 * La ruqya de base est toujours proposée en premier ; ce n'est qu'une orientation.
 */
export function suggest(answers: Record<string, Answer>): string[] {
  const scores: Record<string, number> = {};
  for (const q of getRuqya().questions) {
    const a = answers[q.id] ?? 0;
    for (const [cat, w] of Object.entries(q.weights)) scores[cat] = (scores[cat] ?? 0) + a * w;
  }
  const found = Object.entries(scores)
    .filter(([, s]) => s >= THRESHOLD)
    .sort((x, y) => y[1] - x[1])
    .map(([cat]) => cat);
  return ['base', ...found];
}

/** Dernières réponses, pour retrouver ses résultats sans refaire le questionnaire. */
export const useRuqya = create<{ answers: Record<string, Answer> | null; save: (a: Record<string, Answer>) => void; clear: () => void }>()(
  persist(
    set => ({
      answers: null,
      save: answers => set({ answers }),
      clear: () => set({ answers: null }),
    }),
    { name: 'ruqya', storage: zustandStorage, version: 1 },
  ),
);
