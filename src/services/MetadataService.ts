
import fs from 'fs';
import path from 'path';
import { getLocationMetadata } from '../../lib/location-service';

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

export interface ReligionData {
  hindu?: number;
  muslim?: number;
  christian?: number;
  [key: string]: number | undefined;
}

export interface LocationMetadata {
  name: string;
  capital?: string;
  population?: number;
  area?: number;
  literacy?: number;
  religion?: ReligionData;
  majorCities?: string[];
  governmentHead?: string;
  governmentParty?: string;
  lastUpdated: string;
}

export class MetadataService {
  private static DATA_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), 'data');

  private static ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  static getLocalData(
    type: 'states' | 'districts' | 'towns',
    name: string,
    parentName?: string
  ): LocationMetadata | null {
    let filePath: string;
    if (type === 'states') {
      filePath = path.join(/*turbopackIgnore: true*/ this.DATA_DIR, 'states', `${name.toLowerCase()}.json`);
    } else if (type === 'districts') {
      filePath = path.join(/*turbopackIgnore: true*/ this.DATA_DIR, 'districts', parentName?.toLowerCase() || 'unknown', `${name.toLowerCase()}.json`);
    } else {
      filePath = path.join(/*turbopackIgnore: true*/ this.DATA_DIR, 'towns', `${name.toLowerCase()}.json`);
    }

    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {
        console.error(`Error reading local data for ${name}`);
      }
    }
    return null;
  }

  static saveLocalData(
    type: 'states' | 'districts' | 'towns',
    data: LocationMetadata,
    parentName?: string
  ) {
    let dirPath: string;
    let filePath: string;

    if (type === 'states') {
      dirPath = path.join(/*turbopackIgnore: true*/ this.DATA_DIR, 'states');
      filePath = path.join(/*turbopackIgnore: true*/ dirPath, `${data.name.toLowerCase()}.json`);
    } else if (type === 'districts') {
      dirPath = path.join(/*turbopackIgnore: true*/ this.DATA_DIR, 'districts', parentName?.toLowerCase() || 'unknown');
      filePath = path.join(/*turbopackIgnore: true*/ dirPath, `${data.name.toLowerCase()}.json`);
    } else {
      dirPath = path.join(/*turbopackIgnore: true*/ this.DATA_DIR, 'towns');
      filePath = path.join(/*turbopackIgnore: true*/ dirPath, `${data.name.toLowerCase()}.json`);
    }

    try {
      this.ensureDir(dirPath);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch {
      // Ignore write errors in read-only environments like Vercel
    }
  }

  // ─── AI-only fetch (fast fallback, always returns something) ────────────────
  private static async fetchFromAI(locationName: string): Promise<LocationMetadata | null> {
    try {
      const ai = await getLocationMetadata(locationName, 'states');
      if (!ai) return null;
      return {
        name: locationName,
        capital: ai.capital,
        population: ai.population || undefined,
        area: ai.area || undefined,
        literacy: ai.literacy || undefined,
        governmentHead: undefined,
        governmentParty: ai.governmentParty || undefined,
        religion: ai.religion
          ? {
              hinduism: ai.religion.hindu ?? undefined,
              islam: ai.religion.muslim ?? undefined,
              christianity: ai.religion.christian ?? undefined,
            }
          : {},
        majorCities: ai.majorCities || [],
        lastUpdated: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  // ─── Wikidata SPARQL helpers ─────────────────────────────────────────────────
  private static async sparqlFetch(query: string): Promise<any[] | null> {
    const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'PrayerBulletinGenerator/1.0',
          Accept: 'application/sparql-results+json',
        },
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.results?.bindings ?? null;
    } catch {
      return null;
    }
  }

  private static async fetchReligionData(itemId: string): Promise<ReligionData> {
    const religions: ReligionData = {};
    if (!itemId) return religions;

    try {
      const bindings = await this.sparqlFetch(`
        SELECT ?religionLabel ?proportion ?percentage WHERE {
          wd:${itemId} p:P140 ?relStatement.
          ?relStatement ps:P140 ?rel.
          OPTIONAL { ?relStatement pq:P1107 ?proportion. }
          OPTIONAL { ?relStatement pq:P1108 ?percentage. }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        }
      `);

      if (bindings) {
        for (const b of bindings) {
          const label = b.religionLabel?.value?.toLowerCase();
          if (!label) continue;
          const raw = b.proportion
            ? parseFloat(b.proportion.value)
            : b.percentage
            ? parseFloat(b.percentage.value) / 100
            : null;
          if (raw !== null) {
            religions[label] = raw * 100;
          }
        }
      }
    } catch (err) {
      console.error(`[MetadataService] Error fetching religion data for ${itemId}:`, err);
    }
    return religions;
  }

  private static async fetchReligionLabels(itemId: string): Promise<ReligionData> {
    const religions: ReligionData = {};
    if (!itemId) return religions;

    const bindings = await this.sparqlFetch(`
      SELECT ?religionLabel WHERE {
        wd:${itemId} wdt:P140 ?religion.
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
    `);

    if (bindings) {
      for (const b of bindings) {
        const label = b.religionLabel?.value?.toLowerCase();
        if (label) religions[label] = 0;
      }
    }
    return religions;
  }

  private static async fetchMajorCities(itemId: string): Promise<string[]> {
    const cities: string[] = [];
    if (!itemId) return cities;

    const bindings = await this.sparqlFetch(`
      SELECT ?cityLabel WHERE {
        ?city wdt:P31 wd:Q515;
              wdt:P131 wd:${itemId}.
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      } LIMIT 5
    `);

    if (bindings) {
      for (const b of bindings) {
        if (b.cityLabel?.value) cities.push(b.cityLabel.value);
      }
    }
    return cities;
  }

  // ─── Main fetch: Wikidata first, AI fallback ─────────────────────────────────
  static async fetchStateFromWikidata(stateName: string): Promise<LocationMetadata | null> {
    console.log(`[MetadataService] Fetching: ${stateName}`);

    // Step 1: Try Wikidata for main info
    const bindings = await this.sparqlFetch(`
      SELECT ?state ?capitalLabel ?population ?area ?literacy ?headLabel ?partyLabel ?demographics
      WHERE {
        ?state wdt:P17 wd:Q668;
               rdfs:label "${stateName}"@en.
        OPTIONAL { ?state wdt:P36 ?capital. }
        OPTIONAL { ?state wdt:P1082 ?population. }
        OPTIONAL { ?state wdt:P2046 ?area. }
        OPTIONAL { ?state wdt:P2744 ?literacy. }
        OPTIONAL { ?state wdt:P6 ?head. }
        OPTIONAL { ?head wdt:P102 ?party. }
        OPTIONAL {
          ?demographics wdt:P31 wd:Q1544839;
                        wdt:P301 ?state.
        }
        SERVICE wikibase:label {
          bd:serviceParam wikibase:language "en".
          ?head rdfs:label ?headLabel.
          ?party rdfs:label ?partyLabel.
          ?capital rdfs:label ?capitalLabel.
        }
      } LIMIT 1
    `);

    const result = bindings?.[0] ?? null;

    // Step 2: If Wikidata fails completely, use AI as primary source
    if (!result) {
      console.log(`[MetadataService] Wikidata empty for ${stateName}, using AI fallback`);
      return this.fetchFromAI(stateName);
    }

    // Step 3: Wikidata succeeded — fetch sub-data in parallel
    try {
      const stateId = result.state?.value?.split('/')?.pop() ?? '';
      const demoId = result.demographics?.value?.split('/')?.pop() ?? '';

      // Parallel sub-fetches
      const [religion1, religion2, religion3, majorCities] = await Promise.all([
        this.fetchReligionData(stateId),
        demoId ? this.fetchReligionData(demoId) : Promise.resolve({}),
        this.fetchReligionLabels(stateId),
        this.fetchMajorCities(stateId)
      ]);

      // Combine religion data
      let religion = Object.keys(religion1).length > 0 ? religion1 : religion2;
      if (Object.keys(religion).length === 0) {
        religion = religion3;
      }

      // Check if we have enough data or need AI supplement
      const hasBasicData = result.population && result.area && result.literacy && Object.keys(religion).length > 0;
      
      let ai: LocationMetadata | null = null;
      if (!hasBasicData) {
        console.log(`[MetadataService] Wikidata missing some fields for ${stateName}, fetching AI supplement...`);
        ai = await this.fetchFromAI(stateName);
      }

      // Merge Wikidata + AI
      const finalLiteracy = result.literacy
        ? parseFloat(result.literacy.value) * (parseFloat(result.literacy.value) < 1 ? 100 : 1)
        : ai?.literacy ?? undefined;

      const finalReligion =
        Object.keys(religion).length > 0
          ? religion
          : (ai?.religion ?? {});

      const finalParty = result.partyLabel?.value ?? ai?.governmentParty ?? undefined;

      return {
        name: stateName,
        capital: result.capitalLabel?.value ?? ai?.capital,
        population: result.population
          ? parseInt(result.population.value)
          : ai?.population ?? undefined,
        area: result.area ? parseFloat(result.area.value) : ai?.area ?? undefined,
        literacy: finalLiteracy,
        governmentHead: result.headLabel?.value ?? ai?.governmentHead ?? undefined,
        governmentParty: finalParty,
        religion: finalReligion,
        majorCities: majorCities.length > 0 ? majorCities : (ai?.majorCities ?? []),
        lastUpdated: new Date().toISOString(),
      };
    } catch (err) {
      console.error(`[MetadataService] Error processing Wikidata result for ${stateName}:`, err);
      return this.fetchFromAI(stateName);
    }
  }

  static async fetchDistrictFromWikidata(
    districtName: string,
    stateName: string
  ): Promise<LocationMetadata | null> {
    console.log(`[MetadataService] Fetching District: ${districtName} in ${stateName}`);

    // Try a more specific query for districts to avoid ambiguity
    const bindings = await this.sparqlFetch(`
      SELECT ?dist ?capitalLabel ?population ?area ?literacy ?headLabel ?partyLabel
      WHERE {
        ?dist wdt:P17 wd:Q668;
              (wdt:P31 wd:Q1149652 | wdt:P31 wd:Q11701 | wdt:P31 wd:Q2140); # District, State, or Administrative unit
              rdfs:label "${districtName}"@en.
        
        # Try to link to state to ensure correct district
        ?dist wdt:P131* ?state.
        ?state rdfs:label "${stateName}"@en.

        OPTIONAL { ?dist wdt:P36 ?capital. }
        OPTIONAL { ?dist wdt:P1082 ?population. }
        OPTIONAL { ?dist wdt:P2046 ?area. }
        OPTIONAL { ?dist wdt:P2744 ?literacy. }
        
        SERVICE wikibase:label {
          bd:serviceParam wikibase:language "en".
          ?capital rdfs:label ?capitalLabel.
        }
      } LIMIT 1
    `);

    if (bindings && bindings[0]) {
      const result = bindings[0];
      const distId = result.dist?.value?.split('/')?.pop() ?? '';
      
      const [religion, majorCities] = await Promise.all([
        this.fetchReligionData(distId),
        this.fetchMajorCities(distId)
      ]);

      const finalLiteracy = result.literacy
        ? parseFloat(result.literacy.value) * (parseFloat(result.literacy.value) < 1 ? 100 : 1)
        : undefined;

      return {
        name: districtName,
        capital: result.capitalLabel?.value,
        population: result.population ? parseInt(result.population.value) : undefined,
        area: result.area ? parseFloat(result.area.value) : undefined,
        literacy: finalLiteracy,
        religion: religion,
        majorCities: majorCities,
        lastUpdated: new Date().toISOString(),
      };
    }

    // Fallback to the generic state fetcher if the specific one fails
    return this.fetchStateFromWikidata(districtName);
  }

  static async fetchTownFromNominatim(townName: string): Promise<any | null> {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      townName + ', India'
    )}&format=json&limit=1`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'PrayerBulletinGenerator/1.0' },
      });
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          name: townName,
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          displayName: data[0].display_name,
          lastUpdated: new Date().toISOString(),
        };
      }
    } catch {
      console.error(`Error fetching Nominatim for ${townName}`);
    }
    return null;
  }
}
