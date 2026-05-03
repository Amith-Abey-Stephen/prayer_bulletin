
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
  private static DATA_DIR = path.join(process.cwd(), 'data');

  private static ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  static getLocalData(type: 'states' | 'districts' | 'towns', name: string, parentName?: string): LocationMetadata | null {
    let filePath: string;
    if (type === 'states') {
      filePath = path.join(this.DATA_DIR, 'states', `${name.toLowerCase()}.json`);
    } else if (type === 'districts') {
      filePath = path.join(this.DATA_DIR, 'districts', parentName?.toLowerCase() || 'unknown', `${name.toLowerCase()}.json`);
    } else {
      filePath = path.join(this.DATA_DIR, 'towns', `${name.toLowerCase()}.json`);
    }

    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (e) {
        console.error(`Error reading local data for ${name}:`, e);
      }
    }
    return null;
  }

  static saveLocalData(type: 'states' | 'districts' | 'towns', data: LocationMetadata, parentName?: string) {
    let dirPath: string;
    let filePath: string;

    if (type === 'states') {
      dirPath = path.join(this.DATA_DIR, 'states');
      filePath = path.join(dirPath, `${data.name.toLowerCase()}.json`);
    } else if (type === 'districts') {
      dirPath = path.join(this.DATA_DIR, 'districts', parentName?.toLowerCase() || 'unknown');
      filePath = path.join(dirPath, `${data.name.toLowerCase()}.json`);
    } else {
      dirPath = path.join(this.DATA_DIR, 'towns');
      filePath = path.join(dirPath, `${data.name.toLowerCase()}.json`);
    }

    this.ensureDir(dirPath);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  static async fetchStateFromWikidata(stateName: string): Promise<LocationMetadata | null> {
    const findQuery = `
      SELECT ?state ?capitalLabel ?population ?area ?literacy ?headLabel ?partyLabel ?demographics
      WHERE {
        {
          ?state wdt:P17 wd:Q668;
                 wdt:P300 ?iso;
                 rdfs:label "${stateName}"@en.
        } UNION {
          ?state wdt:P17 wd:Q668;
                 wdt:P300 ?iso;
                 skos:altLabel "${stateName}"@en.
        }
        FILTER(STRSTARTS(?iso, "IN-"))
      } UNION {
        # Fallback for entities without ISO codes (districts, historical regions)
        ?state wdt:P17 wd:Q668;
               rdfs:label "${stateName}"@en.
        BIND("N/A" AS ?iso)
      }
        
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
    `;

    const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(findQuery)}&format=json`;

    try {
      const res = await fetch(url, {
        headers: { 
          "User-Agent": "PrayerBulletinGenerator/1.0", 
          "Accept": "application/sparql-results+json" 
        }
      });
      
      if (!res.ok) return null;

      const data = await res.json();
      const result = data.results.bindings[0];

      if (!result) return null;

      const stateId = result.state?.value?.split('/')?.pop();
      const demoId = result.demographics?.value?.split('/')?.pop();
      
      // Try to get religion from state item, fallback to demographics item
      let religion = await this.fetchReligionData(stateId);
      if (Object.keys(religion).length === 0 && demoId) {
        religion = await this.fetchReligionData(demoId);
      }

      // If still empty, try to get just the labels of religions
      if (Object.keys(religion).length === 0) {
        religion = await this.fetchReligionLabels(stateId);
      }

      const majorCities = await this.fetchMajorCities(stateId);
      
      // AI enrichment (Optional: supplements SPARQL with AI-extracted insights)
      const aiMetadata = await getLocationMetadata(stateName, 'states');

      // Hardcoded fallbacks for missing data
      let finalLiteracy = result.literacy ? parseFloat(result.literacy.value) * (parseFloat(result.literacy.value) < 1 ? 100 : 1) : undefined;
      let finalReligion = religion;
      
      if (stateName.toLowerCase() === "kerala") {
        finalLiteracy = finalLiteracy || 94.0;
        if (Object.keys(finalReligion).length === 0) {
          finalReligion = { hinduism: 54.7, islam: 26.5, christianity: 18.3 };
        }
        // Fallback for party if wikidata fails
        if (!result.partyLabel?.value) {
          result.partyLabel = { value: "Communist Party of India (Marxist)" };
        }
      } else if (stateName.toLowerCase() === "maharashtra") {
        finalLiteracy = finalLiteracy || 82.3;
        if (Object.keys(finalReligion).length === 0) {
          finalReligion = { hinduism: 79.8, islam: 11.5, buddhism: 5.8 };
        }
      } else if (stateName.toLowerCase() === "tamil nadu" || stateName.toLowerCase() === "tamilnadu") {
        finalLiteracy = finalLiteracy || 80.0;
        if (Object.keys(finalReligion).length === 0) {
          finalReligion = { hinduism: 87.5, christianity: 6.1, islam: 5.8 };
        }
      }

      return {
        name: stateName,
        capital: result.capitalLabel?.value,
        population: result.population ? parseInt(result.population.value) : undefined,
        area: result.area ? parseFloat(result.area.value) : undefined,
        literacy: finalLiteracy,
        governmentHead: result.headLabel?.value || aiMetadata?.capital, // AI might find a different name
        governmentParty: result.partyLabel?.value || aiMetadata?.governmentParty,
        religion: Object.keys(finalReligion).length > 0 ? finalReligion : (aiMetadata?.religion ? {
          hinduism: aiMetadata.religion.hindu ?? undefined,
          islam: aiMetadata.religion.muslim ?? undefined,
          christianity: aiMetadata.religion.christian ?? undefined,
        } : {}),
        majorCities: majorCities.length > 0 ? majorCities : (aiMetadata?.majorCities || []),
        lastUpdated: new Date().toISOString()
      };
    } catch (e) {
      console.error(`Error fetching Wikidata for ${stateName}:`, e);
      return null;
    }
  }

  static async fetchDistrictFromWikidata(districtName: string, stateName: string): Promise<LocationMetadata | null> {
    // We can just use the updated fetchStateFromWikidata which now handles non-ISO entities
    return this.fetchStateFromWikidata(districtName);
  }

  static async fetchTownFromNominatim(townName: string): Promise<any | null> {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(townName + ", India")}&format=json&limit=1`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "PrayerBulletinGenerator/1.0" }
      });
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          name: townName,
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          displayName: data[0].display_name,
          lastUpdated: new Date().toISOString()
        };
      }
    } catch (e) {
      console.error(`Error fetching Nominatim for ${townName}:`, e);
    }
    return null;
  }

  private static async fetchReligionData(itemId: string): Promise<ReligionData> {
    const query = `
      SELECT ?religionLabel ?proportion ?percentage WHERE {
        wd:${itemId} p:P140 ?relStatement.
        ?relStatement ps:P140 ?rel.
        OPTIONAL { ?relStatement pq:P1107 ?proportion. }
        OPTIONAL { ?relStatement pq:P1108 ?percentage. }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
    `;
    const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
    const religions: ReligionData = {};

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "PrayerBulletinGenerator/1.0", "Accept": "application/sparql-results+json" }
      });
      const data = await res.json();
      data.results.bindings.forEach((b: any) => {
        const label = b.religionLabel.value.toLowerCase();
        const value = b.proportion ? parseFloat(b.proportion.value) : (b.percentage ? parseFloat(b.percentage.value) / 100 : undefined);
        if (value !== undefined) {
          religions[label] = value * 100;
        }
      });
    } catch (e) {
      console.error(`Error fetching religion for ${itemId}:`, e);
    }
    return religions;
  }

  private static async fetchReligionLabels(itemId: string): Promise<ReligionData> {
    const query = `
      SELECT ?religionLabel WHERE {
        wd:${itemId} wdt:P140 ?religion.
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
    `;
    const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
    const religions: ReligionData = {};

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "PrayerBulletinGenerator/1.0", "Accept": "application/sparql-results+json" }
      });
      const data = await res.json();
      data.results.bindings.forEach((b: any) => {
        const label = b.religionLabel.value.toLowerCase();
        religions[label] = 0; // Unknown percentage
      });
    } catch (e) {
      console.error(`Error fetching religion labels for ${itemId}:`, e);
    }
    return religions;
  }

  private static async fetchMajorCities(itemId: string): Promise<string[]> {
    const query = `
      SELECT ?cityLabel WHERE {
        ?city wdt:P31 wd:Q515; # city
              wdt:P131 wd:${itemId}.
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      } LIMIT 5
    `;
    const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
    const cities: string[] = [];

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "PrayerBulletinGenerator/1.0", "Accept": "application/sparql-results+json" }
      });
      const data = await res.json();
      data.results.bindings.forEach((b: any) => {
        cities.push(b.cityLabel.value);
      });
    } catch (e) {
      console.error(`Error fetching major cities for ${itemId}:`, e);
    }
    return cities;
  }
}
