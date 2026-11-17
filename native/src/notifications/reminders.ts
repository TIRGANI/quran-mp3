import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { router } from 'expo-router';
import { AppState, Platform } from 'react-native';

import { getT } from '@/i18n';
import { fmtClock, SALAT, timesFor, usePrayer } from '@/lib/prayer';
import { useReading } from '@/stores/reading';
import { useSettings, type ReminderKey } from '@/stores/settings';

// Rappels locaux (programmés sur le téléphone, sans serveur) : wird du jour, adhkar du matin,
// du soir et du sommeil, sourate Al-Kahf le vendredi. Toucher la notification ouvre le bon écran.
export const CAN_NOTIFY = Platform.OS !== 'web';
const CHANNEL = 'reminders';
const ADHAN_CHANNEL = 'adhan';
// Les horaires changent chaque jour : on programme les prochains jours, et on renouvelle à chaque
// ouverture de l'app (iOS limite à 64 notifications en attente : 6 jours × 7 au maximum ici).
const DAYS_AHEAD = 6;
const ADHKAR = { morning: 27, evening: 27, sleep: 28 } as const; // chapitres de Hisn al-Muslim

if (CAN_NOTIFY) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/** Demande l'autorisation si nécessaire ; false si l'utilisateur refuse. */
export async function ensurePermission(): Promise<boolean> {
  if (!CAN_NOTIFY) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === IosAuthorizationStatus.PROVISIONAL) return true;
  if (!current.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

function content(key: ReminderKey): Notifications.NotificationContentInput {
  const t = getT();
  const { goal, goalUnit } = useReading.getState();
  const portion = goalUnit === 'verses' ? `${goal} ${t.wirdUnit.verses.toLowerCase()}` : t.wirdUnit[goalUnit];
  switch (key) {
    case 'wird':
      return { title: t.notifWirdTitle, body: t.notifWirdBody(portion), data: { url: '/read' } };
    case 'morning':
      return { title: t.notifMorningTitle, body: t.notifMorningBody, data: { url: `/adhkar/${ADHKAR.morning}` } };
    case 'evening':
      return { title: t.notifEveningTitle, body: t.notifEveningBody, data: { url: `/adhkar/${ADHKAR.evening}` } };
    case 'sleep':
      return { title: t.notifSleepTitle, body: t.notifSleepBody, data: { url: `/adhkar/${ADHKAR.sleep}` } };
    case 'kahf':
      return { title: t.notifKahfTitle, body: t.notifKahfBody, data: { url: '/reader/18' } };
  }
}

let syncing: Promise<void> = Promise.resolve();

/** Reprogramme tous les rappels d'après les réglages (appelé au démarrage et à chaque changement). */
export function syncReminders(): Promise<void> {
  if (!CAN_NOTIFY) return Promise.resolve();
  // Une synchronisation à la fois, dans l'ordre, pour ne jamais laisser de doublons
  syncing = syncing.then(async () => {
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: getT().reminders,
        importance: AndroidImportance.DEFAULT,
      });
      await Notifications.setNotificationChannelAsync(ADHAN_CHANNEL, {
        name: getT().adhanTitle,
        importance: AndroidImportance.HIGH,
      });
      await Notifications.cancelAllScheduledNotificationsAsync();
      const reminders = useSettings.getState().reminders;
      const prayer = usePrayer.getState();
      // Adhkar du matin / du soir calés sur Fajr / Asr quand un lieu est connu
      const withPrayers = prayer.adhkarWithPrayers && !!prayer.place;
      const enabled = (Object.keys(reminders) as ReminderKey[]).filter(k => reminders[k].on && !(withPrayers && (k === 'morning' || k === 'evening')));
      const adhanOn = prayer.adhanOn && !!prayer.place;
      if (!enabled.length && !adhanOn && !(withPrayers && (reminders.morning.on || reminders.evening.on))) return;
      if (!(await Notifications.getPermissionsAsync()).granted) return;
      await schedulePrayerBased(reminders.morning.on, reminders.evening.on, withPrayers, adhanOn);
      for (const key of enabled) {
        const { hour, minute } = reminders[key];
        await Notifications.scheduleNotificationAsync({
          content: content(key),
          trigger:
            key === 'kahf'
              ? { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 6, hour, minute, channelId: CHANNEL } // 6 = vendredi (1 = dimanche)
              : { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL },
        });
      }
    } catch {
      // programmation impossible (ex. simulateur) : sans conséquence pour le reste de l'app
    }
  });
  return syncing;
}

/** Notifications liées aux horaires de prière des prochains jours. */
async function schedulePrayerBased(morning: boolean, evening: boolean, withPrayers: boolean, adhanOn: boolean) {
  const t = getT();
  const p = usePrayer.getState();
  const now = Date.now();
  const at = (date: Date, content: Notifications.NotificationContentInput, channelId: string) =>
    date.getTime() > now + 30000
      ? Notifications.scheduleNotificationAsync({ content, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId } })
      : null;
  for (let d = 0; d < DAYS_AHEAD; d++) {
    const day = new Date();
    day.setDate(day.getDate() + d);
    const times = timesFor(day);
    if (!times) return;
    if (adhanOn) {
      for (const name of SALAT) {
        if (!p.notify[name]) continue;
        const when = new Date(times[name].getTime() - p.before * 60000);
        await at(when, { title: t.adhanNotifTitle(t.prayerNames[name], p.before), body: t.adhanNotifBody(fmtClock(times[name]), p.place?.label ?? ''), data: { url: '/adhan' }, sound: 'default' }, ADHAN_CHANNEL);
      }
    }
    if (withPrayers && morning) {
      await at(new Date(times.fajr.getTime() + 15 * 60000), { title: t.notifMorningTitle, body: t.notifMorningBody, data: { url: `/adhkar/${ADHKAR.morning}` } }, CHANNEL);
    }
    if (withPrayers && evening) {
      await at(new Date(times.asr.getTime() + 15 * 60000), { title: t.notifEveningTitle, body: t.notifEveningBody, data: { url: `/adhkar/${ADHKAR.evening}` } }, CHANNEL);
    }
  }
}

/** Ouvre l'écran lié à une notification touchée (app ouverte, en arrière-plan ou fermée). */
export function handleNotificationTaps(): () => void {
  if (!CAN_NOTIFY) return () => {};
  const open = (response: Notifications.NotificationResponse | null) => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === 'string') router.push(url as never);
  };
  Notifications.getLastNotificationResponseAsync().then(r => {
    open(r);
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
  });
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}

// Les textes des rappels suivent la langue et l'objectif : on reprogramme quand ils changent.
useSettings.subscribe((s, prev) => {
  if (s.reminders !== prev.reminders || s.lang !== prev.lang) syncReminders();
});
useReading.subscribe((s, prev) => {
  if ((s.goal !== prev.goal || s.goalUnit !== prev.goalUnit) && useSettings.getState().reminders.wird.on) syncReminders();
});

// Réglages de prière modifiés : on reprogramme
usePrayer.subscribe((st, prev) => {
  if (st.place !== prev.place || st.method !== prev.method || st.hanafi !== prev.hanafi || st.offsets !== prev.offsets || st.notify !== prev.notify || st.before !== prev.before || st.adhanOn !== prev.adhanOn || st.adhkarWithPrayers !== prev.adhkarWithPrayers) syncReminders();
});
// Retour dans l'app : on renouvelle la fenêtre des prochains jours
if (CAN_NOTIFY) AppState.addEventListener('change', state => {
  if (state === 'active') syncReminders();
});
