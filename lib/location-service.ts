import { fetchWikidataRaw } from './wikidata';
import { fetchWikipediaExtract } from './wikipedia';
import { extractMetadata, MetadataSchema } from './ai-extractor';
import { z } from 'zod';

type Metadata = z.infer<typeof MetadataSchema>;

function formatWikidataAsText(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    const bindings = parsed?.results?.bindings;
    if (!bindings?.[0]) return '';
    const b = bindings[0];
    const parts: string[] = [];
    if (b.itemLabel?.value) parts.push(`Name: ${b.itemLabel.value}`);
    if (b.population?.value) parts.push(`Population: ${b.population.value}`);
    if (b.area?.value) parts.push(`Area: ${b.area.value} km²`);
    if (b.capitalLabel?.value) parts.push(`Capital: ${b.capitalLabel.value}`);
    if (b.literacy?.value) parts.push(`Literacy: ${b.literacy.value}%`);
    return parts.join('\n');
  } catch {
    return '';
  }
}

/**
 * Orchestrates fetching from trusted sources and using AI to extract structured data.
 */
export async function getLocationMetadata(
  name: string,
  type: 'states' | 'districts' | 'towns'
): Promise<Metadata | null> {
  const cacheKey = `${type}:${name}`;

  try {
    const [wikidataRaw, wikipediaText] = await Promise.all([
      fetchWikidataRaw(name),
      fetchWikipediaExtract(name)
    ]);

    const wikidataFormatted = formatWikidataAsText(wikidataRaw);
    const sourceText = `KNOWLEDGE SOURCES\n\nWikidata:\n${wikidataFormatted}\n\nWikipedia extract:\n${wikipediaText}`;

    const metadata = await extractMetadata(sourceText, cacheKey);
    return metadata;
  } catch (e) {
    console.error(`AI location metadata extraction failed for ${name}:`, e);
    return null;
  }
}
