import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Splits insights markdown by top-level `## X. Title` headings and
 * renders each as a self-contained card in a responsive grid.
 *
 * This avoids the pitfalls of CSS multi-column layout at print time
 * (empty columns, awkward page breaks, `break-inside` interactions)
 * by making each section a normal block that flows into the grid.
 */
export default function InsightsGrid({ markdown }: { markdown: string }) {
  const raw = (markdown ?? "").trim();
  if (!raw) return null;

  // Split by `##` headings but keep them attached to their section.
  // Everything before the first `##` becomes an intro card.
  const parts = raw.split(/\n(?=##\s)/g);
  const sections = parts
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return (
    <div className="report-insights-grid">
      {sections.map((section, i) => (
        <article key={i} className="report-insights-card">
          <div className="report-insights-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{section}</ReactMarkdown>
          </div>
        </article>
      ))}
    </div>
  );
}
