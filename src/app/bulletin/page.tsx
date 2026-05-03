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
    <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2 transition-all">
      <div className={`w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">{label}</p>
        <p className="text-base font-bold text-slate-800 leading-tight">{value}</p>
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
  const [districtsSummary, setDistrictsSummary] = useState<any[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [digitalId, setDigitalId] = useState("");
  const bulletinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDigitalId(`PBG-${Math.random().toString(36).substring(7).toUpperCase()}`);
  }, []);

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
          
          // Calculate total districts for this state
          const stateDistricts = data.features.filter((f: any) => 
            f.properties.NAME_1.toLowerCase() === districtMatch.properties.NAME_1.toLowerCase()
          );
          setStateData((prev: any) => ({ ...prev, totalDistricts: stateDistricts.length }));
        } else {
          // Search in states
          const stateMatch = data.features.find((f: any) => 
            f.properties.NAME_1.toLowerCase() === location.toLowerCase() ||
            f.properties.NAME_1.toLowerCase().includes(location.toLowerCase())
          );
          if (stateMatch) {
            setMatchedState(stateMatch.properties.NAME_1);
            setMatchedDistrict(null);
            
            // Calculate total districts
            const stateDistricts = data.features.filter((f: any) => 
              f.properties.NAME_1.toLowerCase() === stateMatch.properties.NAME_1.toLowerCase()
            );
            setStateData((prev: any) => ({ ...prev, totalDistricts: stateDistricts.length }));
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
          // Normalize names like "AndhraPradesh" to "Andhra Pradesh"
          const normalizedState = matchedState
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/([a-z])(and)([A-Z])/g, '$1 $2 $3')
            .replace(/([A-Z])(and)([A-Z])/g, '$1 $2 $3');
          
          const res = await fetch(`/api/state-data?name=${encodeURIComponent(normalizedState)}&type=states`);
          const data = await res.json();
          
          if (!data.error) {
            // If we have a district, try to overlay its data
            if (matchedDistrict) {
              const dRes = await fetch(`/api/state-data?name=${encodeURIComponent(matchedDistrict)}&type=districts&parent=${encodeURIComponent(normalizedState)}`);
              const dData = await dRes.json();
              if (!dData.error) {
                setStateData((prev: any) => ({ 
                  ...data, 
                  ...dData, 
                  source: dData.source,
                  totalDistricts: prev?.totalDistricts // Keep the district count we calculated
                }));
              } else {
                setStateData((prev: any) => ({ ...data, totalDistricts: prev?.totalDistricts }));
              }
            } else {
              setStateData((prev: any) => ({ ...data, totalDistricts: prev?.totalDistricts }));
            }

            // Fetch top districts summary
            if (data.majorCities && data.majorCities.length > 0) {
              const topDistricts = data.majorCities.slice(0, 4);
              const summaries = await Promise.all(topDistricts.map(async (d: string) => {
                const r = await fetch(`/api/state-data?name=${encodeURIComponent(d)}&type=districts&parent=${encodeURIComponent(normalizedState)}`);
                return r.ok ? await r.json() : null;
              }));
              setDistrictsSummary(summaries.filter(s => s !== null && !s.error));
            }
          }
        } catch (e) {
          console.error("Error fetching state data:", e);
        } finally {
          setIsDataLoading(false);
        }
      };
      fetchExtraData();
    }
  }, [matchedState, matchedDistrict]);

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

  const prayerPoints = [
    `Pray for the people of ${matchedDistrict || matchedState || location}, that they may experience God's love and peace.`,
    `Intercede for the local government and leaders, for wisdom and integrity in their service.`,
    `Pray for the socio-economic challenges in the region, especially regarding ${stateData?.literacy ? 'education and literacy' : 'community development'}.`,
    `Ask for strength and protection for the families and communities facing hardships.`,
    `Pray for the spiritual growth and unity among the various communities in ${matchedState}.`
  ];

  if (!location) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-slate-800">No location specified</h2>
        <Link href="/" className="text-blue-600 hover:underline mt-4 inline-block">Go back</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Top Action Bar - Not part of PDF */}
      <div className="mb-8 flex items-center justify-between no-print">
        <Link href="/" className="text-sm font-medium text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Search
        </Link>
        <button 
          onClick={handleDownload}
          disabled={isDownloading}
          className={`font-bold py-2.5 px-6 rounded-lg transition-all shadow-md flex items-center gap-2 ${
            isDownloading 
              ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {isDownloading ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
              Preparing PDF...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export as PDF
            </>
          )}
        </button>
      </div>

      {/* The Actual Bulletin - Designed for PDF */}
      <div 
        ref={bulletinRef}
        className="bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-slate-200 rounded-[2rem] overflow-hidden relative"
        style={{ minHeight: '1120px' }} // Approx A4 ratio
      >
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-50/30 rounded-full -ml-48 -mb-48 blur-3xl"></div>

        {/* Header */}
        <div className="bg-white text-slate-900 p-12 relative overflow-hidden border-b border-slate-100">
          <div className="absolute inset-0 opacity-40">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E2E8F0" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
          
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-blue-600 font-bold tracking-[0.2em] uppercase text-[10px] mb-3">
                Prayer Department | AGDMC
              </p>
              <h1 className="text-5xl font-black mb-2 tracking-tight text-slate-900">
                PRAYER BULLETIN
              </h1>
              <div className="flex items-center gap-2 text-slate-500 text-sm font-medium italic">
                <span className="w-12 h-[1px] bg-slate-200"></span>
                Focus: {matchedDistrict || matchedState || location}
                <span className="w-12 h-[1px] bg-slate-200"></span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-serif italic text-blue-600 opacity-20 mb-1">2026</div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-tight">
                Official Report<br/>Issue #042
              </p>
            </div>
          </div>
        </div>

        <div className="p-12 space-y-16 relative z-10">
          {/* Section 1: National Context */}
          <div className="space-y-6">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-6 h-6 bg-slate-900 text-white rounded flex items-center justify-center text-[10px]">01</span>
              National Context (India)
            </h2>
            <div className="rounded-[2rem] border border-slate-100 overflow-hidden shadow-2xl bg-white p-4">
              <IndiaMap highlightState={matchedState || undefined} />
            </div>
          </div>

          {/* Section 2: State Analytics (The requested reorder) */}
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-6 h-6 bg-slate-900 text-white rounded flex items-center justify-center text-[10px]">02</span>
                Summary Details: {matchedState || location}
              </h2>
              {isDataLoading && <div className="animate-pulse text-[10px] text-blue-600 font-black uppercase tracking-widest">Live Fetching...</div>}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard 
                label="Total Population" 
                value={formatNumber(stateData?.population)} 
                color="blue"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
              />
              <StatCard 
                label="Area Coverage" 
                value={formatArea(stateData?.area)} 
                color="emerald"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2 2 2 0 012 2v.684M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
              <StatCard 
                label="Regional Capital" 
                value={stateData?.capital || "---"} 
                color="violet"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H5a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
              />
              <StatCard 
                label="Total Districts" 
                value={stateData?.totalDistricts?.toString() || "---"} 
                color="rose"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>}
              />
              <StatCard 
                label="Literacy Rate" 
                value={formatLiteracy(stateData?.literacy)} 
                color="indigo"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
              />
              <StatCard 
                label="Ruling Government" 
                value={stateData?.governmentParty || "---"} 
                color="cyan"
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H5a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
              />
              <div className="col-span-2 p-6 bg-amber-50/50 rounded-xl border border-amber-100">
                <p className="text-[10px] uppercase tracking-widest text-amber-600 font-bold mb-3 flex items-center gap-2">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Religious Demographics (%)
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {stateData?.religion ? (
                    Object.entries(stateData.religion).map(([rel, val]: [string, any]) => (
                      <div key={rel} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                        <span className="text-xs font-semibold text-slate-700 capitalize">{rel}:</span>
                        <span className="text-xs font-bold text-slate-900">{val.toFixed(1)}%</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">Data not available</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Regional View (Next Map) */}
          <div className="space-y-6">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-6 h-6 bg-slate-900 text-white rounded flex items-center justify-center text-[10px]">03</span>
              Regional Breakdown: {matchedState}
            </h2>
            <div className="rounded-[2rem] border border-slate-100 overflow-hidden shadow-2xl bg-white p-4">
              {matchedState ? (
                <StateDistrictMap stateName={matchedState} highlightDistrict={matchedDistrict || undefined} />
              ) : (
                <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-slate-50 italic text-slate-400 text-sm">
                  Select a state to visualize districts
                </div>
              )}
            </div>
          </div>

          {/* Section 04: District-by-District Summary */}
          {matchedState && districtsSummary.length > 0 && (
            <div className="space-y-8">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-6 h-6 bg-slate-900 text-white rounded flex items-center justify-center text-[10px]">04</span>
                District-by-District Summary
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {districtsSummary.map((dist, i) => (
                  <div key={i} className="p-8 bg-white rounded-[2rem] border border-slate-100 shadow-xl hover:shadow-2xl transition-all group overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-tighter mb-1">Administrative Unit</p>
                          <h3 className="text-2xl font-black text-slate-900 tracking-tight">{dist.name}</h3>
                        </div>
                        <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-widest">
                          Active Region
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-6 mb-6">
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Population</p>
                          <p className="text-lg font-black text-slate-900">{formatNumber(dist.population)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Governing Party</p>
                          <p className="text-lg font-black text-slate-900 truncate">{dist.governmentParty || "NDA/INC"}</p>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-slate-50">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">Key Towns & Hubs</p>
                        <div className="flex flex-wrap gap-2">
                          {(dist.majorCities && dist.majorCities.length > 0) ? (
                            dist.majorCities.map((town: string, ti: number) => (
                              <span key={ti} className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-xl text-[11px] font-bold border border-slate-100">
                                {town}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">No specific town data</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 05: Prayer Points */}
          <div className="space-y-8 bg-slate-50/50 p-10 rounded-[2.5rem] border border-slate-100">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-6 h-6 bg-slate-900 text-white rounded flex items-center justify-center text-[10px]">05</span>
              Targeted Prayer Points
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {prayerPoints.map((point, i) => (
                <div key={i} className="flex gap-4 p-6 bg-white rounded-2xl shadow-sm border border-slate-100 group hover:shadow-md transition-all">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 text-xs font-bold group-hover:rotate-12 transition-transform">
                    {i + 1}
                  </div>
                  <p className="text-slate-700 text-sm leading-relaxed font-medium">
                    {point}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Branding */}
          <div className="pt-12 mt-12 border-t border-slate-100 flex justify-between items-end">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Generated by</p>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xs italic">P</div>
                <span className="text-sm font-black text-slate-800">PRAYER BULLETIN <span className="text-blue-600">GENERATOR</span></span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-slate-400 font-medium">
                © 2026 Prayer Department | AGDMC<br/>
                Digital Identification: {digitalId || "PBG-LOADING..."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Social/Bottom Note - Not part of PDF */}
      <div className="mt-12 text-center text-slate-400 text-sm no-print">
        <p>Tip: Ensure your printer settings are set to "Background Graphics" for the best result.</p>
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
