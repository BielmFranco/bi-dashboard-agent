// Node 20+ retorna U+202F (narrow no-break space) como separador de milhar em pt-BR;
// browsers/Node antigos podem devolver U+00A0 ou ".". Normaliza pra hidratacao SSR igual.
const normalizeBR = (s: string) => s.replace(/\s/g, ".");

export function fmtNumberBR(v: number | null | undefined, opts?: Intl.NumberFormatOptions) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return normalizeBR(v.toLocaleString("pt-BR", { maximumFractionDigits: 2, ...opts }));
}

export function fmtCompactBR(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return normalizeBR((v / 1_000_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })) + " Bi";
  if (abs >= 1_000_000) return normalizeBR((v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })) + " Mi";
  if (abs >= 10_000) return normalizeBR((v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })) + " mil";
  return normalizeBR(v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
}

export function truncate(s: string, max = 18) {
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
