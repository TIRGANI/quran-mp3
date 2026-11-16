import { useCallback, useEffect, useRef, type ComponentRef } from 'react';
import type { View } from 'react-native';

import { setTarget, useTour } from '@/tour/store';
import { STEPS } from '@/tour/steps';

/**
 * Déclare un élément comme cible de la visite guidée : `ref` et `onLayout` sont à poser sur la
 * View à mettre en lumière. Sa position est mesurée à l'écran, et remesurée tant qu'elle est
 * l'étape en cours (la liste peut défiler, le clavier s'ouvrir…).
 */
export function useTourTarget(id: string) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const isCurrent = useTour(s => s.active && STEPS[s.step]?.target === id);

  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) setTarget(id, { x, y, width, height });
    });
  }, [id]);

  useEffect(() => {
    if (!isCurrent) return;
    measure();
    const timer = setInterval(measure, 400);
    return () => clearInterval(timer);
  }, [isCurrent, measure]);

  // L'élément disparaît de l'écran : la cible n'est plus disponible
  useEffect(() => () => setTarget(id, null), [id]);

  return { ref, onLayout: measure, collapsable: false as const };
}
