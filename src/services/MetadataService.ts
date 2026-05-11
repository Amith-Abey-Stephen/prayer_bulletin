
import fs from 'fs';
import path from 'path';
import { getLocationMetadata } from '../../lib/location-service';
import { clearCache } from '../../lib/ai-extractor';
import { normalizeLiteracy } from '../../lib/utils';

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

interface ReligionData {
  [key: string]: number | null | undefined;
}

interface LocationMetadata {
  name: string;
  capital?: string;
  population?: number;
  area?: number;
  literacy?: number;
  religion?: ReligionData;
  majorCities?: (string | { name: string; lat: number; lng: number })[];
  talukas?: (string | { name: string; lat: number; lng: number })[];
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

  private static async fetchFromAI(locationName: string, type: 'states' | 'districts' | 'towns' = 'states'): Promise<LocationMetadata | null> {
    try {
      console.log(`[MetadataService] AI Fetching (${type}): ${locationName}`);
      const ai = await getLocationMetadata(locationName, type);
      if (!ai) return null;
      
      return {
        name: locationName,
        capital: ai.capital === "Unknown" ? undefined : ai.capital,
        population: ai.population || undefined,
        area: ai.area || undefined,
        literacy: ai.literacy || undefined,
        governmentHead: ai.governmentHead === "Unknown" ? undefined : ai.governmentHead || undefined,
        governmentParty: ai.rulingParty === "Unknown" ? undefined : ai.rulingParty || undefined,
        religion: ai.religion || {},
        majorCities: ai.majorCities || [],
        talukas: ai.talukas || [],
        lastUpdated: new Date().toISOString(),
      };
    } catch (err) {
      console.error(`[MetadataService] AI Fallback failed for ${locationName}:`, err);
      return null;
    }
  }

