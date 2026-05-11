import { z } from 'zod';

export const MetadataSchema = z.object({
  name: z.string().nullable().transform(val => val ?? "Unknown").default("Unknown"),
  capital: z.string().nullable().transform(val => val ?? "Unknown").default("Unknown"),
  population: z.coerce.number().nullable().catch(null).default(null),
  area: z.coerce.number().nullable().catch(null).default(null),
  literacy: z.coerce.number().nullable().catch(null).default(null),
  religion: z.record(z.string(), z.coerce.number().nullable().catch(null)).default({}),
  governmentHead: z.string().nullable().default(null),
  rulingParty: z.string().nullable().default(null),
  majorCities: z.array(z.union([
    z.string(),
    z.object({ name: z.string(), lat: z.coerce.number(), lng: z.coerce.number() })
  ])).catch([]).default([]),
  talukas: z.array(z.union([
    z.string(),
    z.object({ name: z.string(), lat: z.coerce.number(), lng: z.coerce.number() })
  ])).catch([]).default([]),
  coordinates: z.object({
    lat: z.coerce.number().nullable().catch(null).default(null),
    lng: z.coerce.number().nullable().catch(null).default(null)
  }).default({ lat: null, lng: null })
});

type Metadata = z.infer<typeof MetadataSchema>;

const cache = new Map<string, Metadata>();

let keyIndex = 0;

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

export const ProjectionSchema = z.object({
  population: z.coerce.number().nullable().catch(null).default(null),
  literacy: z.coerce.number().nullable().catch(null).default(null),
  religion: z.object({
    hindu: z.coerce.number().nullable().catch(null).default(null),
    muslim: z.coerce.number().nullable().catch(null).default(null),
    christian: z.coerce.number().nullable().catch(null).default(null)
  }).default({ hindu: null, muslim: null, christian: null }),
  governmentHead: z.string().nullable().default(null),
  rulingParty: z.string().nullable().default(null),
});

type Projection = z.infer<typeof ProjectionSchema>;

export function clearCache(key?: string) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

export async function extractMetadata(
  sourceText: string,
  cacheKey: string,
  force = false
): Promise<Metadata> {
  if (!force) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }

  const apiKey = getNextApiKey();

  const payload = {
    model: 'openai/gpt-4o-mini',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a data assistant. For any Indian state, district, or city, return EXACTLY this JSON schema — nothing else, no extra fields, no arrays at top level:

{"name":"","capital":"","population":0,"area":0,"literacy":0,"religion":{},"governmentHead":"","rulingParty":"","majorCities":[],"talukas":[],"coordinates":{"lat":0,"lng":0}}

REQUIRED FILL RULES:
- religion: Return the TOP 3-5 religions as keys with real census percentages (0-100) as values. Use 2011 Census data. THESE ARE MANDATORY.
- governmentHead: current Chief Minister (for states) or equivalent. MANDATORY.
- rulingParty: current ruling party name, e.g. "CPI(M)", "BJP", "INC". MANDATORY.
- literacy: percentage 0-100, e.g. 94.0. MANDATORY.
- majorCities: 8-15 real cities/towns. INCLUDE all significant urban hubs. MANDATORY.
- population, area: from given data or your knowledge.
- Return ONE JSON object. NEVER an array.`
      },
      {
        role: 'user',
        content: `Location: ${cacheKey}\n\n${sourceText.slice(0, 6000)}\n\nReturn the JSON object for ${cacheKey} following the schema. ALL fields MUST be filled.`
      }
    ]
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://prayer-bulletin.org',
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

    console.log(`[AI Debug] Raw response for ${cacheKey}:`, content.slice(0, 500));

    const parsed = JSON.parse(content);
    const normalizedParsed = Array.isArray(parsed) ? (parsed[0] || {}) : parsed;

    const result = MetadataSchema.safeParse(normalizedParsed);
    if (!result.success) {
      console.error('Validation Error:', result.error.format());
      try {
        const ai = normalizedParsed as any;
        return MetadataSchema.parse({
          name: typeof ai.name === 'string' ? ai.name : "Unknown",
          capital: typeof ai.capital === 'string' ? ai.capital : "Unknown",
          governmentHead: ai.governmentHead === "Unknown" ? undefined : ai.governmentHead || undefined,
          rulingParty: ai.rulingParty === "Unknown" ? undefined : ai.rulingParty || undefined,
          religion: ai.religion || {}
        });
      } catch (e) {
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

export async function projectTo2026(
  name: string,
  baseData: { population?: number | null; literacy?: number | null; religion?: Record<string, number | null> | null },
  cacheKey: string
): Promise<Projection> {
  const apiKey = getNextApiKey();

  const payload = {
    model: 'openai/gpt-4o-mini',
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You project Indian location demographics to 2026 estimates. Return EXACTLY this JSON:

{"population":0,"literacy":0,"religion":{},"governmentHead":"","rulingParty":""}

Rules:
- population: estimate 2026 using ~1% annual growth from base
- literacy: project slightly higher than base
- religion: keep similar proportions, minor adjustments for trends
- governmentHead: current leader
- rulingParty: current ruling party
- Return ONE JSON object.`
      },
      {
        role: 'user',
        content: `Project ${name} to 2026. Base data: population=${baseData.population}, literacy=${baseData.literacy}%, religion=${JSON.stringify(baseData.religion)}. Return projected JSON.`
      }
    ]
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://prayer-bulletin.org',
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
    if (!content) throw new Error('Empty response');

    console.log(`[2026 Projection] ${cacheKey}:`, content.slice(0, 300));

    const parsed = JSON.parse(content);
    const result = ProjectionSchema.safeParse(parsed);
    if (!result.success) {
      console.error('Projection validation error:', result.error.format());
      return ProjectionSchema.parse({});
    }
    return result.data;
  } catch (error) {
    clearTimeout(timeout);
    console.error(`[2026 Projection Error] ${cacheKey}:`, error);
    return ProjectionSchema.parse({});
  }
}
