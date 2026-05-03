
import { MetadataService } from '../src/services/MetadataService';

async function fetchDistrictsForState(stateName: string) {
  console.log(`🚀 Fetching districts for ${stateName}...`);
  
  const query = `
    SELECT ?district ?districtLabel WHERE {
      ?state wdt:P17 wd:Q668;
             rdfs:label "${stateName}"@en.
      ?district wdt:P131 ?state;
                wdt:P31 wd:Q1149652. # district of India
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  `;

  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PrayerBulletinGenerator/1.0", "Accept": "application/sparql-results+json" }
    });
    const data = await res.json();
    const districts = data.results.bindings;

    console.log(`Found ${districts.length} districts.`);

    for (const d of districts) {
      const name = d.districtLabel.value;
      console.log(`Processing ${name}...`);

      const existing = MetadataService.getLocalData('districts', name, stateName);
      if (existing) continue;

      // For districts, we can use a similar fetch logic or a simplified one
      // For now, let's just use the state fetcher with the district name
      // and save it in the districts folder
      const metadata = await MetadataService.fetchStateFromWikidata(name); // It works for districts too since the query is broad enough
      if (metadata) {
        MetadataService.saveLocalData('districts', metadata, stateName);
      }
      
      await new Promise(r => setTimeout(r, 200));
    }
  } catch (e) {
    console.error(`Error fetching districts for ${stateName}:`, e);
  }
}

const targetState = process.argv[2] || "Kerala";
fetchDistrictsForState(targetState).catch(console.error);
