
import fs from 'fs';
import path from 'path';

const LEVEL1_PATH = path.join(process.cwd(), 'public', 'maps', 'india-level1.json');
const LEVEL2_PATH = path.join(process.cwd(), 'public', 'maps', 'india-level2.json');
const OUTPUT_DIR = path.join(process.cwd(), 'src', 'data');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'locations.json');

function formatName(name: string) {
    // Some names are camelcased or missing spaces (e.g. AndamanandNicobar)
    // This is a common issue with these specific GeoJSON files
    // I'll try to add spaces before capital letters if it seems to be merged
    return name.replace(/([a-z])([A-Z])/g, '$1 $2');
}

interface Location {
    name: string;
    type: 'state' | 'district' | 'town';
    parent: string;
}

async function main() {
    const locations: Location[] = [];
    const seen = new Set();

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Extract States
    if (fs.existsSync(LEVEL1_PATH)) {
        const level1 = JSON.parse(fs.readFileSync(LEVEL1_PATH, 'utf-8'));
        level1.features.forEach((feature: any) => {
            const rawName = feature.properties.NAME_1;
            const name = formatName(rawName);
            if (!seen.has(`state:${name}`)) {
                locations.push({
                    name: name,
                    type: 'state',
                    parent: 'India'
                });
                seen.add(`state:${name}`);
            }
        });
    }

    // Extract Districts
    if (fs.existsSync(LEVEL2_PATH)) {
        const level2 = JSON.parse(fs.readFileSync(LEVEL2_PATH, 'utf-8'));
        level2.features.forEach((feature: any) => {
            const rawDist = feature.properties.NAME_2;
            const rawState = feature.properties.NAME_1;
            const distName = formatName(rawDist);
            const stateName = formatName(rawState);
            
            if (!seen.has(`district:${distName}:${stateName}`)) {
                locations.push({
                    name: distName,
                    type: 'district',
                    parent: stateName
                });
                seen.add(`district:${distName}:${stateName}`);
            }
        });
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(locations, null, 2));
    console.log(`✅ Extracted ${locations.length} locations to ${OUTPUT_PATH}`);
}

main().catch(console.error);
