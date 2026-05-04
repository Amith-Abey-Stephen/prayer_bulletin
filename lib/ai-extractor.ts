// Using global fetch (Node >=18) – no external node-fetch needed
import { z } from 'zod';

// Schema for the expected structured metadata with automatic coercion for numeric strings
export const MetadataSchema = z.object({
  name: z.string().nullable().transform(val => val ?? "Unknown").default("Unknown"),
  capital: z.string().nullable().transform(val => val ?? "Unknown").default("Unknown"),
  population: z.coerce.number().nullable().catch(null).default(null),
  area: z.coerce.number().nullable().catch(null).default(null),
  literacy: z.coerce.number().nullable().catch(null).default(null),
  religion: z.object({
    hindu: z.coerce.number().nullable().catch(null).default(null),
    muslim: z.coerce.number().nullable().catch(null).default(null),
    christian: z.coerce.number().nullable().catch(null).default(null)
  }).default({ hindu: null, muslim: null, christian: null }),
  governmentHead: z.string().nullable().default(null),
  rulingParty: z.string().nullable().default(null),
  majorCities: z.array(z.object({
    name: z.string(),
    lat: z.coerce.number(),
    lng: z.coerce.number()
  })).catch([]).default([]),
  talukas: z.array(z.object({
    name: z.string(),
    lat: z.coerce.number(),
    lng: z.coerce.number()
  })).catch([]).default([]),
  coordinates: z.object({
    lat: z.coerce.number().nullable().catch(null).default(null),
    lng: z.coerce.number().nullable().catch(null).default(null)
  }).default({ lat: null, lng: null })
});

type Metadata = z.infer<typeof MetadataSchema>;

// Simple in‑memory cache
const cache = new Map<string, Metadata>();

// Round-robin index for API key rotation
let keyIndex = 0;

/**
 * Returns the next API key in a round-robin fashion from the environment variable.
 */
function getNextApiKey(): string {
  const rawKeys = process.env.OPENROUTER_API_KEY || "";
  const cleanKeys = rawKeys
    .replace(/[\[\]]/g, "")
    .split(",")
    .map(k => k.trim())
    .filter(k => k);
  
  if (cleanKeys.length === 0) throw new Error('OPENROUTER_API_KEY is not set or empty');
  
  const key = cleanKeys[keyIndex % cleanKeys.length];
  keyIndex++;
  return key;
}

/**
 * Sends raw source text to a fast Flash model and returns validated metadata.
 */
export async function extractMetadata(sourceText: string, cacheKey: string): Promise<Metadata> {
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const apiKey = getNextApiKey();

  // Use Gemini 2.0 Flash Lite for ultra-fast, high-quality extraction
  const payload = {
    model: 'google/gemini-2.0-flash-001',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { 
        content: `You are a high-speed metadata extraction engine specialized in Indian geography.
Extract location details into JSON format. 
LOCATION CONTEXT: All locations are in India.
Schema:
{
  "name": string,
  "capital": string,
  "population": number,
  "area": number (in km2),
  "literacy": number (percentage 0-100),
  "religion": { "hindu": number, "muslim": number, "christian": number },
  "governmentHead": string (Current Chief Minister or Head),
  "rulingParty": string (Current Ruling Political Party),
  "majorCities": [{ "name": string, "lat": number, "lng": number }],
  "talukas": [{ "name": string, "lat": number, "lng": number }],
  "coordinates": { "lat": number, "lng": number }
}
Rules:
- Use provided sources as the primary authority. 
- If information is MISSING from sources (especially for Literacy Rate and Religion), use your internal knowledge (e.g., 2011 Census or recent reliable estimates) to provide the most accurate data for this location.
- For population/area, extract numeric values (convert Cr/Lakhs to full numbers).
- For religion/literacy, return numbers between 0 and 100. Always provide an estimate for Hindu, Muslim, and Christian populations in India.
- For rulingParty, ONLY extract the name of the political party (e.g., BJP, INC, CPI(M), AAP, etc.). NEVER return a country name.
- For majorCities, identify 3-5 key towns/cities and provide their REAL geographic coordinates.
- For talukas, if the location is a DISTRICT, provide a list of 5-8 Talukas/Tehsils within that district with their approximate coordinates.
- Return exactly ONE JSON object representing the location.
- Return ONLY the JSON object.` 
      },
      { role: 'user', content: `TARGET LOCATION: ${cacheKey}\n\nExtract data from these sources:\n${sourceText.slice(0, 6000)}` }
    ]
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // Faster 15s timeout

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://prayer-bulletin.org', // Optional but good for OpenRouter
        'X-Title': 'Prayer Bulletin Generator'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    
    if (!content) throw new Error('Empty response from model');

    const parsed = JSON.parse(content);
    
    // Handle case where model returns an array of objects instead of one
    const normalizedParsed = Array.isArray(parsed) ? (parsed[0] || {}) : parsed;

    // Clean and validate
    const result = MetadataSchema.safeParse(normalizedParsed);
    if (!result.success) {
      console.error('Validation Error:', result.error.format());
      try {
        // Return a partial object with guaranteed name/capital to avoid total failure
        const ai = normalizedParsed as any;
        return MetadataSchema.parse({ 
          name: typeof ai.name === 'string' ? ai.name : "Unknown",
          capital: typeof ai.capital === 'string' ? ai.capital : "Unknown",
          governmentHead: ai.governmentHead === "Unknown" ? undefined : ai.governmentHead || undefined,
          rulingParty: ai.rulingParty === "Unknown" ? undefined : ai.rulingParty || undefined,
          religion: ai.religion || {}
        });
      } catch (e) {
        // Ultimate fallback
        return MetadataSchema.parse({ name: "Unknown", capital: "Unknown" });
      }
    }

    cache.set(cacheKey, result.data);
    return result.data;
  } catch (error) {
    clearTimeout(timeout);
    console.error(`AI Extraction Error [${cacheKey}]:`, error);
    throw error;
  }
}

