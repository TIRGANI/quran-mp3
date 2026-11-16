import { create } from 'zustand';

// Petit message temporaire en bas de l'écran (affiché par <Toast /> dans le layout racine).
export const useToast = create<{ msg: string | null; id: number }>(() => ({ msg: null, id: 0 }));

let timer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  clearTimeout(timer);
  useToast.setState(s => ({ msg, id: s.id + 1 }));
  timer = setTimeout(() => useToast.setState({ msg: null }), 3200);
}
