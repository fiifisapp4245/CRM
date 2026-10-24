"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatAmount } from "../../lib/calc";
import { monthLabel, type MonthPoint } from "../../lib/forecast";
import type { Currency } from "../../types";

/* Validated categorical pair (teal / amber): CVD ΔE 19, both ≥3:1 on white. Open pipeline is a light tint of the
   weighted hue because weighted is part of open — the light bar reads as "the rest of the pipeline". */
const C = { won: "#0891b2", weighted: "#d97706", open: "#f6d7ad", target: "#56707a", grid: "#e6ecee", axis: "#5f7379" };

const W = 720;
const H = 260;
const M = { l: 64, r: 8, t: 12, b: 30 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((m) => m >= v)!;
}

/** Bar with 4px rounded data-end, square at the baseline. */
function bar(x: number, y: number, w: number, h: number) {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function ForecastLegend() {
  const item = (swatch: React.ReactNode, label: string) => (
    <li className="flex items-center gap-1.5">
      {swatch}
      {label}
    </li>
  );
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
      {item(<span className="size-2.5 rounded-[3px]" style={{ background: C.won }} />, "Won")}
      {item(<span className="size-2.5 rounded-[3px]" style={{ background: C.weighted }} />, "Weighted pipeline")}
      {item(<span className="size-2.5 rounded-[3px]" style={{ background: C.open }} />, "Rest of open pipeline")}
      {item(<span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: C.target }} />, "Target")}
    </ul>
  );
}

export function ForecastChart({ points, currency, currentMonth, onSelectMonth }: { points: MonthPoint[]; currency: Currency; currentMonth: string; onSelectMonth?: (month: string) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...points.flatMap((p) => [p.won, p.open, p.target ?? 0])) * 1.05);
  const pw = W - M.l - M.r;
  const ph = H - M.t - M.b;
  const y = (v: number) => M.t + ph - (v / max) * ph;
  const gw = pw / points.length;
  const bw = Math.min(30, gw * 0.26);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const hp = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Won and pipeline by month in ${currency}. A table view is available.`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke={C.grid} strokeWidth={1} />
            <text x={M.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={C.axis} className="tabular-nums">
              {formatAmount(t, currency, { compact: true })}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const cx = M.l + gw * i + gw / 2;
          const current = p.month === currentMonth;
          return (
            <g key={p.month}>
              {hover === i && <rect x={M.l + gw * i + 2} y={M.t} width={gw - 4} height={ph} rx={6} fill="#f3f6f7" />}
              <path d={bar(cx - bw - 1, y(p.won), bw, y(0) - y(p.won))} fill={C.won} />
              <path d={bar(cx + 1, y(p.open), bw, y(0) - y(p.open))} fill={C.open} />
              {/* Weighted sits inside open, separated by a 2px surface gap at its top. */}
              {p.weighted > 0 && <path d={bar(cx + 1, y(p.weighted), bw, y(0) - y(p.weighted))} fill={C.weighted} stroke="#fff" strokeWidth={p.open > p.weighted ? 2 : 0} paintOrder="stroke" />}
              {p.target !== null && <line x1={cx - gw * 0.36} x2={cx + gw * 0.36} y1={y(p.target)} y2={y(p.target)} stroke={C.target} strokeWidth={2} strokeDasharray="5 4" />}
              <text x={cx} y={H - 10} textAnchor="middle" fontSize={11} fill={current ? "#0f2329" : C.axis} fontWeight={current ? 600 : 400}>
                {monthLabel(p.month)}
                {current ? " · now" : ""}
              </text>
              {/* Hit target: the whole month column. */}
              <rect
                x={M.l + gw * i}
                y={M.t}
                width={gw}
                height={ph + M.b}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onClick={() => onSelectMonth?.(p.month)}
                className={cn(onSelectMonth && "cursor-pointer")}
              />
            </g>
          );
        })}
        <line x1={M.l} x2={W - M.r} y1={y(0)} y2={y(0)} stroke="#c9d4d8" strokeWidth={1} />
      </svg>
      {hp && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-52 rounded-xl border border-border bg-popover p-3 text-xs shadow-md"
          style={{ left: `clamp(0px, calc(${((M.l + gw * hover + gw / 2) / W) * 100}% - 6.5rem), calc(100% - 13rem))` }}
          role="status"
        >
          <p className="mb-1.5 font-semibold">{monthLabel(hp.month, { month: "long", year: "numeric" })}</p>
          <dl className="space-y-1">
            {[
              ["Won", hp.won, C.won],
              ["Weighted pipeline", hp.weighted, C.weighted],
              ["Open pipeline", hp.open, C.open],
            ].map(([l, v, c]) => (
              <div key={l as string} className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-[2px]" style={{ background: c as string }} />
                  {l}
                </dt>
                <dd className="font-medium tabular-nums">{formatAmount(v as number, currency)}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-1">
              <dt className="text-muted-foreground">Target</dt>
              <dd className="font-medium tabular-nums">{hp.target !== null ? formatAmount(hp.target, currency) : "None set"}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
