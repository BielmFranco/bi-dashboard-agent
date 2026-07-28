"use client";

import type { ChartSpec } from "@/lib/api";
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
  "#818cf8",
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

export default function ChartBlock({ chart }: { chart: ChartSpec }) {
  const data = chart.data.map((d) => ({
    ...d,
    label: fmtLabel(d.label),
  }));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3">
        <h3 className="font-semibold">{chart.title}</h3>
        <p className="text-xs text-slate-400">{chart.rationale}</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} interval={0} angle={-25} textAnchor="end" height={60} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
              <Bar dataKey="value" fill="#818cf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : chart.type === "line" ? (
            <LineChart data={data}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
              <Line type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          ) : chart.type === "pie" ? (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="label" outerRadius={90} label>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          ) : (
            <ScatterChart>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="x" stroke="#94a3b8" fontSize={11} name={chart.x_label} />
              <YAxis dataKey="y" stroke="#94a3b8" fontSize={11} name={chart.y_label} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={data} fill="#f472b6" />
            </ScatterChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
