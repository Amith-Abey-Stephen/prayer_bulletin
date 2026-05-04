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
}

const StateDistrictMap: React.FC<StateDistrictMapProps> = ({ stateName, highlightDistrict }) => {
  const [mapConfig, setMapConfig] = useState<{ scale: number; center: [number, number] }>({
    scale: 8000,
    center: [82, 22]
  });

  useEffect(() => {
    async function calculateBounds() {
      try {
        const response = await fetch(geoUrl);
        const data = await response.json();
        
        const stateFeatures = data.features.filter((f: any) => 
          f.properties.NAME_1.replace(/\s+/g, "").toLowerCase() === stateName.replace(/\s+/g, "").toLowerCase()
        );

        if (stateFeatures.length > 0) {
          const featureCollection = { type: "FeatureCollection", features: stateFeatures };
          
          // Use d3 to calculate bounds in geographic coordinates
          // We can't use path.bounds directly easily for scale without a projection
          // So we do it manually on the coordinates
          let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
          
          stateFeatures.forEach((f: any) => {
            const coords = f.geometry.type === "Polygon" 
              ? [f.geometry.coordinates] 
              : f.geometry.coordinates;
              
            coords.forEach((ring: any) => {
              ring.forEach((subRing: any) => {
                // GeoJSON can be nested differently depending on MultiPolygon
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
          
          // Calculate appropriate scale
          // Map height is approx 600-800px. 1 degree lat is ~111km.
          // Mercator scale 1000 is ~30 degrees.
          // We want the state to take up ~80% of the view.
          const latDiff = maxLat - minLat;
          const lonDiff = (maxLon - minLon) * Math.cos(centerLat * Math.PI / 180);
          const maxDiff = Math.max(latDiff, lonDiff);
          
          // This constant is a bit of trial and error but ~150000 / maxDiff usually works well for 800px
          const calculatedScale = Math.min(25000, (60000 / (maxDiff || 1)) * 0.75);

          setMapConfig({
            scale: calculatedScale,
            center: [centerLon, centerLat]
          });
        }
      } catch (e) {
        console.error("Error calculating map bounds:", e);
      }
    }

    calculateBounds();
  }, [stateName]);

  return (
    <div className="w-full h-[600px] md:h-[800px] bg-slate-50 rounded-[3rem] border border-slate-200 overflow-hidden relative shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)]">
      {/* Premium Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="map-grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#map-grid)" />
        </svg>
      </div>

      <div className="absolute top-8 right-8 z-10 bg-white/90 backdrop-blur-xl px-6 py-3 rounded-3xl border border-slate-200/50 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none mb-1">State Analysis</p>
            <p className="text-lg font-black text-slate-900 tracking-tight leading-none text-right">{stateName}</p>
          </div>
        </div>
      </div>

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
                
                // Calculate centroid using d3-geo
                const centroid = geoPath().centroid(geo);
                const [x, y] = projection(centroid) || [0, 0];

                return (
                  <React.Fragment key={geo.rsmKey}>
                    <Geography
                      geography={geo}
                      fill={isHighlighted ? "#2563eb" : "#FFFFFF"}
                      stroke={isHighlighted ? "#1d4ed8" : "#CBD5E1"}
                      strokeWidth={isHighlighted ? 1 : 0.5}
                      style={{
                        default: { outline: "none" },
                        hover: { fill: "#EFF6FF", stroke: "#3B82F6", outline: "none" },
                        pressed: { fill: "#2563eb", outline: "none" },
                      }}
                    />
                    {/* District Label */}
                    <g className="pointer-events-none">
                      <text
                        x={x}
                        y={y}
                        textAnchor="middle"
                        fill={isHighlighted ? "#FFFFFF" : "#475569"}
                        style={{ 
                          fontFamily: "Inter, system-ui, sans-serif", 
                          fontSize: isHighlighted ? "11px" : "8px", 
                          fontWeight: "900",
                          textTransform: "uppercase",
                          letterSpacing: "0.02em",
                          paintOrder: "stroke",
                          stroke: isHighlighted ? "none" : "rgba(255,255,255,0.9)",
                          strokeWidth: "3px"
                        }}
                      >
                        {districtName}
                      </text>
                    </g>
                  </React.Fragment>
                );
              });
            }}
          </Geographies>
      </ComposableMap>
    </div>
  );
};

export default StateDistrictMap;
