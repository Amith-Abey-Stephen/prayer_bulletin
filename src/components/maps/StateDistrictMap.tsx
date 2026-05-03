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
    <div className="w-full h-[600px] md:h-[800px] bg-slate-50/30 rounded-[2.5rem] shadow-inner border border-slate-100 overflow-hidden relative">
      <div className="absolute top-6 left-6 z-10 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-200 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Regional Overview</p>
        <p className="text-sm font-bold text-slate-900">{stateName}</p>
      </div>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 10000, // Even more zoom for details
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
                          fontSize: isHighlighted ? "10px" : "7px", 
                          fontWeight: "800",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          paintOrder: "stroke",
                          stroke: isHighlighted ? "none" : "white",
                          strokeWidth: "2px"
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
