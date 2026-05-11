
import { NextResponse } from "next/server";
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.toLowerCase();

    if (!query || query.length < 2) {
        return NextResponse.json([]);
    }

    try {
        const filePath = path.join(process.cwd(), 'src', 'data', 'locations.json');
        const locations = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        const suggestions = locations
            .filter((loc: any) => 
                loc.name.toLowerCase().includes(query) || 
                loc.parent.toLowerCase().includes(query)
            )
            .sort((a: any, b: any) => {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                
                // Exact match first
                if (aName === query) return -1;
                if (bName === query) return 1;
                
                // Starts with query next
                const aStarts = aName.startsWith(query);
                const bStarts = bName.startsWith(query);
                if (aStarts && !bStarts) return -1;
                if (bStarts && !aStarts) return 1;
                
                return aName.localeCompare(bName);
            })
            .slice(0, 8); // Limit local results to 8

        // If we have space, add towns from Nominatim
        if (suggestions.length < 8) {
            try {
                const nominatimRes = await fetch(
                    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ", India")}&format=json&limit=5`,
                    { headers: { "User-Agent": "PrayerBulletinGenerator/1.0" } }
                );
                const nominatimData = await nominatimRes.json();
                
                nominatimData.forEach((item: any) => {
                    if (suggestions.length >= 8) return;
                    
                    // Filter for city, town, village
                    if (['city', 'town', 'village', 'hamlet', 'suburb'].includes(item.type) || 
                        ['city', 'town', 'village', 'hamlet', 'suburb'].includes(item.addresstype)) {
                        
                        const name = item.display_name.split(',')[0];
                        if (!suggestions.some((s: any) => s.name.toLowerCase() === name.toLowerCase())) {
                            suggestions.push({
                                name: name,
                                type: 'town',
                                parent: item.display_name.split(',').slice(1, 3).join(',').trim()
                            });
                        }
                    }
                });
            } catch (err) {
                console.error("Nominatim fetch failed", err);
            }
        }

        return NextResponse.json(suggestions);
    } catch (e) {
        console.error("Error fetching suggestions:", e);
        return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
    }
}
