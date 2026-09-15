"use client";

import { motion } from "framer-motion";
import type { BoxplotStats, ChartSpec } from "@/lib/api";
import Boxplot from "@/components/Boxplot";
import { fmtCompactBR, fmtNumberBR, truncate } from "@/lib/format";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Paleta categórica com base esmeralda/teal — coesa com a marca,
// com âmbar/laranja como contraste quente pontual.
const COLORS = [
  "var(--primary)",
  "#2dd4bf",
  "#22d3ee",
  "#a3e635",
  "#fbbf24",
  "#38bdf8",
  "#fb923c",
  "#94a3b8",
];

function fmtLabel(v: unknown) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" && /\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  return String(v);
}

const numberFormatter = (v: number | string) =>
  fmtNumberBR(typeof v === "number" ? v : Number(v));
const compactFormatter = (v: number | string) =>
  fmtCompactBR(typeof v === "number" ? v : Number(v));

// Ticks dos eixos em fonte monoespaçada tabular — leitura de "planilha/terminal".
const tickStyle = {
  fill: "var(--muted-foreground)",
  fontSize: 10.5,
  fontFamily: "var(--font-mono)",
} as const;

type TTItem = {
  color?: string;
  value?: number | string;
  name?: string;
  payload?: { label?: string };
};

/** Tooltip premium: swatch de cor + número mono tabular. */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TTItem[];
  label?: unknown;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const title =
    label !== undefined && label !== null && String(label) !== ""
      ? fmtLabel(label)
      : payload[0]?.payload?.label
        ? fmtLabel(payload[0].payload.label)
        : "";

  return (
    <div className="min-w-[7rem] rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 shadow-lg shadow-black/25">
      {title && (
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
          {truncate(title, 22)}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => {
          const name = p.name != null ? String(p.name) : "";
          const showName = name !== "" && name !== "value";
          return (
            <div key={i} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ background: p.color || "var(--primary)" }}
              />
              <span className="font-mono text-xs tabular-nums text-[var(--foreground)]">
                {numberFormatter(Number(p.value))}
              </span>
              {showName && (
                <span className="ml-auto max-w-[8rem] truncate pl-2 text-[11px] text-[var(--muted-foreground)]">
                  {truncate(name, 16)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Props = {
  chart: ChartSpec;
  index?: number;
  onDrill?: (column: string, value: string | number) => void;
};

export default function ChartBlock({ chart, index = 0, onDrill }: Props) {
  if (chart.type === "boxplot") {
    const stats = (chart.data[0] as BoxplotStats) || undefined;
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{chart.title}</CardTitle>
            <CardDescription>{chart.rationale}</CardDescription>
          </CardHeader>
          <div className="h-64 w-full px-4 pb-4">
            {stats ? (
              <Boxplot stats={stats} height={210} />
            ) : (
              <p className="text-xs text-[var(--muted-foreground)]">Sem dados</p>
            )}
          </div>
        </Card>
      </motion.div>
    );
  }

  const data = (chart.data as { label?: string; value?: number; x?: number; y?: number }[]).map((d) => ({ ...d, label: fmtLabel(d.label) }));

  const gridColor = "var(--border)";
  const valueName = chart.y_label || "Valor";
  const areaId = `area-${chart.id}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{chart.title}</CardTitle>
          <CardDescription>{chart.rationale}</CardDescription>
        </CardHeader>
        <div className="h-64 w-full px-2 pb-4">
          <ResponsiveContainer width="100%" height="100%">
            {chart.type === "bar" ? (
              <BarChart data={data} margin={{ top: 6, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid stroke={gridColor} strokeDasharray="2 6" strokeOpacity={0.6} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={tickStyle}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => truncate(String(v), 12)}
                />
                <YAxis
                  tick={tickStyle}
                  width={44}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={compactFormatter}
                />
                <Tooltip
                  cursor={{ fill: "var(--primary)", opacity: 0.08 }}
                  content={<ChartTooltip />}
                />
                <Bar
                  dataKey="value"
                  name={valueName}
                  fill="var(--primary)"
                  fillOpacity={0.88}
                  radius={[5, 5, 0, 0]}
                  activeBar={{ fillOpacity: 1 }}
                  cursor={onDrill && chart.x_label ? "pointer" : "default"}
                  onClick={(d: unknown) => {
                    if (!onDrill || !chart.x_label) return;
                    const label = (d as { label?: string })?.label;
                    if (label !== undefined && label !== null && label !== "")
                      onDrill(chart.x_label, label);
                  }}
                />
              </BarChart>
            ) : chart.type === "line" ? (
              <AreaChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridColor} strokeDasharray="2 6" strokeOpacity={0.6} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={tickStyle}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => truncate(String(v), 12)}
                />
                <YAxis
                  tick={tickStyle}
                  width={44}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={compactFormatter}
                />
                <Tooltip
                  cursor={{ stroke: "var(--primary)", strokeOpacity: 0.35, strokeWidth: 1 }}
                  content={<ChartTooltip />}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name={valueName}
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill={`url(#${areaId})`}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }}
                />
              </AreaChart>
            ) : chart.type === "pie" ? (
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="42%"
                  outerRadius="70%"
                  innerRadius="42%"
                  paddingAngle={2}
                  labelLine={false}
                  isAnimationActive={false}
                >
                  {data.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                      stroke="var(--card)"
                      strokeWidth={2}
                      cursor={onDrill && chart.x_label ? "pointer" : "default"}
                      onClick={() => {
                        if (!onDrill || !chart.x_label) return;
                        const label = (entry as { label?: string })?.label;
                        if (label) onDrill(chart.x_label, label);
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 10.5, paddingTop: 4 }}
                  iconSize={9}
                  verticalAlign="bottom"
                  align="center"
                  formatter={(v) => truncate(String(v), 14)}
                />
              </PieChart>
            ) : (
              <ScatterChart margin={{ top: 6, right: 12, left: 0, bottom: 5 }}>
                <CartesianGrid stroke={gridColor} strokeDasharray="2 6" strokeOpacity={0.6} />
                <XAxis
                  dataKey="x"
                  tick={tickStyle}
                  name={chart.x_label}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={compactFormatter}
                />
                <YAxis
                  dataKey="y"
                  tick={tickStyle}
                  width={44}
                  name={chart.y_label}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={compactFormatter}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ strokeDasharray: "3 3", stroke: "var(--muted-foreground)" }}
                />
                <Scatter data={data} fill="var(--primary)" fillOpacity={0.72} />
              </ScatterChart>
            )}
          </ResponsiveContainer>
        </div>
      </Card>
    </motion.div>
  );
}
