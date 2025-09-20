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
