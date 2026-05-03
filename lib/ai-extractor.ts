// Using global fetch (Node >=18) – no external node-fetch needed
import { z } from 'zod';

// Schema for the expected structured metadata
export const MetadataSchema = z.object({
  name: z.string(),
  capital: z.string(),
  population: z.number().nullable(),
  area: z.number().nullable(),
  literacy: z.number().nullable(),
  religion: z.object({
    hindu: z.number().nullable(),
    muslim: z.number().nullable(),
    christian: z.number().nullable()
  }),
  governmentParty: z.string().nullable(),
  majorCities: z.array(z.string()),
  coordinates: z.object({
    lat: z.number().nullable(),
    lng: z.number().nullable()
  })
});

type Metadata = z.infer<typeof MetadataSchema>;

// Simple in‑memory cache
const cache = new Map<string, Metadata>();

/**
 * Sends raw source text to the GLM‑4.5 Air model and returns validated metadata.
 * The model is forced to respond with strict JSON matching MetadataSchema.
 */
export async function extractMetadata(sourceText: string, cacheKey: string): Promise<Metadata> {
  // Return cached result if present
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const payload = {
    model: 'z-ai/glm-4.5-air:free',
    temperature: 0,
    top_p: 0.1,
    messages: [{ role: 'user', content: sourceText }]
  };

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`OpenRouter request failed with ${response.status}`);
  }

  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error('No content returned from model');
  }

  // The model should output raw JSON without markdown. Guard against stray characters.
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}') + 1;
  const jsonString = raw.slice(jsonStart, jsonEnd);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    throw new Error('Model returned malformed JSON');
  }

  const result = MetadataSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('Validation failed: ' + JSON.stringify(result.error.format()));
  }

  cache.set(cacheKey, result.data);
  return result.data;
}
