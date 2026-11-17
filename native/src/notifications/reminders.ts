import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { getT } from '@/i18n';
import { useReading } from '@/stores/reading';
import { useSettings, type ReminderKey } from '@/stores/settings';

// Rappels locaux (programmés sur le téléphone, sans serveur) : wird du jour, adhkar du matin,
// du soir et du sommeil, sourate Al-Kahf le vendredi. Toucher la notification ouvre le bon écran.
export const CAN_NOTIFY = Platform.OS !== 'web';
const CHANNEL = 'reminders';
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
      await Notifications.cancelAllScheduledNotificationsAsync();
      const reminders = useSettings.getState().reminders;
      const enabled = (Object.keys(reminders) as ReminderKey[]).filter(k => reminders[k].on);
      if (!enabled.length) return;
      if (!(await Notifications.getPermissionsAsync()).granted) return;
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
