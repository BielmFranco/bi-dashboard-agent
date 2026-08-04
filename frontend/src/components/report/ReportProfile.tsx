import type { Profile } from "@/lib/api";
import { fmtNumberBR } from "@/lib/format";

const SEMANTIC_LABEL: Record<string, string> = {
  numeric: "Numérica",
  categorical: "Categórica",
  datetime: "Data",
  datetime_like: "Data",
  boolean: "Boolean",
  id: "Identificador",
  text: "Texto",
  empty: "Vazia",
  unknown: "Outro",
};

const SEMANTIC_COLOR: Record<string, string> = {
  numeric: "#4f46e5",
  categorical: "#0891b2",
  datetime: "#0891b2",
  datetime_like: "#0891b2",
  boolean: "#0891b2",
  id: "#64748b",
  text: "#64748b",
  empty: "#dc2626",
  unknown: "#64748b",
};

export default function ReportProfile({ profile }: { profile: Profile }) {
  const alerts: string[] = [];
  if (profile.duplicates > 0) alerts.push(`${profile.duplicates} linhas duplicadas`);
  if (profile.empty_columns.length)
    alerts.push(`Colunas 100% vazias: ${profile.empty_columns.join(", ")}`);
  profile.columns.forEach((c) => {
    if (c.null_pct > 30 && c.semantic !== "empty")
      alerts.push(`${c.name} — ${c.null_pct}% nulos`);
  });

  return (
    <div className="report-profile">
      <div className="report-profile-stats">
        <div>
          <p className="report-stat-label">Registros</p>
          <p className="report-stat-value">
            {fmtNumberBR(profile.rows, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div>
          <p className="report-stat-label">Colunas</p>
          <p className="report-stat-value">{profile.cols}</p>
        </div>
        <div>
          <p className="report-stat-label">Duplicadas</p>
          <p className="report-stat-value">{profile.duplicates}</p>
        </div>
        <div>
          <p className="report-stat-label">Colunas vazias</p>
          <p className="report-stat-value">{profile.empty_columns.length}</p>
        </div>
      </div>

      <table className="report-table">
        <thead>
          <tr>
            <th>Coluna</th>
            <th>Tipo</th>
            <th className="report-num">Nulos</th>
            <th className="report-num">Únicos</th>
          </tr>
        </thead>
        <tbody>
          {profile.columns.map((c) => (
            <tr key={c.name}>
              <td className="report-mono">{c.name}</td>
              <td>
                <span
                  className="report-badge"
                  style={{ background: SEMANTIC_COLOR[c.semantic] ?? "#64748b" }}
                >
                  {SEMANTIC_LABEL[c.semantic] ?? c.semantic}
                </span>
              </td>
              <td className="report-num">{c.null_pct}%</td>
              <td className="report-num">
                {fmtNumberBR(c.unique, { maximumFractionDigits: 0 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {alerts.length > 0 && (
        <div className="report-alerts">
          <p className="report-alerts-title">Alertas de qualidade</p>
          <ul>
            {alerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
