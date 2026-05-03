
import { NextResponse } from "next/server";
import { MetadataService } from "@/services/MetadataService";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const type = (searchParams.get("type") || "states") as "states" | "districts" | "towns";
  const parent = searchParams.get("parent");

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Normalize names (remove spaces for search if needed, but MetadataService handles it)
  // Actually, we'll pass the name as is from the GeoJSON
  
  // 1. Try local data
  const localData = MetadataService.getLocalData(type, name, parent || undefined);
  if (localData) {
    return NextResponse.json({ ...localData, source: "local" });
  }

  // 2. Fetch from API if missing
  let metadata;
  if (type === "states") {
    metadata = await MetadataService.fetchStateFromWikidata(name);
  } else {
    // For districts and towns, we can expand MetadataService logic
    // For now, states logic works broadly
    metadata = await MetadataService.fetchStateFromWikidata(name);
  }

  if (metadata) {
    MetadataService.saveLocalData(type, metadata, parent || undefined);
    return NextResponse.json({ ...metadata, source: "api" });
  }

  return NextResponse.json({ error: "Metadata not found" }, { status: 404 });
}
