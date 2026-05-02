"use client";

import React, { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import IndiaMap from "@/components/maps/IndiaMap";
import StateDistrictMap from "@/components/maps/StateDistrictMap";
import Link from "next/link";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

const StatCard = ({ label, value, icon, color = "blue" }: { label: string; value: string; icon: React.ReactNode; color?: string }) => {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    indigo: "bg-indigo-50 text-indigo-600",
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
    cyan: "bg-cyan-50 text-cyan-600",
  };
  
  const colorClass = colors[color] || colors.blue;

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-xl ${colorClass} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="overflow-hidden">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold truncate">{label}</p>
        <p className="text-sm md:text-lg font-bold text-slate-800 leading-tight truncate">{value}</p>
      </div>
    </div>
  );
};

function BulletinContent() {
  const searchParams = useSearchParams();
  const location = searchParams.get("location") || "";
  
  const [matchedState, setMatchedState] = useState<string | null>(null);
  const [matchedDistrict, setMatchedDistrict] = useState<string | null>(null);
  const [stateData, setStateData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const bulletinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function findLocation() {
      if (!location) return;
      
      try {
        const response = await fetch("/maps/india-level2.json");
        const data = await response.json();
        
        // Search in districts first
        const districtMatch = data.features.find((f: any) => 
          f.properties.NAME_2.toLowerCase().includes(location.toLowerCase())
        );

        if (districtMatch) {
          setMatchedState(districtMatch.properties.NAME_1);
          setMatchedDistrict(districtMatch.properties.NAME_2);
        } else {
          // Search in states
          const stateMatch = data.features.find((f: any) => 
            f.properties.NAME_1.toLowerCase().includes(location.toLowerCase())
          );
          if (stateMatch) {
            setMatchedState(stateMatch.properties.NAME_1);
            setMatchedDistrict(null);
          }
        }
      } catch (error) {
        console.error("Error loading map data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    findLocation();
  }, [location]);

  useEffect(() => {
    if (matchedState) {
      const fetchExtraData = async () => {
        setIsDataLoading(true);
        try {
          // Normalize names like "AndhraPradesh" to "Andhra Pradesh" and "AndamanandNicobar" to "Andaman and Nicobar"
          const normalizedState = matchedState
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/([a-z])(and)([A-Z])/g, '$1 $2 $3')
            .replace(/([A-Z])(and)([A-Z])/g, '$1 $2 $3');
          const res = await fetch(`/api/state-data?state=${encodeURIComponent(normalizedState)}`);
          const data = await res.json();
          if (!data.error) setStateData(data);
        } catch (e) {
          console.error("Error fetching state data:", e);
        } finally {
          setIsDataLoading(false);
        }
      };
      fetchExtraData();
    }
  }, [matchedState]);

  const handleDownload = async () => {
    if (!bulletinRef.current) return;
    
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(bulletinRef.current, {
        scale: 2, // High quality
        useCORS: true,
        logging: false,
        backgroundColor: "#F8FAFC" // Matches slate-50
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [canvas.width, canvas.height]
      });
      
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`prayer-bulletin-${location.toLowerCase().replace(/\s+/g, "-")}.pdf`);
    } catch (error) {
      console.error("PDF generation failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const formatNumber = (num: string | undefined) => {
    if (!num) return "---";
    const n = parseFloat(num);
    if (n >= 10000000) return (n / 10000000).toFixed(1) + " Cr";
    if (n >= 100000) return (n / 100000).toFixed(1) + " L";
    if (n >= 1000) return (n / 1000).toFixed(1) + " K";
    return n.toLocaleString();
  };

  const formatArea = (area: string | undefined) => {
    if (!area) return "---";
    return parseFloat(area).toLocaleString() + " km²";
  };

  const formatLiteracy = (lit: string | undefined) => {
    if (!lit) return "---";
    const n = parseFloat(lit);
    return (n < 1 ? (n * 100).toFixed(1) : n.toFixed(1)) + "%";
  };

  if (!location) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-slate-800">No location specified</h2>
        <Link href="/" className="text-blue-600 hover:underline mt-4 inline-block">Go back</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8" ref={bulletinRef}>
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Search
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">
            Prayer Bulletin: {location}
          </h1>
          {matchedState && (
            <p className="text-slate-500 mt-1">
              Found in {matchedState}{matchedDistrict ? `, ${matchedDistrict} District` : ""}
            </p>
          )}
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 text-blue-700 text-sm font-medium">
            Sequential Regional Map Render
          </div>
          {stateData?.source === "cache" && (
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">
              ⚡ Loaded from local cache
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
            <h2 className="text-xl font-semibold text-slate-800">National Context</h2>
          </div>
          <IndiaMap highlightState={matchedState || undefined} />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
            <h2 className="text-xl font-semibold text-slate-800">Regional Breakdown</h2>
          </div>
          {matchedState ? (
            <StateDistrictMap stateName={matchedState} highlightDistrict={matchedDistrict || undefined} />
          ) : (
            <div className="w-full h-[400px] md:h-[600px] bg-slate-100 rounded-2xl flex items-center justify-center border border-dashed border-slate-300">
              <p className="text-slate-400">Select a valid state to see districts</p>
            </div>
          )}
        </div>
      </div>

      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
            <h2 className="text-xl font-semibold text-slate-800">State Analytics (Wikidata)</h2>
          </div>
          {isDataLoading && <div className="animate-pulse text-sm text-indigo-600 font-medium">Updating data...</div>}
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard 
            label="Total Population" 
            value={formatNumber(stateData?.population)} 
            color="blue"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
          />
          <StatCard 
            label="Total Area" 
            value={formatArea(stateData?.area)} 
            color="emerald"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2 2 2 0 012 2v.684M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard 
            label="State Capital" 
            value={stateData?.capital || "---"} 
            color="violet"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H5a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
          />
          <StatCard 
            label="Literacy Rate" 
            value={formatLiteracy(stateData?.literacy)} 
            color="indigo"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
          />
          <StatCard 
            label="Govt. Head" 
            value={stateData?.governmentHead || "---"} 
            color="cyan"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
          />
          <StatCard 
            label="Religions (%)" 
            value={stateData?.religions ? stateData.religions.split(";")[0].split(":")[0] : "---"} 
            color="amber"
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
        </div>

        {stateData?.religions && (
          <div className="mt-4 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <h4 className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">Detailed Religious Demographics</h4>
            <div className="flex flex-wrap gap-4">
              {stateData.religions.split("; ").map((rel: string) => {
                const [name, val] = rel.split(":");
                const percent = (parseFloat(val) * 100).toFixed(1);
                return (
                  <div key={name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                    <span className="text-sm font-medium text-slate-700">{name}:</span>
                    <span className="text-sm font-bold text-slate-900">{percent}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-12 p-8 bg-white border border-slate-100 shadow-sm rounded-3xl text-center">
        <h3 className="text-xl font-bold text-slate-800 mb-2">Ready to generate bulletin?</h3>
        <p className="text-slate-500 mb-6 max-w-lg mx-auto">This tool will automatically compile relevant prayer points and statistics for {matchedDistrict || matchedState || location}.</p>
        <button 
          onClick={handleDownload}
          disabled={isDownloading}
          className={`font-bold py-3 px-8 rounded-xl transition-all shadow-md flex items-center gap-2 mx-auto ${
            isDownloading 
              ? "bg-slate-200 text-slate-500 cursor-not-allowed" 
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {isDownloading ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
              Generating PDF...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF Bulletin
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function BulletinPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 py-4 shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold italic text-xl">P</div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold leading-none">Generator</p>
              <h2 className="text-lg font-bold text-blue-600 leading-none">Prayer Bulletin</h2>
            </div>
          </div>
        </div>
      </header>
      
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
        <BulletinContent />
      </Suspense>
      
      <footer className="py-12 bg-white border-t border-slate-200 mt-20">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm">© 2024 Prayer Department | AGDMC. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
