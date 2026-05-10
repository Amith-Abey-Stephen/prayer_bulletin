"use client";

import React, { useEffect, useState, Suspense, useRef } from "react";
import IndiaMap from "@/components/maps/IndiaMap";
import StateDistrictMap from "@/components/maps/StateDistrictMap";
import SearchSuggestions from "@/components/SearchSuggestions";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { formatName, formatLiteracyDisplay, formatNumber, formatArea } from "../../../lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
};

const StatCard = ({ label, value, icon, color = "blue" }: StatCardProps) => {
  const configs: Record<string, { bg: string; icon: string }> = {
    blue: { bg: "bg-[#ebf0f7]", icon: "text-[#1e3a5f]" },
    indigo: { bg: "bg-[#ede9fe]", icon: "text-[#6d28d9]" },
    rose: { bg: "bg-[#fce7f3]", icon: "text-[#db2777]" },
    amber: { bg: "bg-[#fef3c7]", icon: "text-[#d97706]" },
    emerald: { bg: "bg-[#d1fae5]", icon: "text-[#059669]" },
    violet: { bg: "bg-[#ede9fe]", icon: "text-[#7c3aed]" },
    cyan: { bg: "bg-[#cffafe]", icon: "text-[#0891b2]" },
  };

  const c = configs[color] || configs.blue;

  return (
    <div className="bg-white p-5 rounded-2xl border border-[#e8e5e0] flex flex-col gap-3 transition-all hover:shadow-sm">
      <div className={`w-9 h-9 rounded-xl ${c.bg} ${c.icon} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] text-[#a8a29e] font-semibold mb-0.5">{label}</p>
        <p className="text-lg font-bold text-[#1a1a2e] leading-tight">{value || "---"}</p>
      </div>
    </div>
  );
};

const SkeletonStatCard = () => (
  <div className="bg-white p-5 rounded-2xl border border-[#e8e5e0] flex flex-col gap-3">
    <div className="w-9 h-9 rounded-xl skeleton-card"></div>
    <div className="space-y-2">
      <div className="h-3 w-20 skeleton-card rounded"></div>
      <div className="h-5 w-28 skeleton-card rounded"></div>
    </div>
  </div>
);

const FetchTimer = ({ label }: { label: string }) => {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setSeconds((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2.5 bg-[#ebf0f7] px-3 py-1.5 rounded-full border border-[#d9e2ec]">
      <div className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2563eb] opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2563eb]"></span>
      </div>
      <p className="text-[10px] font-bold text-[#1e3a5f] uppercase tracking-wider whitespace-nowrap">
        Loading {label}... <span className="font-mono text-xs ml-0.5">{seconds}s</span>
      </p>
    </div>
  );
};

const StepBar = ({ current }: { current: number }) => {
  const steps = [
    { num: 1, label: "Select Region" },
    { num: 2, label: "Review Data" },
    { num: 3, label: "Generate" },
    { num: 4, label: "Export" },
  ];

  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const isActive = s.num === current;
        const isPast = s.num < current;
        return (
          <React.Fragment key={s.num}>
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  isActive
                    ? "bg-[#1e3a5f] text-white shadow-sm"
                    : isPast
                    ? "bg-[#ebf0f7] text-[#1e3a5f]"
                    : "bg-[#f5f2ed] text-[#a8a29e]"
                }`}
              >
                {isPast ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s.num
                )}
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider hidden sm:inline ${
                  isActive ? "text-[#1e3a5f]" : isPast ? "text-[#78716c]" : "text-[#a8a29e]"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-px w-6 sm:w-10 mx-1.5 ${
                  isPast ? "bg-[#1e3a5f]/30" : "bg-[#e8e5e0]"
                }`}
              ></div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin"></div>
  );
}

function BulletinContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const location = searchParams.get("location") || "";

  const [matchedState, setMatchedState] = useState<string | null>(null);
  const [matchedDistrict, setMatchedDistrict] = useState<string | null>(null);
  const [stateData, setStateData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [districtsSummary, setDistrictsSummary] = useState<any[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState<string[]>([]);
  const [allDistrictNames, setAllDistrictNames] = useState<string[]>([]);
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

        const districtMatch = data.features.find(
          (f: any) =>
            f.properties.NAME_2.toLowerCase().includes(location.toLowerCase())
        );

        if (districtMatch) {
          setMatchedState(districtMatch.properties.NAME_1);
          setMatchedDistrict(districtMatch.properties.NAME_2);

          const stateDistricts = data.features.filter(
            (f: any) =>
              f.properties.NAME_1.toLowerCase() ===
              districtMatch.properties.NAME_1.toLowerCase()
          );
          setStateData((prev: any) => ({
            ...prev,
            totalDistricts: stateDistricts.length,
          }));
        } else {
          const stateMatch = data.features.find(
            (f: any) =>
              f.properties.NAME_1.toLowerCase() ===
                location.toLowerCase() ||
              f.properties.NAME_1
                .toLowerCase()
                .includes(location.toLowerCase())
          );
          if (stateMatch) {
            setMatchedState(stateMatch.properties.NAME_1);
            setMatchedDistrict(null);

            const stateDistricts = data.features.filter(
              (f: any) =>
                f.properties.NAME_1.toLowerCase() ===
                stateMatch.properties.NAME_1.toLowerCase()
            );
            setAllDistrictNames(
              stateDistricts.map((f: any) => f.properties.NAME_2)
            );
            setStateData((prev: any) => ({
              ...prev,
              totalDistricts: stateDistricts.length,
            }));
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
          const normalizedState = formatName(matchedState);

          const res = await fetch(
            `/api/state-data?name=${encodeURIComponent(
              normalizedState
            )}&type=states&project2026=true`
          );
          const data = await res.json();

          if (!data.error) {
            let combinedData = { ...data };

            if (matchedDistrict) {
              const dRes = await fetch(
                `/api/state-data?name=${encodeURIComponent(
                  matchedDistrict
                )}&type=districts&parent=${encodeURIComponent(
                  normalizedState
                )}`
              );
              const dData = await dRes.json();
              if (!dData.error) {
                combinedData = {
                  ...combinedData,
                  name: dData.name,
                  capital: dData.capital || combinedData.capital,
                  source: dData.source,
                };
              }
            }

            setStateData((prev: any) => ({
              ...combinedData,
              totalDistricts: prev?.totalDistricts,
            }));

            setIsDataLoading(false);

            let targets: string[] = [];

            if (matchedDistrict) {
              targets = [matchedDistrict];
            } else if (allDistrictNames.length > 0) {
              targets = allDistrictNames;
            } else if (data.majorCities) {
              targets = data.majorCities;
            }

            if (targets.length > 0) {
              setLoadingDistricts(targets);

              const batchSize = 3;
              for (let i = 0; i < targets.length; i += batchSize) {
                const batch = targets.slice(i, i + batchSize);

                await Promise.all(
                  batch.map(async (d) => {
                    try {
                      const r = await fetch(
                        `/api/state-data?name=${encodeURIComponent(
                          d
                        )}&type=districts&parent=${encodeURIComponent(
                          normalizedState
                        )}`
                      );
                      if (r.ok) {
                        const dSum = await r.json();
                        if (!dSum.error) {
                          setDistrictsSummary((prev) => [...prev, dSum]);
                        }
                      }
                    } catch (e) {
                      console.error(`Error fetching summary for ${d}:`, e);
                    } finally {
                      setLoadingDistricts((prev) =>
                        prev.filter((name) => name !== d)
                      );
                    }
                  })
                );

                if (i + batchSize < targets.length) {
                  await new Promise((resolve) =>
                    setTimeout(resolve, 500)
                  );
                }
              }
            }
          }
        } catch (e) {
          console.error("Error fetching state data:", e);
          setIsDataLoading(false);
        }
      };
      fetchExtraData();
    }
  }, [matchedState, matchedDistrict, allDistrictNames]);

  const handleDownload = async () => {
    if (!bulletinRef.current) return;

    setIsDownloading(true);
    try {
      const canvas = await html2canvas(bulletinRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#F8FAFC",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(
        `prayer-bulletin-${location
          .toLowerCase()
          .replace(/\s+/g, "-")}.pdf`
      );
    } catch (error) {
      console.error("PDF generation failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const formatLiteracy = formatLiteracyDisplay;

  const prayerPoints = [
    `Pray for the people of ${
      matchedDistrict || matchedState || location
    }, that they may experience God's love and peace.`,
    `Intercede for the local government and leaders, for wisdom and integrity in their service.`,
    `Pray for the socio-economic challenges in the region, especially regarding ${
      stateData?.literacy ? "education and literacy" : "community development"
    }.`,
    `Ask for strength and protection for the families and communities facing hardships.`,
    `Pray for the spiritual growth and unity among the various communities in ${matchedState}.`,
  ];
  const [searchLocation, setSearchLocation] = useState("");

  const handleNewSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchLocation.trim()) {
      router.push(
        `/bulletin?location=${encodeURIComponent(searchLocation.trim())}`
      );
      setSearchLocation("");
    }
  };

  if (!location) {
    return (
      <div className="text-center py-24">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#ebf0f7] text-[#1e3a5f] mb-5">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[#1a1a2e] mb-2">No location specified</h2>
        <p className="text-sm text-[#78716c] mb-5">Please search for a location to generate a bulletin.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#1e3a5f] hover:bg-[#14294a] px-5 py-2.5 rounded-xl transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Go to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] text-[#1a1a2e] font-sans">
      {/* Page Header */}
      <header className="bg-white border-b border-[#e8e5e0] py-5">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#1e3a5f] rounded-xl flex items-center justify-center text-white font-bold italic text-base shadow-sm shrink-0">
                C
              </div>
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-[0.15em] text-[#a8a29e] font-bold leading-none mb-0.5">
                  Prayer Department | AGDMC
                </p>
                <h2 className="text-base sm:text-lg font-bold text-[#1a1a2e] leading-none truncate">
                  Cry For India <span className="text-[#2563eb]">Prayer Bulletin</span>
                </h2>
              </div>
            </div>
            <StepBar current={2} />
          </div>
        </div>
      </header>

      <Suspense fallback={null}>
        {/* Loading Skeleton */}
        {isLoading && (
          <div className="max-w-5xl mx-auto px-4 py-12 animate-fade-in">
            <div className="bg-white rounded-2xl border border-[#e8e5e0] p-8 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 skeleton-card rounded-xl"></div>
                <div className="space-y-2">
                  <div className="h-3 w-32 skeleton-card rounded"></div>
                  <div className="h-5 w-48 skeleton-card rounded"></div>
                </div>
              </div>
              <div className="h-[400px] skeleton-card rounded-2xl"></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <SkeletonStatCard key={i} />
                ))}
              </div>
            </div>
          </div>
        )}

        {!isLoading && (
          <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
            {/* Action Bar */}
            <div className="sticky top-4 z-[100] no-print mb-8">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 justify-between bg-white/90 backdrop-blur-md p-4 rounded-xl border border-[#e8e5e0] shadow-sm">
                <div className="flex items-center gap-3">
                  <Link
                    href="/"
                    className="w-9 h-9 rounded-xl bg-[#f5f2ed] hover:bg-[#ebf0f7] text-[#78716c] hover:text-[#1e3a5f] flex items-center justify-center transition-all shrink-0"
                    title="Back to home"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </Link>

                  <div className="h-8 w-px bg-[#e8e5e0]"></div>

                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-[#2563eb]"></div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#a8a29e] leading-none mb-0.5">
                        Current Report
                      </p>
                      <p className="text-sm font-bold text-[#1a1a2e] leading-none truncate max-w-[160px] sm:max-w-[240px]">
                        {matchedDistrict || matchedState || location}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-stretch sm:items-center gap-3 flex-1 sm:max-w-md">
                  <form
                    onSubmit={handleNewSearch}
                    className="relative flex-1 min-w-0 group"
                  >
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg
                        className="h-3.5 w-3.5 text-[#a8a29e] group-focus-within:text-[#2563eb] transition-colors"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={searchLocation}
                      onChange={(e) => setSearchLocation(e.target.value)}
                      className="block w-full pl-9 pr-3 py-2.5 text-sm border border-[#e8e5e0] rounded-xl bg-[#faf8f5] text-[#1a1a2e] focus:ring-2 focus:ring-[#2563eb]/20 focus:border-[#2563eb] focus:bg-white transition-all outline-none placeholder:text-[#a8a29e]"
                      placeholder="Search location..."
                      autoComplete="off"
                    />
                    <SearchSuggestions
                      value={searchLocation}
                      onSelect={(name: string) => {
                        setSearchLocation(name);
                        router.push(
                          `/bulletin?location=${encodeURIComponent(name)}`
                        );
                        setSearchLocation("");
                      }}
                    />
                  </form>

                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className={`font-bold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 shrink-0 ${
                      isDownloading
                        ? "bg-[#f5f2ed] text-[#a8a29e] cursor-not-allowed"
                        : "bg-[#1e3a5f] text-white hover:bg-[#14294a] shadow-sm hover:shadow"
                    }`}
                  >
                    {isDownloading ? (
                      <>
                        <Spinner />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        <span className="hidden sm:inline">Download PDF</span>
                        <span className="sm:hidden">PDF</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* The Bulletin - PDF Content */}
            <div
              ref={bulletinRef}
              className="bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-[#e8e5e0] rounded-[1.5rem] overflow-hidden relative"
              style={{ minHeight: "1120px" }}
            >
              {/* Decorative Background */}
              <div className="absolute top-0 right-0 w-72 h-72 bg-[#ebf0f7]/60 rounded-full -mr-32 -mt-32 blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#ebf0f7]/30 rounded-full -ml-40 -mb-40 blur-3xl"></div>

              {/* Bulletin Header */}
              <div className="bg-white text-[#1a1a2e] p-10 sm:p-12 relative overflow-hidden border-b border-[#e8e5e0]">
                <div className="relative z-10 flex justify-between items-start">
                  <div>
                    <p className="text-[#2563eb] font-bold tracking-[0.15em] uppercase text-[10px] mb-3">
                      Prayer Department | AGDMC
                    </p>
                    <h1 className="text-4xl sm:text-5xl font-black mb-2 tracking-tight text-[#1a1a2e]">
                      Cry For India
                    </h1>
                    <div className="flex items-center gap-3 text-[#78716c] text-sm font-medium">
                      <span className="w-10 h-px bg-[#e8e5e0]"></span>
                      Focus: {matchedDistrict || matchedState || location}
                      <span className="w-10 h-px bg-[#e8e5e0]"></span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-3xl sm:text-4xl font-serif italic text-[#2563eb]/20 mb-1">
                      2026
                    </div>
                    <p className="text-[10px] text-[#a8a29e] font-bold uppercase tracking-wider leading-tight">
                      Official Report
                      <br />
                      Issue #042
                    </p>
                  </div>
                </div>
              </div>

              {/* Bulletin Body */}
              <div className="p-8 sm:p-12 space-y-14 relative z-10">
                {/* Section 01: National Context */}
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-[#1e3a5f] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      01
                    </span>
                    <div>
                      <h2 className="text-xs font-bold text-[#a8a29e] uppercase tracking-[0.12em]">
                        National Context
                      </h2>
                      <p className="text-[11px] text-[#a8a29e]">India</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#e8e5e0] bg-white p-3 sm:p-4 shadow-sm">
                    <IndiaMap highlightState={matchedState || undefined} />
                  </div>
                </div>

                {/* Section 02: Regional View */}
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-[#1e3a5f] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      02
                    </span>
                    <div>
                      <h2 className="text-xs font-bold text-[#a8a29e] uppercase tracking-[0.12em]">
                        Regional Breakdown
                      </h2>
                      <p className="text-[11px] text-[#a8a29e]">{matchedState}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#e8e5e0] bg-white p-3 sm:p-4 shadow-sm">
                    {matchedState ? (
                      <StateDistrictMap
                        stateName={matchedState}
                        highlightDistrict={matchedDistrict || undefined}
                      />
                    ) : (
                      <div className="w-full min-h-[300px] flex items-center justify-center bg-[#faf8f5] text-[#a8a29e] text-sm italic rounded-xl">
                        Select a state to visualize districts
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 03: Analytics */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-[#1e3a5f] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                        03
                      </span>
                      <div>
                        <h2 className="text-xs font-bold text-[#a8a29e] uppercase tracking-[0.12em]">
                          Summary Details
                        </h2>
                        <p className="text-[11px] text-[#a8a29e]">
                          {matchedState || location}
                        </p>
                      </div>
                    </div>
                    {isDataLoading && (
                      <FetchTimer label={matchedState || location} />
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      label="Total Population"
                      value={formatNumber(stateData?.population)}
                      color="blue"
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                      }
                    />
                    <StatCard
                      label="Area Coverage"
                      value={formatArea(stateData?.area)}
                      color="emerald"
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2 2 2 0 012 2v.684M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      }
                    />
                    <StatCard
                      label="Regional Capital"
                      value={stateData?.capital || "---"}
                      color="violet"
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H5a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                      }
                    />
                    <StatCard
                      label="Total Districts"
                      value={stateData?.totalDistricts?.toString() || "---"}
                      color="rose"
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                          />
                        </svg>
                      }
                    />
                    <StatCard
                      label="Literacy Rate"
                      value={formatLiteracy(stateData?.literacy)}
                      color="indigo"
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          />
                        </svg>
                      }
                    />
                    <StatCard
                      label="Ruling Government"
                      value={stateData?.governmentParty || "---"}
                      color="cyan"
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H5a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                      }
                    />
                    <div className="col-span-2 p-5 sm:p-6 bg-[#fefce8] rounded-2xl border border-[#fde68a]">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[#a16207] font-bold mb-3 flex items-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Religious Demographics
                      </p>
                      <div className="flex flex-wrap gap-x-5 gap-y-2">
                        {stateData?.religion ? (
                          Object.entries(stateData.religion).map(
                            ([rel, val]: [string, any]) => (
                              <div
                                key={rel}
                                className="flex items-center gap-2"
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-[#d4a853]"></div>
                                <span className="text-xs font-semibold text-[#57534e] capitalize">
                                  {rel}:
                                </span>
                                <span className="text-xs font-bold text-[#1a1a2e]">
                                  {val !== null && typeof val === "number"
                                    ? val.toFixed(1)
                                    : val ?? "---"}
                                  %
                                </span>
                              </div>
                            )
                          )
                        ) : (
                          <span className="text-xs text-[#a8a29e] italic">
                            Data not available
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 04: District-by-District Summary */}
                {matchedState && (
                  <div className="space-y-10">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-[#1e3a5f] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                          04
                        </span>
                        <div>
                          <h2 className="text-xs font-bold text-[#a8a29e] uppercase tracking-[0.12em]">
                            District-by-District Summary
                          </h2>
                          <p className="text-[11px] text-[#a8a29e]">
                            {matchedState}
                          </p>
                        </div>
                      </div>
                      {loadingDistricts.length > 0 && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-[#2563eb]">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#2563eb] animate-pulse"></div>
                          Loading districts...
                        </div>
                      )}
                    </div>

                    <div className="space-y-14">
                      {districtsSummary.length === 0 &&
                        loadingDistricts.length > 0 && (
                          <div className="py-16 text-center border-2 border-dashed border-[#e8e5e0] rounded-2xl">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#ebf0f7] text-[#2563eb] mb-4">
                              <svg
                                className="w-6 h-6 animate-spin"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                            </div>
                            <p className="text-sm font-semibold text-[#a8a29e]">
                              Compiling regional data for {matchedState}...
                            </p>
                          </div>
                        )}

                      {districtsSummary.map((dist, i) => (
                        <div
                          key={i}
                          className="space-y-6 animate-fade-in-up"
                          style={{ animationDelay: `${i * 100}ms` }}
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-px flex-1 bg-[#e8e5e0]"></div>
                            <h3 className="text-lg sm:text-xl font-bold text-[#1a1a2e] tracking-tight flex items-center gap-3">
                              <span className="w-7 h-7 rounded-full bg-[#ebf0f7] text-[#1e3a5f] flex items-center justify-center text-xs font-bold">
                                {i + 1}
                              </span>
                              {dist.name} District
                            </h3>
                            <div className="h-px flex-1 bg-[#e8e5e0]"></div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                            <div className="md:col-span-4 rounded-2xl border border-[#e8e5e0] overflow-hidden bg-[#faf8f5] p-2 shadow-sm">
                              <div className="h-48 md:h-64">
                                <StateDistrictMap
                                  stateName={matchedState!}
                                  highlightDistrict={dist.name}
                                  zoomToDistrict={true}
                                  towns={dist.majorCities}
                                  talukas={dist.talukas}
                                />
                              </div>
                            </div>

                            <div className="md:col-span-8 grid grid-cols-2 lg:grid-cols-3 gap-4">
                              <StatCard
                                label="Total Population"
                                value={formatNumber(dist.population)}
                                color="blue"
                                icon={
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                    />
                                  </svg>
                                }
                              />
                              <StatCard
                                label="Area Coverage"
                                value={formatArea(dist.area)}
                                color="emerald"
                                icon={
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2 2 2 0 012 2v.684M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                }
                              />
                              <StatCard
                                label="Literacy Rate"
                                value={formatLiteracy(dist.literacy)}
                                color="indigo"
                                icon={
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                                    />
                                  </svg>
                                }
                              />

                              <div className="lg:col-span-2 p-5 bg-white rounded-2xl border border-[#e8e5e0] flex flex-col justify-between">
                                <p className="text-[10px] font-bold text-[#a8a29e] uppercase tracking-[0.12em] mb-3">
                                  Key Urban Hubs
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {dist.majorCities && dist.majorCities.length > 0 ? (
                                    dist.majorCities.map(
                                      (town: string, ti: number) => (
                                        <span
                                          key={ti}
                                          className="px-3 py-1 bg-[#faf8f5] text-[#57534e] rounded-lg text-[10px] font-semibold border border-[#e8e5e0]"
                                        >
                                          {town}
                                        </span>
                                      )
                                    )
                                  ) : (
                                    <span className="text-xs text-[#a8a29e] italic">
                                      No urban center data identified
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="p-5 bg-[#fefce8] rounded-2xl border border-[#fde68a]">
                                <p className="text-[10px] font-bold text-[#a16207] uppercase tracking-[0.12em] mb-3">
                                  Religious Breakdown (%)
                                </p>
                                <div className="space-y-1.5">
                                  {dist.religion ? (
                                    Object.entries(dist.religion).map(
                                      ([rel, val]: [string, any]) => (
                                        <div
                                          key={rel}
                                          className="flex items-center justify-between"
                                        >
                                          <span className="text-[10px] font-semibold text-[#57534e] capitalize">
                                            {rel}
                                          </span>
                                          <span className="text-[10px] font-bold text-[#1a1a2e]">
                                            {val !== null &&
                                            typeof val === "number"
                                              ? val.toFixed(1)
                                              : val ?? "---"}
                                            %
                                          </span>
                                        </div>
                                      )
                                    )
                                  ) : (
                                    <span className="text-[10px] text-[#a8a29e] italic block py-2 text-center">
                                      Demographic breakdown unavailable
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Loading placeholders for districts */}
                      {loadingDistricts.map((name, i) => (
                        <div
                          key={`loading-${name}`}
                          className="space-y-6 animate-pulse opacity-50"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-px flex-1 bg-[#e8e5e0]"></div>
                            <div className="flex flex-col items-center gap-2">
                              <h3 className="text-lg font-bold text-[#a8a29e] tracking-tight">
                                {name}
                              </h3>
                              <FetchTimer label={name} />
                            </div>
                            <div className="h-px flex-1 bg-[#e8e5e0]"></div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="h-24 skeleton-card rounded-xl"></div>
                            <div className="h-24 skeleton-card rounded-xl"></div>
                            <div className="h-24 skeleton-card rounded-xl"></div>
                            <div className="col-span-2 h-32 skeleton-card rounded-xl"></div>
                            <div className="h-32 skeleton-card rounded-xl"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 05: Prayer Points */}
                <div className="space-y-6 bg-[#faf8f5] p-8 sm:p-10 rounded-[1.5rem] border border-[#e8e5e0]">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-[#1e3a5f] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      05
                    </span>
                    <div>
                      <h2 className="text-xs font-bold text-[#a8a29e] uppercase tracking-[0.12em]">
                        Targeted Prayer Points
                      </h2>
                      <p className="text-[11px] text-[#a8a29e]">
                        Intercede for {matchedState || location}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {prayerPoints.map((point, i) => (
                      <div
                        key={i}
                        className="flex gap-4 p-5 bg-white rounded-xl border border-[#e8e5e0] hover:shadow-sm transition-all"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#ebf0f7] text-[#1e3a5f] flex items-center justify-center shrink-0 text-xs font-bold">
                          {i + 1}
                        </div>
                        <p className="text-[#57534e] text-sm leading-relaxed">
                          {point}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Branding */}
                <div className="pt-10 mt-10 border-t border-[#e8e5e0] flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                  <div>
                    <p className="text-[10px] text-[#a8a29e] font-bold uppercase tracking-wider mb-1.5">
                      Generated by
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-[#1e3a5f] rounded flex items-center justify-center text-white font-bold text-xs italic">
                        C
                      </div>
                      <span className="text-sm font-bold text-[#1a1a2e]">
                        CRY FOR INDIA{" "}
                        <span className="text-[#2563eb] font-black">BULLETIN</span>
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-[#a8a29e] font-medium leading-relaxed">
                      &copy; 2026 Cry For India &middot; Prayer Department | AGDMC
                      <br />
                      Digital ID: {digitalId || "PBG-LOADING..."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Tip */}
            <div className="mt-8 text-center no-print">
              <p className="text-xs text-[#a8a29e]">
                Tip: Ensure your printer settings include &ldquo;Background Graphics&rdquo; for best PDF results.
              </p>
            </div>
          </div>
        )}
      </Suspense>

      <footer className="py-10 bg-white border-t border-[#e8e5e0] mt-12">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-xs text-[#a8a29e]">
            &copy; 2026 Cry For India &middot; Prayer Department | AGDMC. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function BulletinPage() {
  return (
    <Suspense fallback={null}>
      <BulletinContent />
    </Suspense>
  );
}
