import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { RECITERS } from '@/data/reciters';
import { zustandStorage } from '@/lib/storage';

export type Lang = 'ar' | 'fr';
export type ThemePref = 'system' | 'light' | 'dark';
export type Reminder = { on: boolean; hour: number; minute: number };
export type ReminderKey = 'wird' | 'morning' | 'evening' | 'sleep' | 'kahf';
export const DEFAULT_REMINDERS: Record<ReminderKey, Reminder> = {
  wird: { on: false, hour: 20, minute: 0 },
  morning: { on: false, hour: 6, minute: 30 },
  evening: { on: false, hour: 17, minute: 30 },
  sleep: { on: false, hour: 22, minute: 30 },
  kahf: { on: false, hour: 10, minute: 0 }, // chaque vendredi
};

type SettingsState = {
  lang: Lang;
  theme: ThemePref;
  reciterId: string;
  rate: number;
  autoNext: boolean; // enchaîner les sourates
  repeat: boolean; // répéter la sourate
  autoSave: boolean; // garder hors ligne les sourates écoutées
  reminders: Record<ReminderKey, Reminder>;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    set => ({
      lang: 'ar', // arabe par défaut, comme sur le site
      theme: 'system',
      reciterId: RECITERS[0].id,
      rate: 1,
      autoNext: true,
      repeat: false,
      autoSave: false,
      reminders: DEFAULT_REMINDERS,
      set: patch => set(patch),
    }),
    {
      name: 'settings',
      storage: zustandStorage,
      version: 1,
      // Nouveaux rappels ajoutés plus tard : complétés avec leurs valeurs par défaut
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return { ...current, ...p, reminders: { ...DEFAULT_REMINDERS, ...p.reminders } };
      },
    },
  ),
);

export const getReciter = (id: string) => RECITERS.find(r => r.id === id) ?? RECITERS[0];
export const useReciter = () => getReciter(useSettings(s => s.reciterId));
