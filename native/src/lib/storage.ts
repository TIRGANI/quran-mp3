import { createJSONStorage } from 'zustand/middleware';

import { kv } from '@/lib/kv';

export const zustandStorage = createJSONStorage(() => ({
  getItem: kv.get,
  setItem: kv.set,
  removeItem: kv.remove,
}));
