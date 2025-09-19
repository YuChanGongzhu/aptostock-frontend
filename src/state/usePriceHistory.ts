import { useEffect, useMemo, useRef, useState } from "react";

export type SymbolKey = "TLSA" | "CRCL";
export type PricePoint = { t: number; p: number };
export type Candle = { t: number; o: number; h: number; l: number; c: number };

// keep at most N minutes worth of data
const MAX_POINTS = 600; // ~10 minutes if interval 1s, but oracle is 3s so ~30 minutes

export function usePriceHistory(prices: { TLSA: number; CRCL: number } | null, frameMs = 10_000) {
  const [tlsa, setTlsA] = useState<PricePoint[]>([]);
  const [crcl, setCrcl] = useState<PricePoint[]>([]);

  // append price snapshot when oracle updates
  const lastTLSA = useRef<number | null>(null);
  const lastCRCL = useRef<number | null>(null);

  useEffect(() => {
    if (!prices) return;
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
  }, [prices]);

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

  return { points: { TLSA: tlsa, CRCL: crcl }, candles };
}
