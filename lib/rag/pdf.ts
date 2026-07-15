/**
 * PDF text extraction for document ingestion.
 * Uses pdf-parse (pure JS, no native deps).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;

export async function extractPdfText(
  buffer: Buffer
): Promise<{ text: string; pages: number }> {
  const result = await pdfParse(buffer);
  return {
    text: result.text,
    pages: result.numpages,
  };
}
