// Using global fetch (Node >=18) – no external node-fetch needed

/**
 * Fetch raw Wikidata entity data for a given name.
 * Returns a string containing the raw SPARQL JSON result.
 * The caller can treat the result as plain text for the AI model.
 */
export async function fetchWikidataRaw(name: string): Promise<string> {
  const endpoint = 'https://query.wikidata.org/sparql';
  const query = `
    SELECT ?item ?itemLabel ?description WHERE {
      ?item wdt:P17 wd:Q668;   # India
            (rdfs:label|skos:altLabel) "${name}"@en.
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 1
  `;
  const url = `${endpoint}?query=${encodeURIComponent(query)}&format=json`;

  const response = await fetch(url, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'PrayerBulletinGenerator/1.0' }
  });
  if (!response.ok) {
    throw new Error(`Wikidata request failed with ${response.status}`);
  }
  const text = await response.text();
  return text;
}
