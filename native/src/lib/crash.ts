import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { kv } from '@/lib/kv';

// Filet de sécurité : dans une application publiée, une erreur JavaScript non rattrapée ferme
// l'app d'un coup, sans message. On l'intercepte : l'erreur est enregistrée sur le téléphone
// (pour être jointe à « Donner mon avis ») et un écran de reprise s'affiche à la place.
export type CrashInfo = { message: string; stack: string; time: string; version: string; platform: string };

export const useCrash = create<{ error: CrashInfo | null }>(() => ({ error: null }));

const KEY = 'lastCrash';
export function lastCrash(): CrashInfo | null {
  try {
    const raw = kv.get(KEY);
    return raw ? (JSON.parse(raw) as CrashInfo) : null;
  } catch {
    return null;
  }
}
export const clearCrash = () => kv.remove(KEY);

export function recordError(e: unknown): CrashInfo {
  const err = e instanceof Error ? e : new Error(String(e));
  const info: CrashInfo = {
    message: err.message.slice(0, 300),
    stack: (err.stack ?? '').split('\n').slice(0, 8).join('\n').slice(0, 1200),
    time: new Date().toISOString(),
    version: Constants.expoConfig?.version ?? '',
    platform: `${Platform.OS} ${Platform.Version}`,
  };
  try {
    kv.set(KEY, JSON.stringify(info));
  } catch {
    // stockage indisponible : tant pis pour l'enregistrement
  }
  return info;
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsType = { getGlobalHandler: () => GlobalHandler; setGlobalHandler: (h: GlobalHandler) => void };

/** À appeler une fois au démarrage (hors web). */
export function installCrashGuard() {
  const EU = (globalThis as { ErrorUtils?: ErrorUtilsType }).ErrorUtils;
  if (!EU || Platform.OS === 'web') return;
  const previous = EU.getGlobalHandler();
  EU.setGlobalHandler((error, isFatal) => {
    const info = recordError(error);
    if (__DEV__) return previous(error, isFatal); // en développement : l'écran rouge habituel
    // En production : on garde l'app ouverte et on affiche l'écran de reprise
    if (isFatal) useCrash.setState({ error: info });
  });
}
