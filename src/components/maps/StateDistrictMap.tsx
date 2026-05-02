"use client";

import React, { useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup
} from "react-simple-maps";

const geoUrl = "/maps/india-level2.json";

const STATE_CENTERS: Record<string, [number, number]> = {
  "AndamanandNicobar": [92.73, 11.62],
  "AndhraPradesh": [79.74, 15.91],
  "ArunachalPradesh": [94.72, 28.21],
  "Assam": [92.93, 26.20],
  "Bihar": [85.31, 25.09],
  "Chandigarh": [76.77, 30.73],
  "Chhattisgarh": [81.86, 21.27],
  "DadraandNagarHaveli": [73.01, 20.27],
  "DamanandDiu": [72.83, 20.42],
  "Goa": [74.12, 15.30],
  "Gujarat": [71.19, 22.25],
  "Haryana": [76.08, 29.05],
  "HimachalPradesh": [77.17, 31.10],
  "JammuandKashmir": [74.79, 34.08],
  "Jharkhand": [85.33, 23.61],
  "Karnataka": [75.71, 15.31],
  "Kerala": [76.27, 10.85],
  "Lakshadweep": [72.64, 10.56],
  "MadhyaPradesh": [78.65, 22.97],
  "Maharashtra": [75.71, 19.75],
  "Manipur": [93.93, 24.66],
  "Meghalaya": [91.36, 25.46],
  "Mizoram": [92.93, 23.16],
  "Nagaland": [94.56, 26.15],
  "NCTofDelhi": [77.10, 28.61],
  "Odisha": [84.80, 20.95],
  "Puducherry": [79.80, 11.94],
  "Punjab": [75.34, 31.14],
  "Rajasthan": [73.84, 27.02],
  "Sikkim": [88.51, 27.53],
  "TamilNadu": [78.65, 11.12],
  "Telangana": [79.01, 18.11],
  "Tripura": [91.74, 23.94],
  "UttarPradesh": [80.85, 26.84],
  "Uttarakhand": [79.01, 30.06],
  "WestBengal": [87.85, 23.81]
};

interface StateDistrictMapProps {
  stateName: string;
  highlightDistrict?: string;
}

const StateDistrictMap: React.FC<StateDistrictMapProps> = ({ stateName, highlightDistrict }) => {
  const center = useMemo(() => STATE_CENTERS[stateName] || [82, 22], [stateName]);
  
  return (
    <div className="w-full h-[400 md:h-[600px] bg-white rounded-2xl shadow-inner border border-slate-100 overflow-hidden">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 4000, // Higher zoom for state level
          center: center
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup zoom={1}>
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
              });
            }}
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
};

export default StateDistrictMap;
