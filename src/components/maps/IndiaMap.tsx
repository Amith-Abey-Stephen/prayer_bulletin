"use client";

import React from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup
} from "react-simple-maps";

const geoUrl = "/maps/india-level1.json";

interface IndiaMapProps {
  highlightState?: string;
}

const IndiaMap: React.FC<IndiaMapProps> = ({ highlightState }) => {
  return (
    <div className="w-full h-[400 md:h-[600px] bg-white rounded-2xl shadow-inner border border-slate-100 overflow-hidden">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 1000,
          center: [82, 22]
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup zoom={1}>
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
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
};

export default IndiaMap;
