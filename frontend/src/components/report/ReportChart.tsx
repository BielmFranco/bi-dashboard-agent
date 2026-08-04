"use client";

import type { ChartSpec } from "@/lib/api";
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

const COLORS = [
  "#4f46e5",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#db2777",
  "#0284c7",
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

export default function ReportChart({ chart }: { chart: ChartSpec }) {
  const data = chart.data.map((d) => ({ ...d, label: fmtLabel(d.label) }));
  const axis = "#64748b";
  const grid = "#e2e8f0";
  const primary = "#4f46e5";

  return (
    <div className="report-chart">
      <h3 className="report-chart-title">{chart.title}</h3>
      <p className="report-chart-desc">{chart.rationale}</p>
      <div className="report-chart-body">
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === "bar" ? (
            <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                stroke={axis}
                fontSize={9.5}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={54}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => truncate(String(v), 12)}
              />
              <YAxis
                stroke={axis}
                fontSize={9.5}
                tickLine={false}
                axisLine={false}
                tickFormatter={compactFormatter}
              />
              <Tooltip formatter={(v: number) => [numberFormatter(v), chart.y_label || "Valor"]} />
              <Bar dataKey="value" fill={primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : chart.type === "line" ? (
            <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                stroke={axis}
                fontSize={9.5}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => truncate(String(v), 12)}
              />
              <YAxis stroke={axis} fontSize={9.5} tickLine={false} axisLine={false} tickFormatter={compactFormatter} />
              <Tooltip formatter={(v: number) => [numberFormatter(v), chart.y_label || "Valor"]} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={primary}
                strokeWidth={2.5}
                dot={{ r: 3, fill: primary }}
              />
            </LineChart>
          ) : chart.type === "pie" ? (
            <PieChart margin={{ top: 0, right: 4, left: 4, bottom: 0 }}>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="42%"
                outerRadius="70%"
                innerRadius="42%"
                paddingAngle={1.5}
                labelLine={false}
                stroke="#ffffff"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, _n: string, p: { payload?: { label?: string } }) => [
                  numberFormatter(v),
                  p.payload?.label ?? "",
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: 9, paddingTop: 4, lineHeight: 1.4 }}
                iconSize={8}
                verticalAlign="bottom"
                align="center"
                formatter={(v) => truncate(String(v), 14)}
              />
            </PieChart>
          ) : (
            <ScatterChart margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={grid} strokeDasharray="3 3" />
              <XAxis dataKey="x" stroke={axis} fontSize={9.5} name={chart.x_label} tickLine={false} axisLine={false} tickFormatter={compactFormatter} />
              <YAxis dataKey="y" stroke={axis} fontSize={9.5} name={chart.y_label} tickLine={false} axisLine={false} tickFormatter={compactFormatter} />
              <Tooltip formatter={(v: number) => numberFormatter(v)} />
              <Scatter data={data} fill={primary} fillOpacity={0.7} />
            </ScatterChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
