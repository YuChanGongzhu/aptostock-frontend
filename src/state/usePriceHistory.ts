import { useEffect, useMemo, useRef, useState } from "react";

export type SymbolKey = "TLSA" | "CRCL";
export type PricePoint = { t: number; p: number };
export type Candle = { t: number; o: number; h: number; l: number; c: number };

// keep at most N minutes worth of data
const MAX_POINTS = 600; // ~10 minutes if interval 1s, but oracle is 3s so ~30 minutes

export function usePriceHistory(prices: { TLSA: number; CRCL: number } | null, frameMs = 10_000) {
  const [tlsa, setTlsA] = useState<PricePoint[]>([]);
  const [crcl, setCrcl] = useState<PricePoint[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hadStored, setHadStored] = useState(false);

  const KEY = "apto_price_history_v1";

  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as { TLSA?: PricePoint[]; CRCL?: PricePoint[] };
        const norm = (arr?: PricePoint[]) =>
          Array.isArray(arr)
            ? arr
                .filter((x) => x && typeof x.t === "number" && typeof x.p === "number" && isFinite(x.t) && isFinite(x.p))
                .slice(-MAX_POINTS)
            : [];
        setTlsA(norm(parsed.TLSA));
        setCrcl(norm(parsed.CRCL));
        if ((parsed.TLSA && parsed.TLSA.length) || (parsed.CRCL && parsed.CRCL.length)) {
          setHadStored(true);
        }
      }
    } catch (_) {
      // ignore corrupt storage
    } finally {
      setLoaded(true);
    }
  }, []);

  // append price snapshot when oracle updates
  const lastTLSA = useRef<number | null>(null);
  const lastCRCL = useRef<number | null>(null);
  const seededRef = useRef(false);

  // Seed mock history once if no stored data
  useEffect(() => {
    if (!loaded || hadStored || seededRef.current) return;
    // wait until we have at least a starting price
    const baseTLSA = prices?.TLSA ?? 10;
    const baseCRCL = prices?.CRCL ?? 5;
    // If prices not ready yet, hold off seeding until they are available (effect will rerun)
    if (!prices) return;

    const now = Date.now();
    const SEED_MINUTES = 20; // about 20 minutes of history
    const STEP_MS = 5_000; // 5s interval points
    const steps = Math.min(Math.floor((SEED_MINUTES * 60_000) / STEP_MS), MAX_POINTS - 2);
    const gen = (base: number) => {
      let p = base;
      const arr: PricePoint[] = [];
      for (let i = steps; i > 0; i--) {
        // gentle random walk: +/- up to 0.4%
        const drift = (Math.random() - 0.5) * 0.008; // -0.4%..+0.4%
        p = Math.max(0.000001, p * (1 + drift));
        const t = now - i * STEP_MS;
        arr.push({ t, p: +p.toFixed(6) });
      }
      return arr;
    };

    setTlsA(gen(baseTLSA));
    setCrcl(gen(baseCRCL));
    seededRef.current = true;
  }, [loaded, hadStored, prices]);

  useEffect(() => {
    if (!prices || !loaded) return;
    const now = Date.now();
    if (lastTLSA.current !== prices.TLSA) {
      lastTLSA.current = prices.TLSA;
      setTlsA((arr) => {
        const next = [...arr, { t: now, p: prices.TLSA }];
        return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
      });
    }
    if (lastCRCL.current !== prices.CRCL) {
      lastCRCL.current = prices.CRCL;
      setCrcl((arr) => {
        const next = [...arr, { t: now, p: prices.CRCL }];
        return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
      });
    }
  }, [prices, loaded]);

  // Persist to localStorage when arrays change (client-only)
  useEffect(() => {
    if (!loaded) return;
    try {
      if (typeof window !== "undefined") {
        const payload = JSON.stringify({ TLSA: tlsa, CRCL: crcl });
        window.localStorage.setItem(KEY, payload);
      }
    } catch (_) {
      // ignore quota errors
    }
  }, [tlsa, crcl, loaded]);

  const toCandles = (points: PricePoint[]): Candle[] => {
    if (!points.length) return [];
    const buckets = new Map<number, Candle>();
    for (const { t, p } of points) {
      const bucket = Math.floor(t / frameMs) * frameMs;
      const c = buckets.get(bucket);
      if (!c) {
        buckets.set(bucket, { t: bucket, o: p, h: p, l: p, c: p });
      } else {
        c.h = Math.max(c.h, p);
        c.l = Math.min(c.l, p);
        c.c = p;
      }
    }
    const arr = Array.from(buckets.values()).sort((a, b) => a.t - b.t);
    // Limit to last 60 candles
    return arr.slice(-60);
  };

  const candles = useMemo(() => ({
    TLSA: toCandles(tlsa),
    CRCL: toCandles(crcl),
  }), [tlsa, crcl, frameMs]);

  const reset = () => {
    setTlsA([]);
    setCrcl([]);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(KEY);
      }
    } catch (_) {
      // ignore
    }
  };

  return { points: { TLSA: tlsa, CRCL: crcl }, candles, reset };
}
