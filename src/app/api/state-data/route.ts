import { NextResponse } from "next/server";
import { MetadataService } from "@/services/MetadataService";
import { projectTo2026 } from "@/../lib/ai-extractor";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const type = (searchParams.get("type") || "states") as "states" | "districts" | "towns";
  const parent = searchParams.get("parent");
  const project2026 = searchParams.get("project2026") === "true";

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const localData = MetadataService.getLocalData(type, name, parent || undefined);
  if (localData) {
    if (MetadataService.hasEmptyFields(localData)) {
      const enriched = await MetadataService.fillMissingFromAI(name, type, localData, parent || undefined);
      MetadataService.saveLocalData(type, enriched, parent || undefined);
      return respond(enriched, "local+ai", project2026);
    }
    return respond(localData, "local", project2026);
  }

  let metadata;
  if (type === "states") {
    metadata = await MetadataService.fetchStateFromWikidata(name);
  } else {
    metadata = await MetadataService.fetchDistrictFromWikidata(name, parent || "");
  }

  if (metadata) {
    const enriched = await MetadataService.fillMissingFromAI(name, type, metadata, parent || undefined);
    MetadataService.saveLocalData(type, enriched, parent || undefined);
    return respond(enriched, "api", project2026);
  }

  return NextResponse.json({ error: "Metadata not found" }, { status: 404 });
}

async function respond(data: any, source: string, project: boolean) {
  const body: any = { ...data, source };
  if (project && data.name) {
    const p = await projectTo2026(data.name, data, `${data.name}:2026`);
    if (p.population != null && data.population != null) {
      const ratio = p.population / data.population;
      if (ratio >= 0.8 && ratio <= 1.5) body.population = p.population;
    }
    if (p.literacy != null) body.literacy = p.literacy;
    body.governmentHead = p.governmentHead ?? body.governmentHead;
    body.governmentParty = p.rulingParty ?? body.governmentParty;
    if (p.religion && (p.religion.hindu != null || p.religion.muslim != null || p.religion.christian != null)) {
      body.religion = p.religion;
    }
  }
  return NextResponse.json(body);
}
