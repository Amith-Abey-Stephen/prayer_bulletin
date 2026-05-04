"use client";

import React from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker
} from "react-simple-maps";
import { STATE_CENTERS } from "@/data/mapConstants";

const geoUrl = "/maps/india-level1.json";

interface IndiaMapProps {
  highlightState?: string;
}

const IndiaMap: React.FC<IndiaMapProps> = ({ highlightState }) => {
  return (
    <div className="w-full h-[500px] md:h-[600px] bg-white rounded-2xl border border-slate-200">
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
                  fill={isHighlighted ? "#2563eb" : "#F8FAFC"}
                  stroke="#CBD5E1"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none" },
                    hover: { fill: "#DBEAFE", outline: "none" },
                    pressed: { fill: "#2563eb", outline: "none" },
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
                  fill="#1E293B"
                  style={{ 
                    fontFamily: "system-ui", 
                    fontSize: "14px", 
                    fontWeight: "black",
                    paintOrder: "stroke",
                    stroke: "white",
                    strokeWidth: "4px"
                  }}
                >
                  {name.replace(/([a-z])([A-Z])/g, '$1 $2')}
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
