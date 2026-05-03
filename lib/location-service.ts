import { fetchWikidataRaw } from './wikidata';
import { fetchWikipediaExtract } from './wikipedia';
import { extractMetadata, MetadataSchema } from './ai-extractor';
import { z } from 'zod';

type Metadata = z.infer<typeof MetadataSchema>;

/**
 * Orchestrates fetching from trusted sources and using AI to extract structured data.
 */
export async function getLocationMetadata(
  name: string,
  type: 'states' | 'districts' | 'towns'
): Promise<Metadata | null> {
  const cacheKey = `${type}:${name}`;

  try {
    // Parallel fetch from trusted sources
    const [wikidataRaw, wikipediaText] = await Promise.all([
      fetchWikidataRaw(name),
      fetchWikipediaExtract(name)
    ]);

    // Combine raw source texts
    const sourceText = `SOURCE: WIKIDATA\n${wikidataRaw}\n\nSOURCE: WIKIPEDIA\n${wikipediaText}`;

    // Pass raw text to the deterministic AI extractor
    const metadata = await extractMetadata(sourceText, cacheKey);
    return metadata;
  } catch (e) {
    console.error(`AI location metadata extraction failed for ${name}:`, e);
    return null;
  }
}
