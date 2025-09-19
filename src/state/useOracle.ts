import { useEffect, useMemo, useRef, useState } from "react";

// Simple stock-like random walk price oracle (client-side mock)
// Two symbols: TLSA and CRCL, quoted in USDA
// Persist last prices in localStorage

type Prices = { TLSA: number; CRCL: number };

const STORAGE_KEY = "apto_oracle_prices_v1";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function loadInitialPrices(): Prices {
  // Only read localStorage on client to avoid SSR/CSR mismatch
  if (typeof window === "undefined") return { TLSA: 120, CRCL: 240 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Prices;
  } catch {}
  return { TLSA: 120, CRCL: 240 };
}

function savePrices(prices: Prices) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prices));
  } catch {}
}

export function useOracle(opts?: { intervalMs?: number; volatilityBps?: number; paused?: boolean }) {
  const { intervalMs = 3000, volatilityBps = 20, paused = false } = opts || {};
  // Start as null to keep SSR/CSR consistent; set on mount
  const [prices, setPrices] = useState<Prices | null>(null);
  const [pausedState, setPaused] = useState<boolean>(paused);
  const timer = useRef<number | null>(null);

  // price update: random walk with tiny drift
  const tick = () => {
    setPrices((prev) => {
      const base = prev ?? loadInitialPrices();
      const drift = 0.0002; // mild upward drift per tick
      const factor = (symPrice: number) => {
        const rndBps = (Math.random() * 2 - 1) * volatilityBps; // +/- bps
        const rnd = rndBps / 10000;
        const next = symPrice * (1 + rnd + drift);
        return clamp(Number(next.toFixed(2)), 0.01, 1_000_000);
      };
      const next = { TLSA: factor(base.TLSA), CRCL: factor(base.CRCL) };
      savePrices(next);
      return next;
    });
  };

  useEffect(() => {
    // Initialize prices after mount (client)
    if (prices === null) {
      setPrices(loadInitialPrices());
    }
  }, [prices]);

  useEffect(() => {
    if (pausedState || prices === null) return;
    timer.current = window.setInterval(tick, intervalMs);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [intervalMs, pausedState, prices]);

  const api = useMemo(
    () => ({
      prices,
      paused: pausedState,
      pause: () => setPaused(true),
      resume: () => setPaused(false),
      setPrices: (p: Prices) => setPrices(p),
      reset: () => setPrices({ TLSA: 120, CRCL: 240 }),
    }),
    [prices, pausedState]
  );

  return api;
}
