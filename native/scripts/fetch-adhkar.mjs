// Construit assets/data/adhkar.json à partir de l'API officielle de Hisn al-Muslim
// (https://www.hisnmuslim.com/api/ar/husn_ar.json) : 132 chapitres, texte arabe, nombre de
// répétitions et audio de chaque dhikr. Inclus dans l'app pour fonctionner hors connexion.
// Usage : node scripts/fetch-adhkar.mjs [dossier-cache]   (dossier contenant husn_ar.json et ch/<id>.json)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const cache = process.argv[2];
const API = 'https://www.hisnmuslim.com/api/ar';
const https = u => (u || '').replace(/^http:\/\//, 'https://');
const parse = text => JSON.parse(text.replace(/^﻿/, ''));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(name, url) {
  if (cache && existsSync(join(cache, name))) return parse(readFileSync(join(cache, name), 'utf8'));
  await sleep(200); // requêtes espacées, pour ne pas surcharger le site
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} : ${res.status}`);
  return parse(await res.text());
}

const index = (await get('husn_ar.json', `${API}/husn_ar.json`))['العربية'];
const chapters = [];
for (const c of index) {
  const data = await get(`ch/${c.ID}.json`, `${API}/${c.ID}.json`);
  const items = Object.values(data)[0];
  chapters.push({
    id: c.ID,
    title: c.TITLE.trim(),
    audio: https(c.AUDIO_URL),
    items: items.map(it => ({ id: it.ID, text: it.ARABIC_TEXT.trim(), repeat: Math.max(1, +it.REPEAT || 1), audio: https(it.AUDIO) })),
  });
}
writeFileSync(new URL('../assets/data/adhkar.json', import.meta.url), JSON.stringify(chapters));
console.log(`${chapters.length} chapitres, ${chapters.reduce((s, c) => s + c.items.length, 0)} adhkar`);
