import { CalculationMethod, CalculationParameters, Coordinates, Madhab, PrayerTimes } from 'adhan';
import * as Location from 'expo-location';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';

// Horaires de prière calculés sur le téléphone (bibliothèque adhan, hors connexion) à partir de
// la position de l'utilisateur. Méthode « Maroc » : Fajr 19°, Isha 17° (angles utilisés par le
// ministère des Habous) ; chaque prière peut être décalée de quelques minutes pour coller aux
// horaires de la mosquée locale.
export const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerName = (typeof PRAYERS)[number];
/** Prières pouvant donner lieu à une notification (le lever du soleil n'est pas une prière) */
export const SALAT = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type SalatName = (typeof SALAT)[number];

export type MethodId =
  | 'morocco'
  | 'mwl'
  | 'egyptian'
  | 'ummalqura'
  | 'dubai'
  | 'kuwait'
  | 'qatar'
  | 'turkey'
  | 'karachi'
  | 'isna'
  | 'france'
  | 'singapore';

export const METHODS: { id: MethodId; fr: string; ar: string }[] = [
  { id: 'morocco', fr: 'Maroc (Fajr 19°, Isha 17°)', ar: 'المغرب (الفجر 19°، العشاء 17°)' },
  { id: 'mwl', fr: 'Ligue islamique mondiale', ar: 'رابطة العالم الإسلامي' },
  { id: 'egyptian', fr: 'Égypte', ar: 'الهيئة المصرية' },
  { id: 'ummalqura', fr: 'Umm al-Qura (La Mecque)', ar: 'أم القرى (مكة)' },
  { id: 'dubai', fr: 'Dubaï', ar: 'دبي' },
  { id: 'kuwait', fr: 'Koweït', ar: 'الكويت' },
  { id: 'qatar', fr: 'Qatar', ar: 'قطر' },
  { id: 'turkey', fr: 'Turquie (Diyanet)', ar: 'تركيا' },
  { id: 'karachi', fr: 'Karachi', ar: 'كراتشي' },
  { id: 'isna', fr: 'Amérique du Nord (ISNA)', ar: 'أمريكا الشمالية' },
  { id: 'france', fr: 'France (UOIF, 12°)', ar: 'فرنسا (12°)' },
  { id: 'singapore', fr: 'Singapour', ar: 'سنغافورة' },
];

function params(method: MethodId): CalculationParameters {
  switch (method) {
    case 'morocco':
      return new CalculationParameters('Other', 19, 17);
    case 'france':
      return new CalculationParameters('Other', 12, 12);
    case 'mwl':
      return CalculationMethod.MuslimWorldLeague();
    case 'egyptian':
      return CalculationMethod.Egyptian();
    case 'ummalqura':
      return CalculationMethod.UmmAlQura();
    case 'dubai':
      return CalculationMethod.Dubai();
    case 'kuwait':
      return CalculationMethod.Kuwait();
    case 'qatar':
      return CalculationMethod.Qatar();
    case 'turkey':
      return CalculationMethod.Turkey();
    case 'karachi':
      return CalculationMethod.Karachi();
    case 'isna':
      return CalculationMethod.NorthAmerica();
    case 'singapore':
      return CalculationMethod.Singapore();
  }
}

/** Grandes villes, si l'utilisateur préfère ne pas partager sa position */
export const CITIES: { fr: string; ar: string; lat: number; lng: number }[] = [
  { fr: 'Casablanca', ar: 'الدار البيضاء', lat: 33.5731, lng: -7.5898 },
  { fr: 'Rabat', ar: 'الرباط', lat: 34.0209, lng: -6.8416 },
  { fr: 'Fès', ar: 'فاس', lat: 34.0181, lng: -5.0078 },
  { fr: 'Marrakech', ar: 'مراكش', lat: 31.6295, lng: -7.9811 },
  { fr: 'Tanger', ar: 'طنجة', lat: 35.7595, lng: -5.834 },
  { fr: 'Agadir', ar: 'أكادير', lat: 30.4278, lng: -9.5981 },
  { fr: 'Meknès', ar: 'مكناس', lat: 33.8935, lng: -5.5473 },
  { fr: 'Oujda', ar: 'وجدة', lat: 34.6814, lng: -1.9086 },
  { fr: 'Tétouan', ar: 'تطوان', lat: 35.5785, lng: -5.3684 },
  { fr: 'Laâyoune', ar: 'العيون', lat: 27.1253, lng: -13.1625 },
  { fr: 'Paris', ar: 'باريس', lat: 48.8566, lng: 2.3522 },
  { fr: 'Bruxelles', ar: 'بروكسل', lat: 50.8503, lng: 4.3517 },
  { fr: 'Alger', ar: 'الجزائر', lat: 36.7538, lng: 3.0588 },
  { fr: 'Tunis', ar: 'تونس', lat: 36.8065, lng: 10.1815 },
  { fr: 'La Mecque', ar: 'مكة المكرمة', lat: 21.3891, lng: 39.8579 },
];

