import { getQuran } from '@/lib/quran';

// Divisions du Coran pour le wird quotidien : juz, hizb, demi-hizb, rub' (= 2 athman),
// thumun et demi-thumun. Les 240 quarts de hizb viennent des métadonnées Tanzil
// (numérotation Hafs, assets/data/rub.json) ; hizb, demi-hizb et juz en sont des regroupements
// exacts. Les athman (1/8 de hizb) et demi-athman n'existant pas dans ces métadonnées, ils sont
// calculés en coupant chaque division au verset le plus proche de sa moitié (en nombre de lettres).
export type WirdUnit = 'verses' | 'nisfThumun' | 'thumun' | 'rub' | 'nisfHizb' | 'hizb' | 'juz';
export const WIRD_UNITS: WirdUnit[] = ['nisfThumun', 'thumun', 'rub', 'nisfHizb', 'hizb', 'juz'];

let offsets: number[] | null = null; // index absolu (0..6235) du 1er verset de chaque sourate
function surahOffsets() {
  if (!offsets) {
    offsets = [];
    let acc = 0;
    for (const s of getQuran()) {
      offsets.push(acc);
      acc += s.length;
    }
  }
  return offsets;
}
export const TOTAL = 6236;
export const toAbs = (n: number, a: number) => surahOffsets()[n - 1] + a - 1;
export function fromAbs(i: number): { n: number; a: number } {
  const o = surahOffsets();
  let n = 1;
  while (n < 114 && o[n] <= i) n++;
  return { n, a: i - o[n - 1] + 1 };
}

let letters: number[] | null = null; // nombre de lettres de chaque verset (index absolu)
function verseLetters() {
  if (!letters) letters = getQuran().flat().map(v => v.replace(/[\sً-ٰٟۖ-ۭ]/g, '').length || 1);
  return letters;
}

/** Ajoute le milieu (au verset près, en lettres) de chaque intervalle entre deux débuts. */
function withMidpoints(starts: number[]): number[] {
  const L = verseLetters();
  const out: number[] = [];
  starts.forEach((s, k) => {
    out.push(s);
    const e = k + 1 < starts.length ? starts[k + 1] : TOTAL;
    let total = 0;
    for (let i = s; i < e; i++) total += L[i];
    let acc = 0;
    for (let i = s; i < e; i++) {
      acc += L[i];
      if (acc >= total / 2) {
        if (i + 1 < e) out.push(i + 1);
        break;
      }
    }
  });
  return out;
}

const cache = new Map<WirdUnit, number[]>();
/** Index absolus des débuts de chaque division. */
export function boundaries(unit: Exclude<WirdUnit, 'verses'>): number[] {
  if (!cache.has(unit)) {
    const rub = (require('../../assets/data/rub.json') as [number, number][]).map(([n, a]) => toAbs(n, a));
    const every = (k: number) => rub.filter((_, i) => i % k === 0);
    const map: Record<Exclude<WirdUnit, 'verses'>, () => number[]> = {
      juz: () => every(8),
      hizb: () => every(4),
      nisfHizb: () => every(2),
      rub: () => rub,
      thumun: () => withMidpoints(rub),
      nisfThumun: () => withMidpoints(withMidpoints(rub)),
    };
    cache.set(unit, map[unit]());
  }
  return cache.get(unit)!;
}

/** Division (début / fin inclus, index absolus) qui contient le verset `pos`. */
export function unitAt(unit: Exclude<WirdUnit, 'verses'>, pos: number): { start: number; end: number; index: number } {
  const b = boundaries(unit);
  let k = 0;
  while (k + 1 < b.length && b[k + 1] <= pos) k++;
  return { start: b[k], end: (k + 1 < b.length ? b[k + 1] : TOTAL) - 1, index: k };
}
