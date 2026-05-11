"use client";

import React, { useEffect, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker
} from "react-simple-maps";
import { geoPath, geoContains, geoCentroid } from "d3-geo";

const geoUrl = "/maps/india-level2.json";
const level3Url = "/maps/india-level3.json";

// Global cache for level 3 data to avoid multiple 12MB loads
let cachedLevel3: any = null;
interface StateDistrictMapProps {
  stateName: string;
  highlightDistrict?: string;
  zoomToDistrict?: boolean;
  towns?: (string | { name: string; lat: number; lng: number })[];
  talukas?: { name: string; lat: number; lng: number }[];
}

const StateDistrictMap: React.FC<StateDistrictMapProps> = ({ stateName, highlightDistrict, zoomToDistrict, towns, talukas = [] }) => {
  const [mapConfig, setMapConfig] = useState<{ scale: number; center: [number, number] }>({
    scale: 8000,
    center: [82, 22]
  });

  const [townMarkers, setTownMarkers] = useState<{ name: string; coordinates: [number, number]; type: 'town' | 'taluka' }[]>([]);
  const [subDistrictGeos, setSubDistrictGeos] = useState<any[]>([]);

  useEffect(() => {
    async function calculateBounds() {
      try {
        const response = await fetch(geoUrl);
        const data = await response.json();
        
        // Filter features based on state, and optionally zoom to district
        let features = data.features.filter((f: any) => 
          f.properties?.NAME_1?.replace(/\s+/g, "").toLowerCase() === stateName?.replace(/\s+/g, "").toLowerCase()
        );

        if (zoomToDistrict && highlightDistrict) {
          const districtFeatures = features.filter((f: any) => 
            f.properties?.NAME_2?.toLowerCase().replace(/\s+/g, "").includes(highlightDistrict.toLowerCase().replace(/\s+/g, ""))
          );
          if (districtFeatures.length > 0) {
            features = districtFeatures;
          }
        }

        if (features.length > 0) {
          let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
          
          features.forEach((f: any) => {
            const coords = f.geometry.type === "Polygon" 
              ? [f.geometry.coordinates] 
              : f.geometry.coordinates;
              
            coords.forEach((ring: any) => {
              ring.forEach((subRing: any) => {
                const points = Array.isArray(subRing[0]) ? subRing : ring;
                points.forEach(([lon, lat]: [number, number]) => {
                  if (lon < minLon) minLon = lon;
                  if (lon > maxLon) maxLon = lon;
                  if (lat < minLat) minLat = lat;
                  if (lat > maxLat) maxLat = lat;
                });
              });
            });
          });

          const centerLon = (minLon + maxLon) / 2;
          const centerLat = (minLat + maxLat) / 2;
          
          const latDiff = maxLat - minLat;
          const lonDiff = (maxLon - minLon) * Math.cos(centerLat * Math.PI / 180);
          const maxDiff = Math.max(latDiff, lonDiff);
          
          // Scale factor is much higher for district zoom
          const viewSize = zoomToDistrict ? 350000 : 60000;
          const calculatedScale = Math.min(zoomToDistrict ? 80000 : 25000, (viewSize / (maxDiff || 1)) * 0.65);

          setMapConfig({
            scale: calculatedScale,
            center: [centerLon, centerLat]
          });

          // Extract town and taluka coordinates
          const markers: { name: string; coordinates: [number, number]; type: 'town' | 'taluka' }[] = [];
          
          if (towns && towns.length > 0) {
            towns.forEach((town) => {
              if (typeof town === 'object' && town.lat && town.lng) {
                markers.push({
                  name: town.name,
                  coordinates: [town.lng, town.lat] as [number, number],
                  type: 'town'
                });
              } else {
                markers.push({
                  name: typeof town === 'string' ? town : town.name,
                  coordinates: [
                    centerLon + (Math.random() - 0.5) * (maxLon - minLon) * 0.4,
                    centerLat + (Math.random() - 0.5) * (maxLat - minLat) * 0.4
                  ] as [number, number],
                  type: 'town'
                });
              }
            });
          }

          if (talukas && talukas.length > 0) {
            talukas.forEach((taluka) => {
              markers.push({
                name: taluka.name,
                coordinates: [taluka.lng, taluka.lat] as [number, number],
                type: 'taluka'
              });
            });
          }

          setTownMarkers(markers);

          // Handle Level 3 Sub-district borders
          if (zoomToDistrict) {
            try {
              let level3Data = cachedLevel3;
              if (!level3Data) {
                const response = await fetch(level3Url);
                level3Data = await response.json();
                cachedLevel3 = level3Data;
              }

              if (level3Data && level3Data.objects) {
                // TopoJSON to GeoJSON
                const topojson = await import("topojson-client");
                const allSubDistricts = topojson.feature(level3Data, level3Data.objects.INDADM3gbOpen) as any;
                
                // Get district geometry for spatial filtering
                // Get district geometry for spatial filtering
                // Merge multiple features if necessary (some districts are MultiPolygons or split)
                const districtGeometry = features.length > 1 
                  ? { type: "GeometryCollection", geometries: features.map(f => f.geometry) }
                  : features[0]?.geometry;

                if (!districtGeometry) {
                  console.error("[MapDebug] No district geometry found for filtering");
                  setSubDistrictGeos([]);
                  return;
                }
                
                // Filter sub-districts
                const filtered = allSubDistricts.features.filter((f: any) => {
                  if (!f.properties) return false;
                  
                  // 1. Name match with provided talukas
                  const shapeName = f.properties?.shapeName;
                  if (shapeName) {
                    const name = shapeName.toLowerCase().replace(/\s+/g, "");
                    const hasNameMatch = talukas && talukas.some(t => {
                      if (!t?.name) return false;
                      const tName = t.name.toLowerCase().replace(/\s+/g, "");
                      return name.includes(tName) || tName.includes(name);
                    });
                    
                    if (hasNameMatch) return true;
                  }

                  // 2. Spatial match: is the centroid of this sub-district inside the district?
                  try {
                    const centroid = geoCentroid(f);
                    const isInside = geoContains(districtGeometry, centroid);
                    return isInside;
                  } catch (e) {
                    return false;
                  }
                });
                
                setSubDistrictGeos(filtered);
              }
            } catch (err) {
              console.error("Error loading Level 3 data:", err);
            }
          }
        }
      } catch (e) {
        console.error("Error calculating map bounds:", e);
      }
    }

    calculateBounds();
  }, [stateName, highlightDistrict, zoomToDistrict, towns, talukas]);

  return (
    <div className="w-full h-full min-h-[300px] bg-[#f0f4f8] rounded-2xl relative border border-[#e8e5e0]">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: mapConfig.scale, 
          center: mapConfig.center
        }}
        style={{ width: "100%", height: "100%" }}
      >
          <Geographies geography={geoUrl}>
            {({ geographies, projection }) => {
              const stateDistricts = geographies.filter((geo) => {
                const geoState = geo.properties?.NAME_1?.toLowerCase().trim();
                const targetState = stateName?.toLowerCase().trim();
                return geoState === targetState;
              });

              if (stateDistricts.length === 0) return null;

              return stateDistricts.map((geo) => {
                const districtName = geo.properties?.NAME_2;
                const isHighlighted = highlightDistrict && districtName && 
                  districtName.toLowerCase().replace(/\s+/g, "").includes(highlightDistrict.toLowerCase().replace(/\s+/g, ""));
                
                const centroid = geoPath().centroid(geo);
                const [x, y] = projection(centroid) || [0, 0];

                return (
                  <React.Fragment key={geo.rsmKey}>
                    <Geography
                      geography={geo}
                      fill={isHighlighted ? "#ffffff" : "#f1f5f9"}
                      stroke={isHighlighted ? "#1e3a5f" : "#cbd5e1"}
                      strokeWidth={isHighlighted ? 2.5 : 0.8}
                      style={{
                        default: { outline: "none" },
                        hover: { fill: "#cbd5e1", stroke: "#1e3a5f", outline: "none" },
                        pressed: { fill: "#1e3a5f", outline: "none" },
                      }}
                    />
                    {(!zoomToDistrict || isHighlighted) && (
                      <g className="pointer-events-none">
                        <text
                          x={x}
                          y={y}
                          textAnchor="middle"
                          fill={isHighlighted ? "#1e3a5f" : "#57534e"}
                          style={{ 
                            fontFamily: "Inter, system-ui, sans-serif", 
                            fontSize: isHighlighted ? "12px" : "9px", 
                            fontWeight: "900",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            paintOrder: "stroke",
                            stroke: "#ffffff",
                            strokeWidth: "3px"
                          }}
                        >
                          {districtName}
                        </text>
                      </g>
                    )}
                  </React.Fragment>
                );
              });
            }}
          </Geographies>

          {/* Render Sub-district borders (Level 3) if available */}
          {zoomToDistrict && subDistrictGeos.length > 0 && (
            <Geographies geography={{ type: "FeatureCollection", features: subDistrictGeos }}>
              {({ geographies, projection }) => (
                <g className="sub-districts">
                  {geographies.map((geo, i) => {
                    const centroid = geoPath().centroid(geo);
                    const [x, y] = projection(centroid) || [0, 0];
                    const name = geo.properties.shapeName;

                    return (
                      <React.Fragment key={`sub-frag-${i}`}>
                        <Geography
                          geography={geo}
                          fill="rgba(30, 58, 95, 0.05)"
                          stroke="#94a3b8"
                          strokeWidth={0.6}
                          style={{
                            default: { outline: "none" },
                            hover: { fill: "rgba(30, 58, 95, 0.15)", outline: "none" },
                          }}
                        />
                        <g className="pointer-events-none">
                          <text
                            x={x}
                            y={y}
                            textAnchor="middle"
                            fill="#4b5563"
                            style={{ 
                              fontFamily: "Inter, system-ui, sans-serif", 
                              fontSize: "7px", 
                              fontWeight: "700",
                              textTransform: "uppercase",
                              letterSpacing: "0.02em",
                              paintOrder: "stroke",
                              stroke: "#ffffff",
                              strokeWidth: "2px",
                              opacity: 0.8
                            }}
                          >
                            {name}
                          </text>
                        </g>
                      </React.Fragment>
                    );
                  })}
                </g>
              )}
            </Geographies>
          )}

          {zoomToDistrict && townMarkers.map(({ name, coordinates, type }, i) => (
            <Marker key={`${name}-${i}`} coordinates={coordinates}>
              <circle r={type === 'town' ? 4 : 3} fill={type === 'town' ? "#1e3a5f" : "#78716c"} stroke="#fff" strokeWidth={1.5} />
              <text
                textAnchor="middle"
                y={-10}
                style={{ 
                  fontFamily: "Inter, system-ui, sans-serif", 
                  fontSize: type === 'town' ? "10px" : "8px", 
                  fontWeight: type === 'town' ? "900" : "700",
                  fill: type === 'town' ? "#1a1a2e" : "#57534e",
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  paintOrder: "stroke",
                  stroke: "white",
                  strokeWidth: "3px"
                }}
              >
                {name}
              </text>
            </Marker>
          ))}
      </ComposableMap>
    </div>
  );
};

export default StateDistrictMap;
