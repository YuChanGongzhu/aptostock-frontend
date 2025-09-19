"use client";

import React from "react";
import type { Candle } from "@/state/usePriceHistory";

type Props = {
  candles: Candle[];
  width?: number;
  height?: number;
  bullishColor?: string; // body color when close >= open
  bearishColor?: string; // body color when close < open
};

export function KLineChart({
  candles,
  width = 520,
  height = 240,
  bullishColor = "#22d3ee",
  bearishColor = "#ef4444",
}: Props) {
  const padding = { top: 10, right: 16, bottom: 18, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  if (!candles || candles.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-secondary-foreground/70">
        暂无数据
      </div>
    );
  }

  const times = candles.map((c) => c.t);
  const prices = candles.flatMap((c) => [c.o, c.h, c.l, c.c]);
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);

  const xScale = (t: number) => {
    if (maxT === minT) return padding.left + innerW / 2;
    return padding.left + ((t - minT) / (maxT - minT)) * innerW;
  };
  const yScale = (p: number) => {
    if (maxP === minP) return padding.top + innerH / 2;
    // price high on top
    return padding.top + (1 - (p - minP) / (maxP - minP)) * innerH;
  };

  const barW = Math.max(3, innerW / (candles.length * 1.6));

  return (
    <svg width={width} height={height} className="rounded-md border bg-card/30">
      {/* axes (minimal) */}
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + innerH} stroke="rgba(255,255,255,0.08)" />
      <line x1={padding.left} y1={padding.top + innerH} x2={padding.left + innerW} y2={padding.top + innerH} stroke="rgba(255,255,255,0.08)" />

      {candles.map((c, i) => {
        const x = xScale(c.t);
        const open = yScale(c.o);
        const close = yScale(c.c);
        const high = yScale(c.h);
        const low = yScale(c.l);
        const bullish = c.c >= c.o;
        const color = bullish ? bullishColor : bearishColor;
        const bodyTop = Math.min(open, close);
        const bodyH = Math.max(1, Math.abs(close - open));
        return (
          <g key={i}>
            {/* wick */}
            <line x1={x} x2={x} y1={high} y2={low} stroke={color} strokeWidth={1} />
            {/* body */}
            <rect x={x - barW / 2} y={bodyTop} width={barW} height={bodyH} fill={color} opacity={0.9} rx={1} />
          </g>
        );
      })}
    </svg>
  );
}
