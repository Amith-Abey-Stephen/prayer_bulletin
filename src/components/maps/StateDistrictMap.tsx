"use client";

import React, { useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker
} from "react-simple-maps";
import { geoPath } from "d3-geo";
import { projection } from "d3-geo"; // Not needed directly but good to know
import { STATE_CENTERS } from "@/data/mapConstants";

const geoUrl = "/maps/india-level2.json";

interface StateDistrictMapProps {
  stateName: string;
  highlightDistrict?: string;
}

const StateDistrictMap: React.FC<StateDistrictMapProps> = ({ stateName, highlightDistrict }) => {
  // Normalize state name for lookup (remove spaces to match STATE_CENTERS keys)
  const normalizedSearchName = stateName.replace(/\s+/g, "");
  const center = useMemo(() => STATE_CENTERS[normalizedSearchName] || [82, 22], [normalizedSearchName]);
  
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

      <div className="absolute top-8 left-8 z-10 bg-white/90 backdrop-blur-xl px-6 py-3 rounded-3xl border border-slate-200/50 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none mb-1">State Analysis</p>
            <p className="text-lg font-black text-slate-900 tracking-tight leading-none">{stateName}</p>
          </div>
        </div>
      </div>

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 10000, 
          center: center
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
