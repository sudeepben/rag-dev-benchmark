import { NextResponse } from "next/server";
import { getPglite } from "@/lib/db";
import { itemToText, chunkText } from "@/lib/rag/chunk";
import { embedTexts } from "@/lib/rag/embed";
import {
  isPineconeConfigured,
  ensureIndex,
  upsertToPinecone,
} from "@/lib/rag/pinecone";

const SAMPLE_ITEMS = [
  { name: "Wireless Bluetooth Headphones", sku: "ELEC-WBH-001", description: "Over-ear noise-cancelling headphones with 30-hour battery life and premium sound quality. Features active noise cancellation and built-in microphone.", category: "Electronics", brand: "SoundCore", price: "89.99", discount: "15", stock: 45 },
  { name: "Mechanical Gaming Keyboard", sku: "ELEC-MGK-002", description: "RGB backlit mechanical keyboard with Cherry MX Blue switches. Full-size layout with dedicated macro keys and USB passthrough.", category: "Electronics", brand: "KeyTech", price: "129.99", discount: null, stock: 32 },
  { name: "4K Ultra HD Webcam", sku: "ELEC-4KW-003", description: "Professional 4K webcam with auto-focus, built-in ring light, and dual noise-cancelling microphones. Perfect for streaming and video calls.", category: "Electronics", brand: "VisionPro", price: "79.99", discount: "10", stock: 58 },
  { name: "Portable Bluetooth Speaker", sku: "ELEC-PBS-004", description: "Waterproof IPX7 portable speaker with 360-degree sound. 20-hour battery life with built-in power bank functionality.", category: "Electronics", brand: "SoundCore", price: "49.99", discount: null, stock: 120 },
  { name: "Stainless Steel French Press", sku: "KTCH-SFP-001", description: "Double-wall insulated French press coffee maker. 34oz capacity with 4-level filtration system for smooth, grit-free coffee.", category: "Kitchen", brand: "BrewMaster", price: "34.99", discount: "20", stock: 85 },
  { name: "Non-Stick Cookware Set", sku: "KTCH-NCS-002", description: "12-piece ceramic non-stick cookware set. Includes frying pans, saucepans, stockpot, and utensils. Dishwasher safe and PFOA-free.", category: "Kitchen", brand: "ChefLine", price: "149.99", discount: null, stock: 22 },
  { name: "Digital Kitchen Scale", sku: "KTCH-DKS-003", description: "Precision digital kitchen scale with LCD display. Measures in grams, ounces, pounds, and milliliters. Tare function and auto-off.", category: "Kitchen", brand: "MeasurePro", price: "24.99", discount: "5", stock: 200 },
  { name: "High-Speed Blender", sku: "KTCH-HSB-004", description: "1500W professional blender with variable speed control. 64oz BPA-free pitcher, self-cleaning mode, and pulse function for smoothies and soups.", category: "Kitchen", brand: "BlendMax", price: "99.99", discount: null, stock: 40 },
  { name: "Ergonomic Office Chair", sku: "OFFC-EOC-001", description: "Adjustable lumbar support office chair with breathable mesh back. Height-adjustable armrests, headrest, and 360-degree swivel with smooth casters.", category: "Office", brand: "ComfortDesk", price: "299.99", discount: "25", stock: 15 },
  { name: "Standing Desk Converter", sku: "OFFC-SDC-002", description: "Height-adjustable standing desk converter with gas spring lift. Fits dual monitors, keyboard tray, and cable management system.", category: "Office", brand: "ComfortDesk", price: "189.99", discount: null, stock: 28 },
  { name: "Wireless Ergonomic Mouse", sku: "OFFC-WEM-003", description: "Vertical ergonomic mouse with adjustable DPI settings. Rechargeable battery lasts 3 months. Compatible with Windows and Mac.", category: "Office", brand: "KeyTech", price: "39.99", discount: "10", stock: 95 },
  { name: "Desk Organizer Set", sku: "OFFC-DOS-004", description: "Bamboo desk organizer with file sorter, pen holder, drawer, and phone stand. Eco-friendly and stylish workspace solution.", category: "Office", brand: "NeatSpace", price: "44.99", discount: null, stock: 60 },
  { name: "Yoga Mat Premium", sku: "SPRT-YMP-001", description: "Extra thick 6mm yoga mat with alignment lines. Non-slip surface, eco-friendly TPE material. Includes carrying strap.", category: "Sports", brand: "FlexFit", price: "39.99", discount: "15", stock: 150 },
  { name: "Adjustable Dumbbell Set", sku: "SPRT-ADS-002", description: "Adjustable dumbbell set ranging from 5 to 52.5 lbs. Quick-change weight system with anti-slip grip. Replaces 15 sets of dumbbells.", category: "Sports", brand: "IronCore", price: "349.99", discount: null, stock: 18 },
  { name: "Running Hydration Vest", sku: "SPRT-RHV-003", description: "Lightweight hydration vest with two 500ml soft flasks. Reflective strips, multiple pockets, and adjustable chest straps for trail running.", category: "Sports", brand: "TrailBlaze", price: "59.99", discount: "10", stock: 72 },
  { name: "Resistance Band Set", sku: "SPRT-RBS-004", description: "Set of 5 resistance bands with varying tension levels. Includes door anchor, ankle straps, and carrying bag. Latex-free.", category: "Sports", brand: "FlexFit", price: "29.99", discount: null, stock: 200 },
  { name: "Smart LED Floor Lamp", sku: "HOME-SFL-001", description: "WiFi-enabled LED floor lamp with 16 million colors and tunable white. Voice control via Alexa and Google Home. Dimmable with app control.", category: "Home", brand: "LumiSmart", price: "69.99", discount: "20", stock: 55 },
  { name: "Weighted Blanket", sku: "HOME-WBL-002", description: "15lb weighted blanket with cooling bamboo cover. Glass bead filling for even weight distribution. Machine washable cover.", category: "Home", brand: "DreamComfort", price: "79.99", discount: null, stock: 38 },
  { name: "Air Purifier HEPA", sku: "HOME-APH-003", description: "True HEPA air purifier covering 500 sq ft. Three-stage filtration captures 99.97% of particles. Quiet sleep mode and air quality indicator.", category: "Home", brand: "CleanAir", price: "159.99", discount: "15", stock: 30 },
  { name: "Aromatherapy Diffuser", sku: "HOME-ARD-004", description: "Ultrasonic essential oil diffuser with 300ml capacity. 7 LED color options, timer settings, and auto shut-off. Whisper-quiet operation.", category: "Home", brand: "ZenMist", price: "27.99", discount: null, stock: 110 },
];

