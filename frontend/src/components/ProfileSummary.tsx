import type { Profile } from "@/lib/api";

export default function ProfileSummary({ profile }: { profile: Profile }) {
  const issues: string[] = [];
  if (profile.duplicates > 0) issues.push(`${profile.duplicates} linhas duplicadas`);
  if (profile.empty_columns.length)
    issues.push(`Colunas vazias: ${profile.empty_columns.join(", ")}`);
  profile.columns.forEach((c) => {
    if (c.null_pct > 30) issues.push(`${c.name}: ${c.null_pct}% nulos`);
  });

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="font-semibold mb-3">Resumo da Base</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-slate-400">Linhas</p>
          <p className="text-xl font-semibold">{profile.rows.toLocaleString("pt-BR")}</p>
        </div>
        <div>
          <p className="text-slate-400">Colunas</p>
          <p className="text-xl font-semibold">{profile.cols}</p>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Colunas detectadas</p>
        <div className="max-h-56 overflow-y-auto space-y-1 text-xs font-mono">
          {profile.columns.map((c) => (
            <div key={c.name} className="flex justify-between border-b border-slate-800 pb-1">
              <span>{c.name}</span>
              <span className="text-slate-400">
                {c.semantic} · {c.null_pct}% nulos
              </span>
            </div>
          ))}
        </div>
      </div>
      {issues.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-800/50 bg-amber-900/20 p-3">
          <p className="text-amber-300 text-xs font-semibold mb-1">Alertas</p>
          <ul className="text-xs text-amber-100 list-disc list-inside space-y-1">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
