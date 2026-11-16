import { create } from 'zustand';

// Visite guidée interactive : une suite d'étapes, chacune met en lumière un élément réel de
// l'écran (« cible ») et attend soit « Suivant », soit que l'utilisateur fasse lui-même le geste
// (événement émis par l'app : sourate lancée, onglet ouvert, verset touché…).
export type Rect = { x: number; y: number; width: number; height: number };

type TourState = {
  active: boolean;
  step: number;
  /** Position à l'écran de chaque cible actuellement affichée */
  targets: Record<string, Rect>;
};

export const useTour = create<TourState>(() => ({ active: false, step: 0, targets: {} }));

export function setTarget(id: string, rect: Rect | null) {
  useTour.setState(s => {
    const prev = s.targets[id];
    if (rect && prev && prev.x === rect.x && prev.y === rect.y && prev.width === rect.width && prev.height === rect.height) return s;
    const targets = { ...s.targets };
    if (rect) targets[id] = rect;
    else delete targets[id];
    return { targets };
  });
}

/** Écouteurs d'événements de l'app, branchés par les étapes de la visite (voir steps.ts). */
const listeners = new Set<(event: string) => void>();
export function onTourEvent(fn: (event: string) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
/** Appelé par l'app à chaque geste utile à la visite (ex. 'played', 'tab:read'). Sans effet hors visite. */
export function tourEvent(event: string) {
  if (!useTour.getState().active) return;
  for (const fn of listeners) fn(event);
}
