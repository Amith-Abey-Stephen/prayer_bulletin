"use client";

import React, { useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker
} from "react-simple-maps";
import { STATE_CENTERS } from "@/data/mapConstants";

const geoUrl = "/maps/india-level2.json";

interface StateDistrictMapProps {
  stateName: string;
  highlightDistrict?: string;
}

const StateDistrictMap: React.FC<StateDistrictMapProps> = ({ stateName, highlightDistrict }) => {
  const center = useMemo(() => STATE_CENTERS[stateName] || [82, 22], [stateName]);
  
  return (
    <div className="w-full h-[500px] md:h-[700px] bg-white rounded-2xl shadow-inner border border-slate-100 overflow-hidden">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 4500, // Slightly higher zoom
          center: center
        }}
        style={{ width: "100%", height: "100%" }}
      >
          <Geographies geography={geoUrl}>
            {({ geographies }) => {
              // Filter districts belonging to the selected state
              const stateDistricts = geographies.filter(
                (geo) => geo.properties.NAME_1.toLowerCase() === stateName.toLowerCase()
              );

              if (stateDistricts.length === 0) return null;

              return stateDistricts.map((geo) => {
                const districtName = geo.properties.NAME_2;
                const isHighlighted = highlightDistrict && 
                  districtName.toLowerCase().includes(highlightDistrict.toLowerCase());
                
                return (
                  <React.Fragment key={geo.rsmKey}>
                    <Geography
                      geography={geo}
                      fill={isHighlighted ? "#2563eb" : "#F8FAFC"}
                      stroke="#CBD5E1"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: "none" },
                        hover: { fill: "#DBEAFE", outline: "none" },
                        pressed: { fill: "#2563eb", outline: "none" },
                      }}
                    />
                    <g className="pointer-events-none">
                      <text
                        textAnchor="middle"
                        fill="#64748B"
                        style={{ 
                          fontFamily: "system-ui", 
                          fontSize: isHighlighted ? "10px" : "8px", 
                          fontWeight: isHighlighted ? "bold" : "normal",
                          paintOrder: "stroke",
                          stroke: "white",
                          strokeWidth: "2px"
                        }}
                        transform={`translate(${geo.properties.CENTROID_X || 0}, ${geo.properties.CENTROID_Y || 0})`}
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
