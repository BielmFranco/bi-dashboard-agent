"use client";

import { motion } from "framer-motion";
import type { BoxplotStats, ChartSpec } from "@/lib/api";
import Boxplot from "@/components/Boxplot";
import { fmtCompactBR, fmtNumberBR, truncate } from "@/lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
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

const COLORS = [
  "var(--primary)",
  "#22d3ee",
  "#34d399",
  "#f472b6",
  "#facc15",
  "#fb923c",
  "#a78bfa",
  "#f87171",
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

  const axisColor = "var(--muted-foreground)";
  const gridColor = "var(--border)";
  const tooltipStyle = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--card-foreground)",
    fontSize: 12,
    padding: "8px 10px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
  } as const;
  const tooltipItemStyle = { color: "var(--card-foreground)" } as const;
  const tooltipLabelStyle = {
    color: "var(--muted-foreground)",
    fontSize: 11,
    marginBottom: 4,
    fontWeight: 500,
  } as const;

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
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke={axisColor}
                  fontSize={10.5}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => truncate(String(v), 12)}
                />
                <YAxis
                  stroke={axisColor}
                  fontSize={10.5}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={compactFormatter}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(v: number) => [numberFormatter(v), chart.y_label || "Valor"]}
                />
                <Bar
                  dataKey="value"
                  fill="var(--primary)"
                  radius={[6, 6, 0, 0]}
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
              <LineChart data={data} margin={{ top: 6, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke={axisColor}
                  fontSize={10.5}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => truncate(String(v), 12)}
                />
                <YAxis
                  stroke={axisColor}
                  fontSize={10.5}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={compactFormatter}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(v: number) => [numberFormatter(v), chart.y_label || "Valor"]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--primary)" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
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
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(v: number, _n: string, p: { payload?: { label?: string } }) => [
                    numberFormatter(v),
                    p.payload?.label ?? "",
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10.5, paddingTop: 4 }}
                  iconSize={9}
                  verticalAlign="bottom"
                  align="center"
                  formatter={(v) => truncate(String(v), 14)}
                />
              </PieChart>
            ) : (
              <ScatterChart margin={{ top: 6, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                <XAxis
                  dataKey="x"
                  stroke={axisColor}
                  fontSize={10.5}
                  name={chart.x_label}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={compactFormatter}
                />
                <YAxis
                  dataKey="y"
                  stroke={axisColor}
                  fontSize={10.5}
                  name={chart.y_label}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={compactFormatter}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  cursor={{ strokeDasharray: "3 3", stroke: "var(--muted-foreground)" }}
                  formatter={(v: number) => numberFormatter(v)}
                />
                <Scatter data={data} fill="var(--primary)" fillOpacity={0.7} />
              </ScatterChart>
            )}
          </ResponsiveContainer>
        </div>
      </Card>
    </motion.div>
  );
}
