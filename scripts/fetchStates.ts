
import { MetadataService } from '../src/services/MetadataService';

const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam",
  "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Lakshadweep", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
  "NCT of Delhi", "Odisha", "Puducherry", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal"
];

async function run() {
  console.log("🚀 Starting state metadata fetch...");
  
  for (const state of INDIAN_STATES) {
    console.log(`Processing ${state}...`);
    
    // Check local first
    const existing = MetadataService.getLocalData('states', state);
    if (existing) {
      console.log(`✅ ${state} already cached.`);
      continue;
    }

    const metadata = await MetadataService.fetchStateFromWikidata(state);
    if (metadata) {
      MetadataService.saveLocalData('states', metadata);
      console.log(`✨ Successfully fetched and saved ${state}.`);
    } else {
      console.warn(`❌ Failed to fetch data for ${state}.`);
    }

    // Small delay to be nice to Wikidata API
    await new Promise(r => setTimeout(r, 500));
  }

  console.log("🏁 State metadata fetch complete.");
}

run().catch(console.error);
