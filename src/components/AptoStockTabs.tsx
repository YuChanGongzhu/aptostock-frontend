"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOracle } from "@/state/useOracle";
import { useBalances } from "@/state/useBalances";
import { usePools } from "@/state/usePools";
import { getQuote } from "@/lib/amm";

function format(n: number, digits = 6) {
  if (!isFinite(n)) return "-";
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(n);
}

export function AptoStockTabs() {
  const { prices, paused, pause, resume } = useOracle();
  const { balances, add: addBalance, reset: resetBalances } = useBalances();
  const { pools, update: updatePool, reset: resetPools } = usePools();

  const [tab, setTab] = useState<"MINT" | "SWAP">("MINT");
  const pricesReady = !!prices;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Mint state
  const [mintToken, setMintToken] = useState<"TLSA" | "CRCL">("TLSA");
  const [mintUsdaIn, setMintUsdaIn] = useState<string>("");
  const mintPrice = pricesReady ? (mintToken === "TLSA" ? prices!.TLSA : prices!.CRCL) : 0;
  const mintOut = useMemo(() => {
    const usda = parseFloat(mintUsdaIn || "0");
    if (usda <= 0 || mintPrice <= 0) return 0;
    return +(usda / mintPrice).toFixed(6);
  }, [mintUsdaIn, mintPrice]);

  const onMint = () => {
    const usda = parseFloat(mintUsdaIn || "0");
    if (usda <= 0) return;
    if (balances.USDA < usda) return alert("USDA 余额不足");
    addBalance("USDA", -usda);
    addBalance(mintToken, mintOut);
    setMintUsdaIn("");
  };

  // Swap state
  type SwapSide = "USDA" | "TLSA" | "CRCL";
  const [fromToken, setFromToken] = useState<SwapSide>("USDA");
  const [toToken, setToToken] = useState<SwapSide>("TLSA");
  const [fromAmountStr, setFromAmountStr] = useState<string>("");

  const validPairs: Array<[SwapSide, SwapSide]> = [
    ["USDA", "TLSA"],
    ["TLSA", "USDA"],
    ["USDA", "CRCL"],
    ["CRCL", "USDA"],
  ];

  const pairAllowed = validPairs.some(([a, b]) => a === fromToken && b === toToken);

  const swapQuote = useMemo(() => {
    if (!pairAllowed) return null;
    const amountIn = parseFloat(fromAmountStr || "0");
    if (amountIn <= 0) return null;
    const isTLSA = fromToken === "TLSA" || toToken === "TLSA";
    const key = isTLSA ? "TLSA_USDA" : "CRCL_USDA" as const;
    const pool = pools[key];

    let reserveIn: number, reserveOut: number;
    if (fromToken === "USDA") {
      reserveIn = pool.reserveB; // USDA
      reserveOut = pool.reserveA; // TLSA/CRCL
    } else if (toToken === "USDA") {
      reserveIn = pool.reserveA; // TLSA/CRCL
      reserveOut = pool.reserveB; // USDA
    } else {
      return null;
    }

    return { key, ...getQuote({ reserveIn, reserveOut, amountIn, feeRate: 0.003 }) };
  }, [fromAmountStr, fromToken, toToken, pools, pairAllowed]);

  const onSwap = () => {
    if (!pairAllowed) return alert("该交易对在 MVP 中暂不支持");
    const amountIn = parseFloat(fromAmountStr || "0");
    if (amountIn <= 0) return;
    if ((balances as any)[fromToken] < amountIn) return alert("余额不足");
    if (!swapQuote || swapQuote.amountOut <= 0) return alert("池子储备不足或输出为 0");

    const isFromUSDA = fromToken === "USDA";
    const isTLSAPath = fromToken === "TLSA" || toToken === "TLSA";
    const key = isTLSAPath ? "TLSA_USDA" : "CRCL_USDA" as const;

    // 扣除输入，加上输出
    addBalance(fromToken as any, -amountIn);
    addBalance(toToken as any, swapQuote.amountOut);

    // 更新池子
    if (isFromUSDA) {
      // USDA -> (TLSA/CRCL)
      updatePool(key, (p) => ({
        ...p,
        reserveB: p.reserveB + swapQuote.amountInAfterFee,
        reserveA: p.reserveA - swapQuote.amountOut,
      }));
    } else {
      // (TLSA/CRCL) -> USDA
      updatePool(key, (p) => ({
        ...p,
        reserveA: p.reserveA + swapQuote.amountInAfterFee,
        reserveB: p.reserveB - swapQuote.amountOut,
      }));
    }

    setFromAmountStr("");
  };

  const onReset = () => {
    resetBalances();
    resetPools();
  };

  const headerBadge = (
    <div className="text-xs text-secondary-foreground/80">
      Powered by Aptos blockchain • Web3 wallet connect • decentralized trading
    </div>
  );

  if (!mounted) {
    return (
      <div className="w-full max-w-3xl mx-auto mt-6 space-y-6">
        <Card className="glass-card border">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="text-2xl font-semibold gradient-text">AptoStock Demo</span>
              <div className="flex items-center gap-3">
                <Button className="btn-neon" disabled>加载中</Button>
                <Button variant="secondary" disabled>重置 Demo</Button>
              </div>
            </CardTitle>
            <div className="text-xs text-secondary-foreground/80">Powered by Aptos blockchain • Web3 wallet connect • decentralized trading</div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-md bg-card/40 border"><div className="text-secondary-foreground">TLSA 价格</div><div className="text-lg font-semibold">-</div></div>
              <div className="p-3 rounded-md bg-card/40 border"><div className="text-secondary-foreground">CRCL 价格</div><div className="text-lg font-semibold">-</div></div>
              <div className="p-3 rounded-md bg-card/40 border"><div className="text-secondary-foreground">余额 (USDA/TLSA/CRCL)</div><div className="text-lg font-semibold">- / - / -</div></div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border">
          <CardHeader>
            <div className="flex gap-2 p-1 rounded-lg bg-muted/60 w-fit shadow-[0_0_0_1px_rgba(34,211,238,0.15)]">
              <Button variant="secondary" disabled>Mint</Button>
              <Button variant="secondary" disabled>Swap</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 items-end">
                <div><Label>目标代币</Label><div className="mt-1 w-full bg-background border rounded-md p-2">-</div></div>
                <div><Label>USDA 数量</Label><Input placeholder="0.0" disabled /></div>
              </div>
              <Button className="btn-neon" disabled>Mint</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto mt-6 space-y-6">
      <Card className="glass-card border">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="text-2xl font-semibold gradient-text">AptoStock Demo</span>
            <div className="flex items-center gap-3">
              <Button className="btn-neon" onClick={() => (paused ? resume() : pause())}>
                {paused ? "恢复价格" : "暂停价格"}
              </Button>
              <Button variant="secondary" onClick={onReset}>重置 Demo</Button>
            </div>
          </CardTitle>
          {headerBadge}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="p-3 rounded-md bg-card/40 border">
              <div className="text-secondary-foreground">TLSA 价格</div>
              <div className="text-lg font-semibold">{pricesReady ? `${format(prices!.TLSA, 2)} USDA` : "-"}</div>
            </div>
            <div className="p-3 rounded-md bg-card/40 border">
              <div className="text-secondary-foreground">CRCL 价格</div>
              <div className="text-lg font-semibold">{pricesReady ? `${format(prices!.CRCL, 2)} USDA` : "-"}</div>
            </div>
            <div className="p-3 rounded-md bg-card/40 border">
              <div className="text-secondary-foreground">余额 (USDA/TLSA/CRCL)</div>
              <div className="text-lg font-semibold">{mounted ? `${format(balances.USDA)} / ${format(balances.TLSA)} / ${format(balances.CRCL)}` : "- / - / -"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border">
        <CardHeader>
          <div className="flex gap-2 p-1 rounded-lg bg-muted/60 w-fit shadow-[0_0_0_1px_rgba(34,211,238,0.15)]">
            <Button className={tab === "MINT" ? "btn-neon" : ""} variant={tab === "MINT" ? "default" : "secondary"} onClick={() => setTab("MINT")}>Mint</Button>
            <Button className={tab === "SWAP" ? "btn-neon" : ""} variant={tab === "SWAP" ? "default" : "secondary"} onClick={() => setTab("SWAP")}>Swap</Button>
          </div>
        </CardHeader>
        <CardContent>
          {tab === "MINT" ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <Label htmlFor="mintToken">目标代币</Label>
                  <select id="mintToken" className="mt-1 w-full bg-background border rounded-md p-2" value={mintToken} onChange={(e) => setMintToken(e.target.value as any)}>
                    <option value="TLSA">TLSA</option>
                    <option value="CRCL">CRCL</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="usdaIn">USDA 数量</Label>
                  <Input id="usdaIn" inputMode="decimal" placeholder="0.0" value={mintUsdaIn} onChange={(e) => setMintUsdaIn(e.target.value)} />
                  <div className="text-xs text-secondary-foreground mt-1">可得：{mounted && pricesReady && mintUsdaIn ? format(mintOut) : "-"} {mintToken}</div>
                </div>
              </div>
              <Button className="btn-neon" onClick={onMint} disabled={!pricesReady || !mounted}>Mint</Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <Label htmlFor="fromToken">输入代币</Label>
                  <select id="fromToken" className="mt-1 w-full bg-background border rounded-md p-2" value={fromToken} onChange={(e) => {
                    const v = e.target.value as SwapSide;
                    setFromToken(v);
                    // adjust toToken if invalid
                    if (v !== "USDA" && toToken !== "USDA") setToToken("USDA");
                  }}>
                    <option value="USDA">USDA</option>
                    <option value="TLSA">TLSA</option>
                    <option value="CRCL">CRCL</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="toToken">输出代币</Label>
                  <select id="toToken" className="mt-1 w-full bg-background border rounded-md p-2" value={toToken} onChange={(e) => {
                    const v = e.target.value as SwapSide;
                    setToToken(v);
                    if (fromToken !== "USDA" && v !== "USDA") setFromToken("USDA");
                  }}>
                    <option value="USDA">USDA</option>
                    <option value="TLSA">TLSA</option>
                    <option value="CRCL">CRCL</option>
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="fromAmount">输入数量</Label>
                <Input id="fromAmount" inputMode="decimal" placeholder="0.0" value={fromAmountStr} onChange={(e) => setFromAmountStr(e.target.value)} />
              </div>

              {pairAllowed ? (
                <div className="text-sm text-secondary-foreground">
                  {swapQuote ? (
                    <div className="space-y-1">
                      <div>预估可得：<span className="font-semibold">{format(swapQuote.amountOut)}</span> {toToken}</div>
                      <div>手续费（0.3%）：{format(swapQuote.feePaid)} {fromToken}</div>
                      <div>价格影响：{format(swapQuote.priceImpactPct, 4)}%</div>
                    </div>
                  ) : (
                    <div>输入数量以获取报价</div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-destructive">该交易对在 MVP 中暂不支持</div>
              )}

              <Button className="btn-neon" onClick={onSwap} disabled={!pairAllowed || !pricesReady || !mounted}>Swap</Button>

              <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                <div className="p-3 rounded-md bg-card/40 border">
                  <div className="text-secondary-foreground">TLSA/USDA 池</div>
                  <div>TLSA 储备：{mounted ? format(pools.TLSA_USDA.reserveA) : "-"}</div>
                  <div>USDA 储备：{mounted ? format(pools.TLSA_USDA.reserveB) : "-"}</div>
                </div>
                <div className="p-3 rounded-md bg-card/40 border">
                  <div className="text-secondary-foreground">CRCL/USDA 池</div>
                  <div>CRCL 储备：{mounted ? format(pools.CRCL_USDA.reserveA) : "-"}</div>
                  <div>USDA 储备：{mounted ? format(pools.CRCL_USDA.reserveB) : "-"}</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
