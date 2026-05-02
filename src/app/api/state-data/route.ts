
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { fetchFromWikidata, StateData } from "@/lib/wikidata";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state");

  if (!state) {
    return NextResponse.json({ error: "State is required" }, { status: 400 });
  }

  const cacheDir = path.join(process.cwd(), "data", "cache");
  const cacheFile = path.join(cacheDir, `${state.toLowerCase()}.json`);

  // Ensure cache directory exists
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  // Check cache
  if (fs.existsSync(cacheFile)) {
    try {
      const cachedData = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
      return NextResponse.json({ ...cachedData, source: "cache" });
    } catch (e) {
      console.error("Cache read error:", e);
    }
  }

  // Fetch from Wikidata
  const data = await fetchFromWikidata(state);

  if (data) {
    // Store in cache
    fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Data not found" }, { status: 404 });
}
