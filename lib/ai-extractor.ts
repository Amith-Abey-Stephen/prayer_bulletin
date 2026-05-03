// Using global fetch (Node >=18) – no external node-fetch needed
import { z } from 'zod';

// Schema for the expected structured metadata
export const MetadataSchema = z.object({
  name: z.string().default("Unknown"),
  capital: z.string().default("Unknown"),
  population: z.number().nullable().default(null),
  area: z.number().nullable().default(null),
  literacy: z.number().nullable().default(null),
  religion: z.object({
    hindu: z.number().nullable().default(null),
    muslim: z.number().nullable().default(null),
    christian: z.number().nullable().default(null)
  }).default({ hindu: null, muslim: null, christian: null }),
  governmentParty: z.string().nullable().default(null),
  majorCities: z.array(z.string()).default([]),
  coordinates: z.object({
    lat: z.number().nullable().default(null),
    lng: z.number().nullable().default(null)
  }).default({ lat: null, lng: null })
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
    messages: [
      { 
        role: 'system', 
        content: 'You are a strict metadata extraction engine. Output ONLY valid JSON matching the user-specified schema. No markdown, no explanations, no preamble.' 
      },
      { role: 'user', content: sourceText }
    ]
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
    const errorText = await response.text();
    throw new Error(`OpenRouter request failed with ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  let raw = data?.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error('No content returned from model');
  }

  // Robust JSON extraction: Handle markdown blocks if present
  if (raw.includes('```')) {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      raw = match[1];
    }
  }

  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}') + 1;
  
  if (jsonStart === -1 || jsonEnd === 0) {
    throw new Error('No JSON object found in model response');
  }

  const jsonString = raw.slice(jsonStart, jsonEnd);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    console.error('Raw content that failed parsing:', raw);
    throw new Error('Model returned malformed JSON');
  }

  const result = MetadataSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('Validation failed: ' + JSON.stringify(result.error.format()));
  }

  cache.set(cacheKey, result.data);
  return result.data;
}
