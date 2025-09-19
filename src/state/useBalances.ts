import { useMemo, useState } from "react";

export type Balances = {
  USDA: number;
  TLSA: number;
  CRCL: number;
};

const STORAGE_KEY = "apto_balances_v1";

function loadInitial(): Balances {
  if (typeof window === "undefined") return { USDA: 10000, TLSA: 0, CRCL: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Balances;
  } catch {}
  return { USDA: 10000, TLSA: 0, CRCL: 0 };
}

function save(bal: Balances) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bal));
  } catch {}
}

export function useBalances() {
  const [balances, setBalances] = useState<Balances>(() => loadInitial());

  const api = useMemo(() => {
    return {
      balances,
      set: (next: Balances) => {
        setBalances(next);
        save(next);
      },
      add: (sym: keyof Balances, delta: number) => {
        const next = { ...balances, [sym]: +(balances[sym] + delta).toFixed(6) };
        setBalances(next);
        save(next);
      },
      reset: () => {
        const def = { USDA: 10000, TLSA: 0, CRCL: 0 };
        setBalances(def);
        save(def);
      },
    };
  }, [balances]);

  return api;
}
