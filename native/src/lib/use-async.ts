import { useEffect, useState } from 'react';

export type AsyncValue<T> = { status: 'idle' } | { status: 'loading' } | { status: 'ok'; value: T } | { status: 'error' };

/**
 * Charge une valeur asynchrone identifiée par `key` (null = rien à charger). Le résultat est
 * mémorisé avec sa clé : quand la clé change, on renvoie aussitôt « loading » sans setState
 * dans l'effet, et une réponse arrivée trop tard pour une ancienne clé est ignorée.
 */
export function useAsync<T>(key: string | null, load: () => Promise<T>): AsyncValue<T> {
  const [res, setRes] = useState<{ key: string; value: AsyncValue<T> } | null>(null);
  useEffect(() => {
    if (key === null) return;
    let alive = true;
    load().then(
      value => alive && setRes({ key, value: { status: 'ok', value } }),
      () => alive && setRes({ key, value: { status: 'error' } }),
    );
    return () => {
      alive = false;
    };
    // `load` dépend de la clé : la clé suffit à décider quand recharger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (key === null) return { status: 'idle' };
  return res?.key === key ? res.value : { status: 'loading' };
}
