import "server-only";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function readPdfText(data: Uint8Array) {
  const task = getDocument({ data, isEvalSupported: false, useSystemFonts: true });
  try {
    const pdf = await task.promise;
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(20, pdf.numPages); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim());
    }
    return pages.join("\n\n");
  } finally {
    await task.destroy();
  }
}
