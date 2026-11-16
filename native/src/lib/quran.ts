import { kv } from '@/lib/kv';

// Texte Uthmani complet (114 sourates × versets), inclus dans l'application : lecture hors ligne.
// Chargé au premier besoin seulement (require paresseux) pour ne pas ralentir le démarrage.
let quran: string[][] | null = null;
export function getQuran(): string[][] {
  if (!quran) quran = require('../../assets/data/quran-text.json') as string[][];
  return quran;
}

const bare = (s: string) => s.replace(/[ً-ٰۖ-ۭ]/g, '');
export const stripTashkeel = (s: string) => s.replace(/[ً-ٰٟۖ-ۭ]/g, '').replace(/ٱ/g, 'ا');

export const basmala = () => getQuran()[0][0];

/**
 * Versets d'une sourate, sans la Basmala : le texte source la colle au début du verset 1 (sauf
 * Al-Fatiha, où elle est le verset 1, et At-Tawba, qui n'en a pas). Elle varie parfois d'un signe
 * diacritique (ex. 95, 97) : on compare donc les 4 premiers mots sans voyelles.
 */
export function surahVerses(n: number): { verses: string[]; hasBasmala: boolean } {
  const verses = getQuran()[n - 1].slice();
  if (n === 1 || n === 9) return { verses, hasBasmala: false };
  const words = verses[0].split(' ');
  if (bare(words.slice(0, 4).join(' ')) === bare(basmala())) verses[0] = words.slice(4).join(' ');
  return { verses, hasBasmala: true };
}

/** Traduction française (Hamidullah) ou Tafsir Al-Muyassar, gardés sur l'appareil après le 1er chargement. */
export async function loadExtra(n: number, kind: 'fr' | 'tafsir'): Promise<string[]> {
  const ed = kind === 'fr' ? 'fr.hamidullah' : 'ar.muyassar';
  const key = `extra:${ed}:${n}`;
  const cached = kv.get(key);
  if (cached) return JSON.parse(cached);
  const res = await fetch(`https://api.alquran.cloud/v1/surah/${n}/${ed}`);
  const json = await res.json();
  const texts: string[] = (json?.data?.ayahs ?? []).map((a: { text: string }) => a.text);
  if (!texts.length) throw new Error('vide');
  kv.set(key, JSON.stringify(texts));
  return texts;
}

/**
 * Début exact de chaque verset (ms) dans le fichier mp3quran.net du récitateur, quand il a été
 * calculé par scripts/align_quran.py (publié sur wirdan.app). null si indisponible.
 */
const timingCache = new Map<string, Promise<{ a: number; from: number }[] | null>>();
export function loadTimings(reciterId: string, n: number) {
  const key = `${reciterId}:${n}`;
  if (!timingCache.has(key)) {
    const dir = reciterId.replace(/[^a-zA-Z0-9_.-]+/g, '_');
    timingCache.set(
      key,
      fetch(`https://wirdan.app/scripts/timings/${dir}/${n}.json`)
        .then(r => (r.ok ? r.json() : null))
        .then((d: { ayahs?: Record<string, { from: number }[]> } | null) =>
          d?.ayahs
            ? Object.entries(d.ayahs)
                .filter(([, w]) => w.length)
                .map(([a, w]) => ({ a: +a, from: w[0].from }))
                .sort((x, y) => x.a - y.a)
            : null,
        )
        .catch(() => {
          timingCache.delete(key); // réessayer plus tard (hors ligne)
          return null;
        }),
    );
  }
  return timingCache.get(key)!;
}

/** Répartition estimée des versets dans la durée (proportionnelle à leur longueur), Basmala comprise. */
const ratioCache = new Map<number, number[]>();
export function verseStartRatios(n: number): number[] {
  if (!ratioCache.has(n)) {
    const lens = getQuran()[n - 1].map(a => a.replace(/\s+/g, '').length || 1);
    const total = lens.reduce((s, l) => s + l, 0);
    let acc = 0;
    ratioCache.set(
      n,
      lens.map(l => {
        const from = acc / total;
        acc += l;
        return from;
      }),
    );
  }
  return ratioCache.get(n)!;
}
