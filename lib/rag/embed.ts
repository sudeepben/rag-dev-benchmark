import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export async function embedTexts(
  texts: string[],
  model: string = "text-embedding-3-small"
): Promise<number[][]> {
  const openai = getClient();
  const batchSize = 64;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await openai.embeddings.create({
      model,
      input: batch,
    });

    for (const item of response.data) {
      allEmbeddings.push(item.embedding);
    }
  }

  return allEmbeddings;
}

export async function embedQuery(
  query: string,
  model: string = "text-embedding-3-small"
): Promise<number[]> {
  const [embedding] = await embedTexts([query], model);
  return embedding;
}
