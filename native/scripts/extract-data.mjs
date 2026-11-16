// Génère src/data/surahs.ts et src/data/reciters.ts à partir du site (../index.html),
// pour que l'application et le site partagent exactement les mêmes listes.
// Usage : node scripts/extract-data.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const grab = (start, end) => {
  const i = html.indexOf(start); if (i < 0) throw new Error('introuvable : ' + start);
  return html.slice(i + start.length, html.indexOf(end, i));
};
const S = Function('return [' + grab('const S = [', '\n    ];') + ']')();
const MEDINAN = Function('return [' + grab('const MEDINAN = new Set([', ']);') + ']')();
const R = Function('return [' + grab('const RECITERS = [', '\n    ].map') + ']')();

const surahs = S.map(([tr, ar, fr, v], i) => ({ n: i + 1, tr, ar, fr, verses: v, medinan: MEDINAN.includes(i + 1) }));
writeFileSync(new URL('../src/data/surahs.ts', import.meta.url),
  `// Généré par scripts/extract-data.mjs — ne pas modifier à la main.\n` +
  `export type Surah = { n: number; tr: string; ar: string; fr: string; verses: number; medinan: boolean };\n\n` +
  `export const SURAHS: Surah[] = ${JSON.stringify(surahs, null, 0).replace(/\},\{/g, '},\n  {')};\n`);

const reciters = R.map(([id, fr, ar, w, photo, kb]) => ({
  id, fr, ar, warsh: w === 'w', photo,
  base: id.startsWith('https:') ? `${id}/` : `https://cdn.mp3quran.net/audio/${id}/`,
  kb: kb.split(',').map(Number),
}));
const photos = [...new Set(reciters.map(r => r.photo).filter(Boolean))];
writeFileSync(new URL('../src/data/reciters.ts', import.meta.url),
  `// Généré par scripts/extract-data.mjs — ne pas modifier à la main.\n` +
  `// kb : taille de chaque MP3 en Ko (0 = sourate absente pour ce récitateur).\n` +
  `export type Reciter = { id: string; fr: string; ar: string; warsh: boolean; photo: string; base: string; kb: number[] };\n\n` +
  `export const RECITERS: Reciter[] = [\n${reciters.map(r => '  ' + JSON.stringify(r)).join(',\n')},\n];\n\n` +
  `export const RECITER_PHOTOS: Record<string, number> = {\n${photos.map(p => `  ${JSON.stringify(p)}: require('../../assets/reciters/${p}.webp'),`).join('\n')}\n};\n`);
console.log(`${surahs.length} sourates, ${reciters.length} récitateurs, ${photos.length} photos`);