export async function POST() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const client = await getPglite();

    // Insert all items
    const itemIds: string[] = [];
    for (const sample of SAMPLE_ITEMS) {
      const id = crypto.randomUUID();
      itemIds.push(id);
      await client.query(
        `INSERT INTO items (id, sku, name, description, category, brand, price, discount, stock)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          sample.sku,
          sample.name,
          sample.description,
          sample.category,
          sample.brand,
          parseFloat(sample.price),
          sample.discount ? parseFloat(sample.discount) : null,
          sample.stock,
        ]
      );
    }

    // Generate text, chunk, and embed
    const allChunks: {
      id: string;
      itemId: string;
      content: string;
      metadata: Record<string, unknown>;
    }[] = [];

    for (let i = 0; i < SAMPLE_ITEMS.length; i++) {
      const sample = SAMPLE_ITEMS[i];
      const id = itemIds[i];
      const text = itemToText({
        id,
        name: sample.name,
        description: sample.description,
        category: sample.category,
        brand: sample.brand,
        price: sample.price,
        discount: sample.discount,
        sku: sample.sku,
      });
      const chunks = chunkText(id, text);
      allChunks.push(...chunks);
    }

    // Embed all chunks at once
    const chunkTexts = allChunks.map((c) => c.content);
    const embeddings = await embedTexts(chunkTexts);

    // Insert chunks into PGlite
    for (let i = 0; i < allChunks.length; i++) {
      await client.query(
        `INSERT INTO chunks (id, item_id, content, metadata, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)
         ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding`,
        [
          allChunks[i].id,
          allChunks[i].itemId,
          allChunks[i].content,
          JSON.stringify(allChunks[i].metadata),
          `[${embeddings[i].join(",")}]`,
        ]
      );
    }

    // Upsert to Pinecone if configured
    let pineconeResult: { upserted: number } | null = null;
    if (isPineconeConfigured()) {
      try {
        await ensureIndex(embeddings[0].length);
        pineconeResult = await upsertToPinecone(allChunks, embeddings);
      } catch {
        // Pinecone upsert failure is non-fatal
      }
    }

    return NextResponse.json({
      items: SAMPLE_ITEMS.length,
      chunks: allChunks.length,
      pinecone: pineconeResult,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
