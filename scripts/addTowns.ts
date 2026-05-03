
import fs from 'fs';
import path from 'path';

async function fetchMajorTowns() {
    console.log("🚀 Fetching major Indian towns from Wikidata...");
    const query = `
        SELECT ?cityLabel ?stateLabel WHERE {
          ?city wdt:P31 wd:Q11755880; # town in India
                wdt:P17 wd:Q668. # India
          ?city wdt:P131 ?state.
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        } LIMIT 1000
    `;

    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;

    try {
        const res = await fetch(url, {
            headers: { "User-Agent": "PrayerBulletinGenerator/1.0", "Accept": "application/sparql-results+json" }
        });
        const data = await res.json();
        const towns = data.results.bindings.map((b: any) => ({
            name: b.cityLabel.value,
            type: 'town',
            parent: b.stateLabel.value
        }));

        console.log(`Found ${towns.length} towns.`);
        return towns;
    } catch (e) {
        console.error("Error fetching towns:", e);
        return [];
    }
}

interface Location {
    name: string;
    type: 'state' | 'district' | 'town';
    parent: string;
}

async function main() {
    const filePath = path.join(process.cwd(), 'src', 'data', 'locations.json');
    if (!fs.existsSync(filePath)) {
        console.error("locations.json not found. Run generateLocations first.");
        return;
    }

    const locations: Location[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const towns: Location[] = await fetchMajorTowns();

    const combined: Location[] = [...locations, ...towns];
    
    // De-duplicate
    const seen = new Set();
    const final = combined.filter((loc: Location) => {
        const key = `${loc.type}:${loc.name}:${loc.parent}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    fs.writeFileSync(filePath, JSON.stringify(final, null, 2));
    console.log(`✅ Added towns. Total locations: ${final.length}`);
}

main().catch(console.error);