type PrayerSettings = {
  place: { lat: number; lng: number; label: string } | null;
  method: MethodId;
  hanafi: boolean; // Asr selon l'école hanafite (ombre ×2)
  /** Décalage en minutes de chaque prière (pour coller aux horaires de la mosquée) */
  offsets: Record<PrayerName, number>;
  /** Notifications de prière activées (demande l'autorisation à l'activation) */
  adhanOn: boolean;
  /** Notification à l'heure de chaque prière */
  notify: Record<SalatName, boolean>;
  /** Rappel quelques minutes avant (0 = à l'heure) */
  before: number;
  /** Adhkar du matin après Fajr et du soir après Asr, au lieu d'une heure fixe */
  adhkarWithPrayers: boolean;
  set: (patch: Partial<Omit<PrayerSettings, 'set'>>) => void;
};

export const usePrayer = create<PrayerSettings>()(
  persist(
    set => ({
      place: null,
      method: 'morocco',
      hanafi: false,
      offsets: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
      adhanOn: false,
      notify: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
      before: 0,
      adhkarWithPrayers: true,
      set: patch => set(patch),
    }),
    { name: 'prayer', storage: zustandStorage, version: 1 },
  ),
);

export type DayTimes = Record<PrayerName, Date>;

/** Horaires d'un jour donné, décalages compris (null tant qu'aucun lieu n'est choisi). */
export function timesFor(date: Date, s: Pick<PrayerSettings, 'place' | 'method' | 'hanafi' | 'offsets'> = usePrayer.getState()): DayTimes | null {
  if (!s.place) return null;
  const p = params(s.method);
  p.madhab = s.hanafi ? Madhab.Hanafi : Madhab.Shafi;
  const pt = new PrayerTimes(new Coordinates(s.place.lat, s.place.lng), date, p);
  const out = {} as DayTimes;
  for (const name of PRAYERS) out[name] = new Date(new Date(pt[name]).getTime() + (s.offsets[name] ?? 0) * 60000);
  return out;
}

/** Prochaine prière (Fajr du lendemain après Isha). */
export function nextPrayer(now = new Date()): { name: SalatName; time: Date } | null {
  const today = timesFor(now);
  if (!today) return null;
  for (const name of SALAT) if (today[name] > now) return { name, time: today[name] };
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const t = timesFor(tomorrow);
  return t ? { name: 'fajr', time: t.fajr } : null;
}

export const fmtClock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Position actuelle (avec autorisation) et nom de la ville ; null si refusé. */
export async function locateMe(): Promise<{ lat: number; lng: number; label: string } | null> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return null;
  const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  const { latitude: lat, longitude: lng } = pos.coords;
  let label = `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    label = a?.city || a?.subregion || a?.region || label;
  } catch {
    // pas de connexion : on garde les coordonnées
  }
  return { lat, lng, label };
}

/** Dernière prière passée (Isha de la veille avant Fajr), pour mesurer l'avancement vers la suivante. */
export function prevPrayer(now = new Date()): { name: SalatName; time: Date } | null {
  const today = timesFor(now);
  if (!today) return null;
  let found: { name: SalatName; time: Date } | null = null;
  for (const name of SALAT) if (today[name] <= now) found = { name, time: today[name] };
  if (found) return found;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const t = timesFor(y);
  return t ? { name: 'isha', time: t.isha } : null;
}

/** Date de l'hégire (calendrier Umm al-Qura) si le moteur la connaît, sinon null. */
export function hijriDate(date: Date, lang: 'ar' | 'fr'): string | null {
  try {
    const f = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura-nu-arab' : 'fr-FR-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' });
    return f.resolvedOptions().calendar?.startsWith('islamic') ? f.format(date) : null;
  } catch {
    return null;
  }
}

/** Icône de chaque moment de la journée */
export const PRAYER_ICONS: Record<PrayerName, 'cloudy-night-outline' | 'sunny-outline' | 'sunny' | 'partly-sunny' | 'cloudy-night' | 'moon'> = {
  fajr: 'cloudy-night-outline',
  sunrise: 'sunny-outline',
  dhuhr: 'sunny',
  asr: 'partly-sunny',
  maghrib: 'cloudy-night',
  isha: 'moon',
};
