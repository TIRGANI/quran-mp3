/** Normalise pour la recherche : minuscules, sans accents latins, sans voyelles arabes, alif unifié. */
export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ'’\-]/g, '')
    .replace(/[ً-ٰٟۖ-ۭ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();

export const fmtTime = (sec: number) =>
  Number.isFinite(sec) && sec > 0 ? `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}` : '0:00';