  private static async sparqlFetch(query: string): Promise<any[] | null> {
    const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'PrayerBulletinGenerator/1.0',
          Accept: 'application/sparql-results+json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return null;
      const json = await res.json();
      return json.results?.bindings ?? null;
    } catch (err) {
      clearTimeout(timeout);
      console.error(`[MetadataService] SPARQL Fetch failed:`, err);
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

  private static async fetchMajorCities(itemId: string): Promise<string[]> {
    const cities: string[] = [];
    if (!itemId) return cities;

    const bindings = await this.sparqlFetch(`
      SELECT ?cityLabel WHERE {
        ?city wdt:P31 wd:Q515;
              wdt:P131 wd:${itemId}.
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      } LIMIT 15
    `);

    if (bindings) {
      for (const b of bindings) {
        if (b.cityLabel?.value) cities.push(b.cityLabel.value);
      }
    }
    return cities;
  }

  static isValidParty(party: string | undefined | null): boolean {
    if (!party) return false;
    const lower = party.toLowerCase().trim();
    const invalid = [
      "ghana", "india", "unknown", "none", "n/a", "not available",
      "unknown party", "independent", ""
    ];
    if (invalid.includes(lower)) return false;
    if (lower.includes("country") || lower.includes("nation")) return false;
    return true;
  }

  static hasEmptyFields(data: LocationMetadata): boolean {
    const religion = data.religion;
    const hasReligion = religion && Object.values(religion).some(v => v != null);
    const hasGovernment = data.governmentParty != null && data.governmentParty !== "";
    const hasTalukas = data.talukas && data.talukas.length > 0;
    const hasMajorCities = data.majorCities && data.majorCities.length >= 8;
    return !hasReligion || !hasGovernment || !hasTalukas || !hasMajorCities;
  }

  static async fillMissingFromAI(
    name: string,
    type: "states" | "districts" | "towns",
    existing: LocationMetadata,
    parent?: string
  ): Promise<LocationMetadata> {
    const aiName = type === "districts" && parent ? `${name}, ${parent}` : name;
    clearCache(`${type}:${aiName}`);
    const ai = await this.fetchFromAI(aiName, type);
    if (!ai) return existing;

    const religion = ai.religion || {};
    const hasAIReligion = religion && Object.values(religion).some(v => v != null);

    const existingRel = existing.religion || {};
    const hasExistingReligion = existingRel && Object.values(existingRel).some(v => v != null);

    return {
      ...existing,
      religion: hasExistingReligion ? existing.religion : (hasAIReligion ? religion : existing.religion),
      governmentParty: existing.governmentParty && this.isValidParty(existing.governmentParty)
        ? existing.governmentParty
        : (this.isValidParty(ai.governmentParty) ? ai.governmentParty : existing.governmentParty),
      governmentHead: existing.governmentHead || ai.governmentHead || existing.governmentHead,
      literacy: existing.literacy ?? ai.literacy ?? existing.literacy,
      majorCities:
        ai.majorCities && ai.majorCities.length > (existing.majorCities?.length || 0)
          ? ai.majorCities
          : existing.majorCities,
      talukas:
        existing.talukas && existing.talukas.length > 0
          ? existing.talukas
          : (ai.talukas?.length ? ai.talukas : existing.talukas),
      lastUpdated: new Date().toISOString(),
    };
  }

  static async fetchStateFromWikidata(stateName: string): Promise<LocationMetadata | null> {
    console.log(`[MetadataService] Fetching State: ${stateName}`);

    try {
      const bindings = await this.sparqlFetch(`
        SELECT ?state ?capitalLabel ?population ?area
        WHERE {
          ?state wdt:P17 wd:Q668;
                 rdfs:label "${stateName}"@en.
          OPTIONAL { ?state wdt:P36 ?capital. }
          OPTIONAL { ?state wdt:P1082 ?population. }
          OPTIONAL { ?state wdt:P2046 ?area. }
          SERVICE wikibase:label {
            bd:serviceParam wikibase:language "en".
            ?capital rdfs:label ?capitalLabel.
          }
        } LIMIT 1
      `);

      const aiPromise = this.fetchFromAI(stateName);

      if (!bindings || bindings.length === 0) {
        console.log(`[MetadataService] No Wikidata for ${stateName}, waiting for AI...`);
        return await aiPromise;
      }

      const first = bindings[0];
      const stateId = first.state?.value?.split('/')?.pop() ?? '';

      const [wikidataReligion, cities, ai] = await Promise.all([
        stateId ? this.fetchReligionData(stateId) : Promise.resolve({}),
        stateId ? this.fetchMajorCities(stateId) : Promise.resolve([]),
        aiPromise
      ]);

      const finalLiteracy = first.literacy
        ? normalizeLiteracy(first.literacy.value)
        : ai?.literacy ?? undefined;

      const majorCities = ai?.majorCities?.length ? ai.majorCities : cities;

      const hasWikidataReligion = wikidataReligion && Object.keys(wikidataReligion).length > 0;
      const hasAIReligion = ai?.religion && Object.values(ai.religion).some(v => v != null);

      return {
        name: stateName,
        capital: first.capitalLabel?.value ?? ai?.capital,
        population: first.population ? parseInt(first.population.value) : ai?.population,
        area: first.area ? parseFloat(first.area.value) : ai?.area,
        literacy: finalLiteracy,
        governmentHead: ai?.governmentHead ?? undefined,
        governmentParty: ai?.governmentParty ?? undefined,
        religion: hasWikidataReligion ? wikidataReligion : (hasAIReligion ? (ai?.religion ?? {}) : {}),
        majorCities: majorCities,
        lastUpdated: new Date().toISOString()
      };
    } catch (err) {
      console.error(`[MetadataService] Error processing Wikidata result for ${stateName}:`, err);
      return this.fetchFromAI(stateName);
    }
  }

  static async fetchDistrictFromWikidata(districtName: string, stateName: string): Promise<LocationMetadata | null> {
    console.log(`[MetadataService] Fetching District: ${districtName} in ${stateName}`);

    try {
      const bindings = await this.sparqlFetch(`
        SELECT ?dist ?capitalLabel ?population ?area ?literacy ?religionLabel ?proportion ?percentage ?cityLabel
        WHERE {
          ?dist wdt:P17 wd:Q668;
                (wdt:P31 wd:Q2140 | wdt:P31 wd:Q1149652 | wdt:P31 wd:Q11701);
                (rdfs:label|skos:altLabel) "${districtName}"@en.
          
          ?dist wdt:P131* ?state.
          ?state rdfs:label "${stateName}"@en.

          OPTIONAL { ?dist wdt:P36 ?capital. }
          OPTIONAL { ?dist wdt:P1082 ?population. }
          OPTIONAL { ?dist wdt:P2046 ?area. }
          OPTIONAL { ?dist wdt:P2744 ?literacy. }
          
          # Religion
          OPTIONAL {
            ?dist p:P140 ?relStatement.
            ?relStatement ps:P140 ?rel.
            OPTIONAL { ?relStatement pq:P1107 ?proportion. }
            OPTIONAL { ?relStatement pq:P1108 ?percentage. }
            ?rel rdfs:label ?religionLabel.
            FILTER(LANG(?religionLabel) = "en")
          }

          # Cities
          OPTIONAL {
            ?city wdt:P31 wd:Q515;
                  wdt:P131 ?dist;
                  rdfs:label ?cityLabel.
            FILTER(LANG(?cityLabel) = "en")
          }

          SERVICE wikibase:label {
            bd:serviceParam wikibase:language "en".
            ?capital rdfs:label ?capitalLabel.
          }
        } LIMIT 50
      `);

      if (!bindings || bindings.length === 0) {
        console.log(`[MetadataService] District search failed for ${districtName}, trying generic...`);
        return this.fetchStateFromWikidata(districtName);
      }

      const first = bindings[0];
      const religion: ReligionData = {};
      const citiesSet = new Set<string>();

      bindings.forEach(b => {
        if (b.religionLabel?.value && (b.proportion || b.percentage)) {
          const label = b.religionLabel.value.toLowerCase();
          const val = b.proportion ? parseFloat(b.proportion.value) : parseFloat(b.percentage.value) / 100;
          religion[label] = val * 100;
        }
        if (b.cityLabel?.value) citiesSet.add(b.cityLabel.value);
      });

      const majorCities = Array.from(citiesSet).slice(0, 15);
      const finalLiteracy = first.literacy
        ? normalizeLiteracy(first.literacy.value)
        : undefined;

      const hasBasicData = first.population && first.area && finalLiteracy && Object.keys(religion).length > 0;
      let ai: LocationMetadata | null = null;
      if (!hasBasicData) {
        ai = await this.fetchFromAI(`${districtName}, ${stateName}`, 'districts');
      }

      return {
        name: districtName,
        capital: first.capitalLabel?.value ?? ai?.capital,
        population: first.population ? parseInt(first.population.value) : ai?.population,
        area: first.area ? parseFloat(first.area.value) : ai?.area,
        literacy: finalLiteracy ?? ai?.literacy,
        religion: Object.keys(religion).length > 0 ? religion : (ai?.religion ?? {}),
        majorCities: majorCities.length > 0 ? majorCities : (ai?.majorCities ?? []),
        talukas: ai?.talukas ?? [],
        lastUpdated: new Date().toISOString(),
      };
    } catch (err) {
      console.error(`[MetadataService] Error processing district ${districtName}:`, err);
      return this.fetchFromAI(`${districtName}, ${stateName}`, 'districts');
    }
  }

}
  