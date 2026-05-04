/**
 * Fetch raw text extract from Wikipedia for a given location name.
 * Uses the MediaWiki Query API to get a more comprehensive extract than the summary API.
 */
export async function fetchWikipediaExtract(name: string): Promise<string> {
  // Use the query API for a longer extract
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exchars=4000&explaintext=1&titles=${encodeURIComponent(name)}&origin=*`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'PrayerBulletinGenerator/1.0' }
    });
    
    if (!response.ok) return "";
    
    const data = await response.json();
    const pages = data.query?.pages;
    if (!pages) return "";
    
    // Get the first page's extract
    const pageId = Object.keys(pages)[0];
    if (pageId === "-1") return ""; // Page not found
    
    return pages[pageId].extract || "";
  } catch (e) {
    console.error(`Wikipedia fetch failed for ${name}:`, e);
    return "";
  }
}
