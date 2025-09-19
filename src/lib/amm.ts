export type QuoteInput = {
  reserveIn: number;
  reserveOut: number;
  amountIn: number;
  feeRate?: number; // 0.003 for 0.3%
};

export type QuoteResult = {
  amountInAfterFee: number;
  amountOut: number;
  priceImpactPct: number;
  feePaid: number;
};

export function getQuote({ reserveIn, reserveOut, amountIn, feeRate = 0.003 }: QuoteInput): QuoteResult {
  if (amountIn <= 0 || reserveIn <= 0 || reserveOut <= 0) {
    return { amountInAfterFee: 0, amountOut: 0, priceImpactPct: 0, feePaid: 0 };
  }
  const feePaid = amountIn * feeRate;
  const amountInAfterFee = amountIn - feePaid;
  const k = reserveIn * reserveOut;
  const newReserveIn = reserveIn + amountInAfterFee;
  const amountOut = Math.max(0, reserveOut - k / newReserveIn);

  // simple price impact estimation: compare implied price before vs after
  const priceBefore = reserveOut / reserveIn;
  const priceAfter = (reserveOut - amountOut) / (reserveIn + amountInAfterFee);
  const priceImpactPct = priceAfter > 0 ? Math.max(0, (priceAfter - priceBefore) / priceBefore) * 100 : 0;

  return {
    amountInAfterFee: +amountInAfterFee.toFixed(6),
    amountOut: +amountOut.toFixed(6),
    priceImpactPct: +priceImpactPct.toFixed(4),
    feePaid: +feePaid.toFixed(6),
  };
}
