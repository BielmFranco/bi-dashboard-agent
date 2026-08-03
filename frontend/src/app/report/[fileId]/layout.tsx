import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Relatório · BI Dashboard Agent",
  description: "Relatório executivo para impressão em PDF",
};

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="report-scope"
      style={{ colorScheme: "light", background: "#f8fafc", minHeight: "100vh" }}
    >
      {children}
    </div>
  );
}
