import { useMemo, useState } from "react";

export type PoolKey = "TLSA_USDA" | "CRCL_USDA";
export type Pool = { reserveA: number; reserveB: number; // A is token (TLSA/CRCL), B is USDA
  tokenA: "TLSA" | "CRCL"; tokenB: "USDA" };

export type PoolsState = Record<PoolKey, Pool>;

const STORAGE_KEY = "apto_pools_v1";

function loadInitial(): PoolsState {
  if (typeof window === "undefined") {
    return {
      TLSA_USDA: { tokenA: "TLSA", tokenB: "USDA", reserveA: 1000, reserveB: 120000 },
      CRCL_USDA: { tokenA: "CRCL", tokenB: "USDA", reserveA: 1000, reserveB: 240000 },
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PoolsState;
  } catch {}
  return {
    TLSA_USDA: { tokenA: "TLSA", tokenB: "USDA", reserveA: 1000, reserveB: 120000 },
    CRCL_USDA: { tokenA: "CRCL", tokenB: "USDA", reserveA: 1000, reserveB: 240000 },
  };
}

function save(state: PoolsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function usePools() {
  const [pools, setPools] = useState<PoolsState>(() => loadInitial());

  const api = useMemo(() => {
    return {
      pools,
      set: (next: PoolsState) => {
        setPools(next);
        save(next);
      },
      update: (key: PoolKey, updater: (p: Pool) => Pool) => {
        const nextPool = updater(pools[key]);
        const next = { ...pools, [key]: {
          ...nextPool,
          reserveA: +nextPool.reserveA.toFixed(6),
          reserveB: +nextPool.reserveB.toFixed(6),
        } };
        setPools(next);
        save(next);
      },
      reset: () => {
        const def = loadInitial();
        setPools(def);
        save(def);
      },
    };
  }, [pools]);

  return api;
}
