/**
 * Fetch raw text extract from Wikipedia for a given location name.
 * Uses the REST API for simplicity.
 */
export async function fetchWikipediaExtract(name: string): Promise<string> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'PrayerBulletinGenerator/1.0' }
    });
    
    if (!response.ok) return "";
    
    const data = await response.json();
    return data.extract || "";
  } catch (e) {
    console.error(`Wikipedia fetch failed for ${name}:`, e);
    return "";
  }
}
