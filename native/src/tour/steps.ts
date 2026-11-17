import { router } from 'expo-router';

import { useSettings } from '@/stores/settings';
import { useTour } from '@/tour/store';

export type TourKey =
  | 'reciter'
  | 'surah'
  | 'miniplayer'
  | 'download'
  | 'tabRead'
  | 'resume'
  | 'verses'
  | 'actions'
  | 'tafsir'
  | 'options'
  | 'back'
  | 'tabHifdh'
  | 'tabAdhkar'
  | 'tabRuqya'
  | 'tabAdhan'
  | 'tabSettings';

export type TourStep = {
  key: TourKey;
  /** Élément mis en lumière (voir useTourTarget) */
  target: string;
  /** Événement qui fait avancer tout seul : l'utilisateur a fait le geste demandé */
  waitFor?: string;
  /** Ce que fait « Suivant » quand l'utilisateur préfère ne pas faire le geste lui-même */
  onNext?: () => void;
  /** Étape ignorée si l'élément n'est pas à l'écran (ex. pas de téléchargement sur le web) */
  optional?: boolean;
  /** Préparation à l'arrivée sur l'étape (ex. revenir à l'écran où se trouve l'élément) */
  before?: () => void;
};

export const STEPS: TourStep[] = [
  { key: 'reciter', target: 'listen.reciter' },
  { key: 'surah', target: 'listen.surah', waitFor: 'played' },
  { key: 'miniplayer', target: 'miniplayer', optional: true },
  { key: 'download', target: 'listen.download', optional: true },
  { key: 'tabRead', target: 'tab.read', waitFor: 'tab:read', onNext: () => router.navigate('/read') },
  { key: 'resume', target: 'read.resume', waitFor: 'reader:open', onNext: () => router.push({ pathname: '/reader/[surah]', params: { surah: '1' } }) },
  { key: 'verses', target: 'reader.verses', waitFor: 'verse:selected', optional: true },
  { key: 'actions', target: 'reader.actions', optional: true },
  { key: 'tafsir', target: 'reader.tafsir', optional: true },
  { key: 'options', target: 'reader.options', optional: true },
  { key: 'back', target: 'reader.back', waitFor: 'reader:close', onNext: () => router.back(), optional: true },
  { key: 'tabHifdh', target: 'tab.hifdh' },
  { key: 'tabAdhkar', target: 'tab.adhkar' },
  { key: 'tabAdhan', target: 'tab.adhan' },
  { key: 'tabRuqya', target: 'tab.ruqya' },
  { key: 'tabSettings', target: 'listen.settings', before: () => router.navigate('/') },
];

export function startTour() {
  router.navigate('/');
  useTour.setState({ active: true, step: 0 });
}

export function endTour() {
  useTour.setState({ active: false, step: 0 });
  // Les écrans déjà expliqués par la visite n'affichent plus leur astuce
  const { seenTips, set } = useSettings.getState();
  set({ onboarded: true, seenTips: { ...seenTips, listen: true, player: true, read: true, reader: true } });
}

export function nextStep() {
  const { step } = useTour.getState();
  if (step >= STEPS.length - 1) return endTour();
  STEPS[step + 1].before?.();
  useTour.setState({ step: step + 1 });
}
