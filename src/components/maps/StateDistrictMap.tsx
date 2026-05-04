"use client";

import React, { useMemo, useEffect, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker
} from "react-simple-maps";
import { geoPath, geoMercator } from "d3-geo";
import { STATE_CENTERS } from "@/data/mapConstants";

const geoUrl = "/maps/india-level2.json";
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

  useEffect(() => {
    async function calculateBounds() {
      try {
        const response = await fetch(geoUrl);
        const data = await response.json();
        
        // Filter features based on state, and optionally zoom to district
        let features = data.features.filter((f: any) => 
          f.properties.NAME_1.replace(/\s+/g, "").toLowerCase() === stateName.replace(/\s+/g, "").toLowerCase()
        );

        if (zoomToDistrict && highlightDistrict) {
          const districtFeatures = features.filter((f: any) => 
            f.properties.NAME_2.toLowerCase().replace(/\s+/g, "").includes(highlightDistrict.toLowerCase().replace(/\s+/g, ""))
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
        }
      } catch (e) {
        console.error("Error calculating map bounds:", e);
      }
    }

    calculateBounds();
  }, [stateName, highlightDistrict, zoomToDistrict, towns]);

  return (
    <div className="w-full h-full min-h-[300px] bg-slate-50 rounded-2xl relative border border-slate-200">
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
                const geoState = geo.properties.NAME_1.replace(/\s+/g, "").toLowerCase();
                const searchState = stateName.replace(/\s+/g, "").toLowerCase();
                return geoState === searchState;
              });

              if (stateDistricts.length === 0) return null;

              return stateDistricts.map((geo) => {
                const districtName = geo.properties.NAME_2;
                const isHighlighted = highlightDistrict && 
                  districtName.toLowerCase().replace(/\s+/g, "").includes(highlightDistrict.toLowerCase().replace(/\s+/g, ""));
                
                const centroid = geoPath().centroid(geo);
                const [x, y] = projection(centroid) || [0, 0];

                return (
                  <React.Fragment key={geo.rsmKey}>
                    <Geography
                      geography={geo}
                      fill={isHighlighted ? "#EFF6FF" : "#FFFFFF"}
                      stroke={isHighlighted ? "#2563eb" : "#E2E8F0"}
                      strokeWidth={isHighlighted ? 3 : 0.5}
                      style={{
                        default: { outline: "none" },
                        hover: { fill: "#EFF6FF", stroke: "#3B82F6", outline: "none" },
                        pressed: { fill: "#2563eb", outline: "none" },
                      }}
                    />
                    {!zoomToDistrict && (
                      <g className="pointer-events-none">
                        <text
                          x={x}
                          y={y}
                          textAnchor="middle"
                          fill={isHighlighted ? "#2563eb" : "#475569"}
                          style={{ 
                            fontFamily: "Inter, system-ui, sans-serif", 
                            fontSize: isHighlighted ? "11px" : "8px", 
                            fontWeight: "900",
                            textTransform: "uppercase",
                            letterSpacing: "0.02em",
                            paintOrder: "stroke",
                            stroke: "rgba(255,255,255,0.9)",
                            strokeWidth: "2px"
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

          {zoomToDistrict && townMarkers.map(({ name, coordinates, type }) => (
            <Marker key={name} coordinates={coordinates}>
              <circle r={type === 'town' ? 4 : 3} fill={type === 'town' ? "#2563eb" : "#64748b"} stroke="#fff" strokeWidth={1.5} />
              <text
                textAnchor="middle"
                y={-10}
                style={{ 
                  fontFamily: "Inter, system-ui, sans-serif", 
                  fontSize: type === 'town' ? "10px" : "8px", 
                  fontWeight: type === 'town' ? "900" : "700",
                  fill: type === 'town' ? "#1e293b" : "#475569",
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
