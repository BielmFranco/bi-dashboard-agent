import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export async function generateDashboardPdf(
  element: HTMLElement,
  filename: string = "relatorio.pdf",
  orientation: "p" | "l" = "l",
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const pdf = new jsPDF(orientation, "mm", "a4");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const scale = pageW / canvas.width;
  const pageHeightPx = pageH / scale;

  let y = 0;
  let pageNum = 0;

  while (y < canvas.height) {
    if (pageNum > 0) pdf.addPage();

    const sliceH = Math.min(pageHeightPx, canvas.height - y);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceH;
    const ctx = sliceCanvas.getContext("2d")!;
    ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

    pdf.addImage(
      sliceCanvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      0,
      0,
      pageW,
      sliceH * scale,
    );

    y += pageHeightPx;
    pageNum++;
  }

  pdf.save(filename);
}
