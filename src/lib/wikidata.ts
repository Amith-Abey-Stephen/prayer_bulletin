
const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

export interface StateData {
  population?: string;
  area?: string;
  capital?: string;
  literacy?: string;
  governmentHead?: string;
  religions?: string;
  source: "api" | "cache";
}

export async function fetchFromWikidata(stateName: string): Promise<StateData | null> {
  // 1. Find the item ID for the state
  const findQuery = `
    SELECT ?state WHERE {
      ?state wdt:P17 wd:Q668;
             wdt:P31 wd:Q1221156;
             rdfs:label "${stateName}"@en.
    } LIMIT 1
  `;
  
  const findUrl = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(findQuery)}&format=json`;

  try {
    const findRes = await fetch(findUrl, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/sparql-results+json" }
    });
    const findData = await findRes.json();
    const stateId = findData.results.bindings[0]?.state?.value.split("/").pop();

    if (!stateId) {
      console.warn(`No Wikidata item found for state: ${stateName}`);
      return null;
    }

    // 2. Fetch all details for this state ID
    const detailsQuery = `
      SELECT ?population ?area ?capitalLabel ?literacy ?governmentHeadLabel 
             (GROUP_CONCAT(DISTINCT CONCAT(?religionLabel, ":", STR(?proportion)); SEPARATOR="; ") AS ?religions)
      WHERE {
        BIND(wd:${stateId} AS ?state)
        OPTIONAL { ?state wdt:P1082 ?population. }
        OPTIONAL { ?state wdt:P2046 ?area. }
        OPTIONAL { ?state wdt:P36 ?capital. }
        OPTIONAL { ?state wdt:P2744 ?literacy. }
        OPTIONAL { ?state wdt:P6 ?governmentHead. }
        OPTIONAL {
          ?state p:P140 ?relStatement.
          ?relStatement ps:P140 ?rel.
          ?relStatement pq:P1107 ?proportion.
          ?rel rdfs:label ?religionLabel.
          FILTER(LANG(?religionLabel) = "en")
        }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      } GROUP BY ?population ?area ?capitalLabel ?literacy ?governmentHeadLabel
    `;

    const detailsUrl = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(detailsQuery)}&format=json`;
    const detailsRes = await fetch(detailsUrl, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/sparql-results+json" }
    });
    const detailsData = await detailsRes.json();
    const result = detailsData.results.bindings[0];

    if (!result) return null;

    return {
      population: result.population?.value,
      area: result.area?.value,
      capital: result.capitalLabel?.value,
      literacy: result.literacy?.value,
      governmentHead: result.governmentHeadLabel?.value,
      religions: result.religions?.value,
      source: "api"
    };
  } catch (error) {
    console.error("Wikidata fetch error:", error);
    return null;
  }
}
