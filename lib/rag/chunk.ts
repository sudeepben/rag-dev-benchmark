export interface Chunk {
  id: string;
  itemId: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface ItemForChunking {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  brand?: string | null;
  price?: string | null;
  discount?: string | null;
  sku?: string | null;
}

export function itemToText(item: ItemForChunking): string {
  const parts: string[] = [`Product: ${item.name}`];
  if (item.brand) parts.push(`Brand: ${item.brand}`);
  if (item.category) parts.push(`Category: ${item.category}`);
  if (item.price) parts.push(`Price: $${item.price}`);
  if (item.discount) parts.push(`Discount: ${item.discount}%`);
  if (item.sku) parts.push(`SKU: ${item.sku}`);
  if (item.description) parts.push(`Description: ${item.description}`);
  return parts.join("\n");
}

export function chunkText(
  itemId: string,
  text: string,
  options: { chunkSize?: number; overlap?: number } = {}
): Chunk[] {
  const { chunkSize = 800, overlap = 120 } = options;
  const chunks: Chunk[] = [];

  if (!text || text.trim().length === 0) return chunks;

  const cleanText = text.replace(/\s+/g, " ").trim();

  // If text fits in one chunk, don't split
  if (cleanText.length <= chunkSize) {
    return [
      {
        id: `${itemId}::chunk::0000`,
        itemId,
        content: cleanText,
        metadata: { index: 0, start: 0, end: cleanText.length },
      },
    ];
  }

  let start = 0;
  let index = 0;

  while (start < cleanText.length) {
    let end = Math.min(start + chunkSize, cleanText.length);

    if (end < cleanText.length) {
      const lastSpace = cleanText.lastIndexOf(" ", end);
      if (lastSpace > start) {
        end = lastSpace;
      }
    }

    const chunkContent = cleanText.slice(start, end).trim();
    if (chunkContent.length > 0) {
      chunks.push({
        id: `${itemId}::chunk::${String(index).padStart(4, "0")}`,
        itemId,
        content: chunkContent,
        metadata: { index, start, end },
      });
      index++;
    }

    if (end >= cleanText.length) break;
    start = end - overlap;
    if (start >= cleanText.length) break;
  }

  return chunks;
}
