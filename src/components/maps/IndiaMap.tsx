"use client";

import React from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker
} from "react-simple-maps";
import { STATE_CENTERS } from "@/data/mapConstants";
import { formatName } from "../../../lib/utils";

const geoUrl = "/maps/india-level1.json";

interface IndiaMapProps {
  highlightState?: string;
}

const IndiaMap: React.FC<IndiaMapProps> = ({ highlightState }) => {
  return (
    <div className="w-full h-[500px] md:h-[600px] bg-[#f0f4f8] rounded-2xl border border-[#e8e5e0]">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 850,
          center: [82, 22]
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const stateName = geo.properties.NAME_1;
              const isHighlighted = highlightState && 
                stateName.toLowerCase().includes(highlightState.toLowerCase());
              
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={isHighlighted ? "#1e3a5f" : "#ffffff"}
                  stroke={isHighlighted ? "#1e3a5f" : "#cbd5e1"}
                  strokeWidth={isHighlighted ? 1 : 0.5}
                  style={{
                    default: { outline: "none" },
                    hover: { fill: "#ebf0f7", outline: "none" },
                    pressed: { fill: "#1e3a5f", outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>

        {highlightState && Object.entries(STATE_CENTERS).map(([name, coords]) => {
          if (name.toLowerCase().includes(highlightState.toLowerCase())) {
            return (
              <Marker key={name} coordinates={coords}>
                <text
                  textAnchor="middle"
                  fill="#1e3a5f"
                  style={{ 
                    fontFamily: "system-ui", 
                    fontSize: "14px", 
                    fontWeight: "black",
                    paintOrder: "stroke",
                    stroke: "white",
                    strokeWidth: "4px"
                  }}
                >
                  {formatName(name)}
                </text>
              </Marker>
            );
          }
          return null;
        })}
      </ComposableMap>
    </div>
  );
};

export default IndiaMap;
