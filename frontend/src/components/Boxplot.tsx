"use client";

import { fmtCompactBR, fmtNumberBR } from "@/lib/format";
import type { BoxplotStats } from "@/lib/api";

type Props = {
  stats: BoxplotStats;
  height?: number;
  color?: string;
  outlierColor?: string;
};

/**
 * Horizontal boxplot rendered as inline SVG.
 * Shows: whiskers (min–max), box (Q1–Q3), median line, outliers as dots.
 */
export default function Boxplot({
  stats,
  height = 190,
  color = "var(--primary)",
  outlierColor = "#dc2626",
}: Props) {
  const {
    min,
    q1,
    median,
    q3,
    max,
    abs_min,
    abs_max,
    outliers,
    outliers_count,
    mean,
  } = stats;

  const domainMin = abs_min;
  const domainMax = abs_max;
  const range = Math.max(1e-9, domainMax - domainMin);

  const PAD_X = 24;
  const W = 520;
  const H = height;
  const trackY = H * 0.45;
  const boxH = H * 0.36;
  const boxTop = trackY - boxH / 2;
  const whiskerH = boxH * 0.6;

  const x = (v: number) =>
    PAD_X + ((v - domainMin) / range) * (W - PAD_X * 2);

  // Y-axis ticks (approx 5)
  const ticks: number[] = [];
  const step = range / 4;
  for (let i = 0; i <= 4; i++) ticks.push(domainMin + i * step);

  return (
    <div className="w-full h-full flex flex-col">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        role="img"
        aria-label="Boxplot"
      >
        {/* Grid lines */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={x(t)}
            x2={x(t)}
            y1={12}
            y2={H - 24}
            stroke="var(--border)"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
        ))}

        {/* Whisker line (min to max) */}
        <line
          x1={x(min)}
          x2={x(max)}
          y1={trackY}
          y2={trackY}
          stroke={color}
          strokeWidth={1.5}
        />

        {/* Whisker caps */}
        <line
          x1={x(min)}
          x2={x(min)}
          y1={trackY - whiskerH / 2}
          y2={trackY + whiskerH / 2}
          stroke={color}
          strokeWidth={1.5}
        />
        <line
          x1={x(max)}
          x2={x(max)}
          y1={trackY - whiskerH / 2}
          y2={trackY + whiskerH / 2}
          stroke={color}
          strokeWidth={1.5}
        />

        {/* Box (Q1 → Q3) */}
        <rect
          x={x(q1)}
          y={boxTop}
          width={x(q3) - x(q1)}
          height={boxH}
          fill={color}
          fillOpacity={0.25}
          stroke={color}
          strokeWidth={1.5}
          rx={2}
        />

        {/* Median line */}
        <line
          x1={x(median)}
          x2={x(median)}
          y1={boxTop}
          y2={boxTop + boxH}
          stroke={color}
          strokeWidth={2.5}
        />

        {/* Mean cross marker (optional soft indicator) */}
        <g opacity={0.6}>
          <line
            x1={x(mean) - 4}
            x2={x(mean) + 4}
            y1={trackY - 4}
            y2={trackY + 4}
            stroke={color}
            strokeWidth={1}
          />
          <line
            x1={x(mean) - 4}
            x2={x(mean) + 4}
            y1={trackY + 4}
            y2={trackY - 4}
            stroke={color}
            strokeWidth={1}
          />
        </g>

        {/* Outliers */}
        {outliers.map((v, i) => (
          <circle
            key={i}
            cx={x(v)}
            cy={trackY}
            r={3}
            fill={outlierColor}
            fillOpacity={0.7}
            stroke="var(--card)"
            strokeWidth={0.5}
          >
            <title>Outlier: {fmtNumberBR(v)}</title>
          </circle>
        ))}

        {/* X-axis ticks labels */}
        {ticks.map((t, i) => (
          <text
            key={i}
            x={x(t)}
            y={H - 8}
            textAnchor="middle"
            fontSize={9.5}
            fill="var(--muted-foreground)"
            fontFamily="var(--font-geist-mono)"
          >
            {fmtCompactBR(t)}
          </text>
        ))}
      </svg>

      <div className="mt-1 grid grid-cols-4 gap-1 text-[9.5px] text-[var(--muted-foreground)] tabular-nums px-1">
        <span>
          Q1:{" "}
          <strong className="text-[var(--foreground)]">{fmtCompactBR(q1)}</strong>
        </span>
        <span>
          Med:{" "}
          <strong className="text-[var(--foreground)]">
            {fmtCompactBR(median)}
          </strong>
        </span>
        <span>
          Q3:{" "}
          <strong className="text-[var(--foreground)]">{fmtCompactBR(q3)}</strong>
        </span>
        <span>
          Outliers:{" "}
          <strong style={{ color: outliers_count > 0 ? outlierColor : "inherit" }}>
            {outliers_count}
          </strong>
        </span>
      </div>
    </div>
  );
}
