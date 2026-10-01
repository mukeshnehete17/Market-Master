import { useSyncExternalStore } from 'react';

const preference = window.matchMedia('(prefers-reduced-motion: reduce)');

function subscribe(notify: () => void) {
  preference.addEventListener('change', notify);
  return () => preference.removeEventListener('change', notify);
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribe, () => preference.matches);
}
