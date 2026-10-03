import { useState, useEffect } from 'react';
import { formatFCFA } from './formatters';

const STORAGE_KEY = 'universkaneprod_privacy_mask';

let globalMaskedState = true;
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      globalMaskedState = saved === 'true';
    } else {
      globalMaskedState = true;
      localStorage.setItem(STORAGE_KEY, 'true');
    }
  } catch {
    globalMaskedState = true;
  }
}

const listeners = new Set<(masked: boolean) => void>();

export function getPrivacyMask(): boolean {
  return globalMaskedState;
}

export function setPrivacyMask(masked: boolean): void {
  globalMaskedState = masked;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, String(masked));
    } catch {
      // Ignorer si localStorage n'est pas disponible
    }
  }
  listeners.forEach((listener) => listener(globalMaskedState));
}

export function togglePrivacyMask(): void {
  setPrivacyMask(!globalMaskedState);
}

export function usePrivacyMask() {
  const [isMasked, setIsMasked] = useState<boolean>(globalMaskedState);

  useEffect(() => {
    const handler = (val: boolean) => setIsMasked(val);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return {
    isMasked,
    toggleMask: togglePrivacyMask,
    setMasked: setPrivacyMask,
  };
}

export function formatSensitiveFCFA(
  amount: number | string | undefined | null,
  isMasked: boolean
): string {
  if (isMasked) {
    return '•••••• FCFA';
  }
  return formatFCFA(amount);
}
