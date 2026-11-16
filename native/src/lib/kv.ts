import Storage from 'expo-sqlite/kv-store';

// Stockage clé-valeur persistant (SQLite sur iOS / Android), API synchrone : l'état est
// disponible dès le premier rendu, sans écran de chargement. Version web : kv.web.ts.
export const kv = {
  get: (key: string): string | null => Storage.getItemSync(key),
  set: (key: string, value: string) => Storage.setItemSync(key, value),
  remove: (key: string) => Storage.removeItemSync(key),
};
