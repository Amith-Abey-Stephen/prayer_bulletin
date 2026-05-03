
import fs from 'fs';
import path from 'path';

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
      SELECT ?state ?capitalLabel ?population ?area ?literacy 
      WHERE {
        ?state wdt:P17 wd:Q668;
               rdfs:label "${stateName}"@en.
        
        OPTIONAL { ?state wdt:P36 ?capital. }
        OPTIONAL { ?state wdt:P1082 ?population. }
        OPTIONAL { ?state wdt:P2046 ?area. }
        OPTIONAL { ?state wdt:P2744 ?literacy. }
        
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      } LIMIT 1
    `;

    const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(findQuery)}&format=json`;

    try {
      const res = await fetch(url, {
        headers: { 
          "User-Agent": "PrayerBulletinGenerator/1.0 (https://example.com; amith@example.com)", 
          "Accept": "application/sparql-results+json" 
        }
      });
      
      if (!res.ok) return null;

      const data = await res.json();
      const result = data.results.bindings[0];

      if (!result) return null;

      const stateId = result.state.value.split('/').pop();
      const religion = await this.fetchReligionData(stateId);

      return {
        name: stateName,
        capital: result.capitalLabel?.value,
        population: result.population ? parseInt(result.population.value) : undefined,
        area: result.area ? parseFloat(result.area.value) : undefined,
        literacy: result.literacy ? parseFloat(result.literacy.value) * (parseFloat(result.literacy.value) < 1 ? 100 : 1) : undefined,
        religion: religion,
        lastUpdated: new Date().toISOString()
      };
    } catch (e) {
      console.error(`Error fetching Wikidata for ${stateName}:`, e);
      return null;
    }
  }

  static async fetchDistrictFromWikidata(districtName: string, stateName: string): Promise<LocationMetadata | null> {
    // Similar logic to state but restricted by parent state if possible
    const query = `
      SELECT ?district ?capitalLabel ?population ?area WHERE {
        ?district wdt:P17 wd:Q668;
                  wdt:P31 wd:Q1149652; # district of India
                  rdfs:label "${districtName}"@en.
        OPTIONAL { ?district wdt:P1082 ?population. }
        OPTIONAL { ?district wdt:P2046 ?area. }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      } LIMIT 1
    `;
    // ... logic same as state fetch ...
    return this.fetchStateFromWikidata(districtName); // Re-use state logic for simplicity as it's broad enough
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
      SELECT ?religionLabel ?proportion WHERE {
        wd:${itemId} p:P140 ?relStatement.
        ?relStatement ps:P140 ?rel.
        ?relStatement pq:P1107 ?proportion.
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
        religions[label] = parseFloat(b.proportion.value) * 100;
      });
    } catch (e) {
      console.error(`Error fetching religion for ${itemId}:`, e);
    }
    return religions;
  }
}
